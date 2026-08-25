/**
 * Utility ingestion: power, water, gas, telecom and street-lighting assets.
 *
 * `/api/utilities/live` is the endpoint most likely to be honest about having
 * nothing: SCADA telemetry needs a Modbus gateway address and credentials that no
 * production deployment here has, so the production branch answers UNAVAILABLE
 * with the integration it would need. That answer is carried through verbatim to
 * the operator instead of being replaced with an empty-looking-but-healthy panel.
 *
 * `outageRiskScore` and `aiAnomalyScore` arrive from the source and are copied,
 * not computed. They do not become event confidences: a risk score is a rating of
 * an asset, and a confidence is a model's belief about its own output. Presenting
 * one as the other would let an operator read "0.82 risk" as "82% sure".
 */

import type { DataError, SourceMeta } from '../../shared/dataState';
import type { Severity, UtilityNode } from '../../types';
import { arkaStore } from '../ArkaStore';
import { utilityHealth, type UtilityEntity } from '../entities';
import { toneForSeverity, type ArkaEventInput } from '../events';
import type { FeedDefinition, FeedOutcome } from '../transport';
import { asArray, asRecord, coords, dataStateOf, isoOr, num, oneOf, optStr, str } from './coerce';
import { ChangeTracker } from './transitions';

export const UTILITY_FEED_ID = 'utilities';

const UTILITY_SOURCE: SourceMeta = {
  provider: 'Utility SCADA gateway (via ARKA server)',
  kind: 'observation',
  note: 'Asset load and status as published by the configured SCADA gateway. Risk and anomaly scores are supplied by the source; ARKA does not compute them.',
  cadenceSeconds: 90,
};

const CADENCE_SECONDS = 90;

const UTILITY_TYPES = [
  'POWER_SUBSTATION',
  'WATER_PUMP',
  'GAS_PIPELINE',
  'STREET_LIGHT_GRID',
  'TELECOM_TOWER',
  'SMART_METER_HUB',
] as const;

const UTILITY_STATUSES = ['NORMAL', 'WARNING', 'CRITICAL_OUTAGE', 'MAINTENANCE'] as const;

const tracker = new ChangeTracker<UtilityNode['status']>();

export function createUtilityFeed(): FeedDefinition {
  return {
    id: UTILITY_FEED_ID,
    label: 'Utilities — grid and network assets',
    source: UTILITY_SOURCE,
    cadenceSeconds: CADENCE_SECONDS,
    transports: [{ kind: 'poll', url: '/api/utilities/live' }],
    handler: handleUtilities,
    onUnavailable: clearUtilities,
  };
}

/**
 * Severity of a utility state.
 *
 * MAINTENANCE is graded LOW rather than left null: planned work still removes an
 * asset from service, and an operator routing around a de-energised substation
 * needs it in the list — just not at the top of it.
 */
function severityForStatus(status: UtilityNode['status']): Severity | null {
  switch (status) {
    case 'CRITICAL_OUTAGE':
      return 'CRITICAL';
    case 'WARNING':
      return 'MEDIUM';
    case 'MAINTENANCE':
      return 'LOW';
    case 'NORMAL':
      return null;
  }
}

function handleUtilities(payload: unknown, ctx: { receivedAt: string }): FeedOutcome {
  const root = asRecord(payload);
  const declared = dataStateOf(root.classification, 'UNAVAILABLE');

  if (root.success !== true || declared === 'UNAVAILABLE') {
    const reason = str(
      root.unavailableReason,
      'No utility SCADA gateway is connected.'
    );
    const error: DataError = {
      code: 'SOURCE_UNAVAILABLE',
      message: reason,
      requiredIntegration: 'Utility SCADA Modbus telemetry gateway',
    };
    clearUtilities(error);
    return { count: 0, unavailable: error };
  }

  const entities: UtilityEntity[] = [];
  const events: ArkaEventInput[] = [];
  const ids = new Set<string>();

  for (const raw of asArray(root.utilities).map(asRecord)) {
    const id = optStr(raw.id);
    if (!id) continue;
    ids.add(id);

    const status = oneOf(raw.status, UTILITY_STATUSES, 'NORMAL');
    const position = coords(raw);
    const observedAt = isoOr(asRecord(raw.provenance).timestamp, ctx.receivedAt);

    const utility: UtilityNode = {
      id,
      name: str(raw.name, id),
      type: oneOf(raw.type, UTILITY_TYPES, 'POWER_SUBSTATION'),
      lat: position?.lat ?? 0,
      lng: position?.lng ?? 0,
      gridZone: str(raw.gridZone, ''),
      capacityMetric: str(raw.capacityMetric, ''),
      currentLoadPct: num(raw.currentLoadPct, 0),
      status,
      outageRiskScore: num(raw.outageRiskScore, 0),
      aiAnomalyScore: num(raw.aiAnomalyScore, 0),
    };

    const entity: UtilityEntity = {
      id,
      kind: 'utility',
      label: utility.name,
      observedAt,
      state: declared,
      source: UTILITY_SOURCE,
      position,
      health: utilityHealth(status),
      severity: severityForStatus(status),
      // The payload carries no incident or corridor id. A substation is not
      // linked to an outage report unless the source says it is.
      related: [],
      data: utility,
    };
    entities.push(entity);

    const event = utilityEvent(entity, observedAt, declared);
    if (event) events.push(event);
  }

  tracker.retain(ids);

  arkaStore.batch(() => {
    arkaStore.replaceKind('utility', entities);
    if (events.length > 0) arkaStore.emit(events);
  });

  return { count: entities.length, state: declared };
}

/**
 * An event on status transition.
 *
 * First sight announces anything that is not NORMAL, for the same reason the
 * traffic feed announces an already-jammed corridor: walking into a live outage
 * is exactly when the operator needs to be told about it.
 */
function utilityEvent(
  entity: UtilityEntity,
  observedAt: string,
  state: UtilityEntity['state']
): ArkaEventInput | null {
  const utility = entity.data;
  const before = tracker.observe(entity.id, utility.status);

  if (before === undefined) {
    if (utility.status === 'NORMAL') return null;
  } else if (before === utility.status) {
    return null;
  }

  const restored = utility.status === 'NORMAL';
  const readableType = utility.type.replace(/_/g, ' ').toLowerCase();

  return {
    id: `utility-${entity.id}-${utility.status}-${observedAt}`,
    at: observedAt,
    kind: 'UTILITY_EVENT',
    tone: restored ? 'resolved' : toneForSeverity(entity.severity),
    severity: entity.severity,
    title: restored
      ? `${utility.name} restored to normal`
      : `${utility.name} — ${utility.status.replace(/_/g, ' ').toLowerCase()}`,
    detail:
      `${readableType} in ${utility.gridZone || 'an unreported grid zone'}` +
      (utility.capacityMetric ? `, rated ${utility.capacityMetric}` : '') +
      `. Load ${utility.currentLoadPct}%` +
      (before !== undefined ? `. Previously ${before.replace(/_/g, ' ').toLowerCase()}.` : '.'),
    provider: UTILITY_SOURCE.provider,
    state,
    subjects: [{ kind: 'utility', id: entity.id }],
    position: entity.position,
    // The source's `aiAnomalyScore` rates the asset, not a model's belief about
    // this event. It is reported below as a signal instead.
    confidence: null,
    sourceSignals: [
      `load ${utility.currentLoadPct}% of ${utility.capacityMetric || 'rated capacity'}`,
      `outage risk score ${utility.outageRiskScore} (source-supplied)`,
      `anomaly score ${utility.aiAnomalyScore} (source-supplied)`,
    ],
  };
}

/** Drops every asset. A grid ARKA cannot see is not a grid ARKA can draw. */
function clearUtilities(_error: DataError): void {
  tracker.clear();
  if (arkaStore.getEntities().utility.length > 0) {
    arkaStore.replaceKind('utility', []);
  }
}
