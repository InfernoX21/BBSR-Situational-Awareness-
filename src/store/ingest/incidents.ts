/**
 * Incident ingestion.
 *
 * `/api/incidents` is unlike every other endpoint here, in two ways that change
 * how it has to be handled.
 *
 * **It is not an observation.** The records live in an in-memory store on the ARKA
 * server that this application itself POSTs to. Nobody's dispatch system produced
 * them, so `SourceKind` is `operator`, and the note says plainly that no agency
 * CAD system has confirmed them. The `state` is still `LIVE` — the fetch really is
 * current — because `state` describes the freshness of the retrieval and `kind`
 * describes who is making the claim. Conflating the two is how a locally typed
 * report ends up looking like a police dispatch.
 *
 * **It has more than one writer.** The endpoint is authoritative for what it
 * holds, but an operator can raise an incident in this session before the POST
 * lands, and AI fusion can add one. `replaceKind` treats the incoming set as the
 * whole truth and would delete those on the next tick, so this feed tracks the ids
 * it owns and removes only those, leaving records it did not create alone.
 *
 * One more divergence worth stating: the endpoint labels an empty store
 * `UNAVAILABLE`. This module does not pass that through. Zero incidents is a
 * quiet city, not a broken integration, and badging the feed red when nothing is
 * on fire would train an operator to ignore the badge.
 */

import type { DataError, SourceMeta } from '../../shared/dataState';
import type { Incident, Severity } from '../../types';
import { arkaStore } from '../ArkaStore';
import { incidentHealth, type EntityRef, type IncidentEntity } from '../entities';
import { toneForSeverity, type ArkaEventInput } from '../events';
import type { FeedDefinition, FeedOutcome } from '../transport';
import { asArray, asRecord, coords, dataStateOf, isoOr, num, oneOf, optNum, optStr, str } from './coerce';
import { ChangeTracker, OwnedIds } from './transitions';

export const INCIDENT_FEED_ID = 'incidents';

const INCIDENT_SOURCE: SourceMeta = {
  provider: 'ARKA incident register',
  kind: 'operator',
  note: 'Incidents recorded in ARKA by operators and by this application. Not confirmed by an agency computer-aided dispatch system, and not a feed from police, fire or ambulance control rooms.',
  cadenceSeconds: 30,
};

const CADENCE_SECONDS = 30;

const CATEGORIES = ['TRAFFIC', 'FIRE', 'FLOOD', 'UTILITY', 'SECURITY', 'MEDICAL'] as const;
const SEVERITIES = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const;
const STATUSES = ['ACTIVE', 'DISPATCHED', 'CONTAINED', 'RESOLVED'] as const;
const ESCALATION = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const;

interface IncidentSnapshot {
  status: Incident['status'];
  priority: Severity;
}

const tracker = new ChangeTracker<IncidentSnapshot>();
const owned = new OwnedIds();

export function createIncidentFeed(): FeedDefinition {
  return {
    id: INCIDENT_FEED_ID,
    label: 'Incident register',
    source: INCIDENT_SOURCE,
    cadenceSeconds: CADENCE_SECONDS,
    transports: [{ kind: 'poll', url: '/api/incidents' }],
    handler: handleIncidents,
    onUnavailable: releaseIncidents,
  };
}

function handleIncidents(payload: unknown, ctx: { receivedAt: string }): FeedOutcome {
  const root = asRecord(payload);

  if (root.success !== true) {
    const error: DataError = {
      code: 'SOURCE_UNAVAILABLE',
      message: str(root.unavailableReason, 'The incident register did not respond with a result set.'),
    };
    releaseIncidents(error);
    return { count: 0, unavailable: error };
  }

  // The endpoint says UNAVAILABLE for an empty register. Read only as a hint that
  // the set is empty — never to downgrade a working endpoint.
  const rows = asArray(root.incidents).map(asRecord);
  const declared = rows.length > 0 ? dataStateOf(root.classification, 'LIVE') : 'LIVE';

  const entities: IncidentEntity[] = [];
  const events: ArkaEventInput[] = [];
  const ids = new Set<string>();

  for (const raw of rows) {
    const id = optStr(raw.id);
    if (!id) continue;
    ids.add(id);

    const priority = oneOf<Severity>(raw.priority, SEVERITIES, 'MEDIUM');
    const status = oneOf(raw.status, STATUSES, 'ACTIVE');
    const location = asRecord(raw.location);
    const position = coords(location);
    const observedAt = isoOr(raw.timestamp, ctx.receivedAt);

    const evidence = asArray(raw.evidenceSources).filter((s): s is string => typeof s === 'string');
    const reasoning = optStr(raw.reasoning);

    const incident: Incident = {
      id,
      category: oneOf(raw.category, CATEGORIES, 'SECURITY'),
      title: str(raw.title, id),
      priority,
      description: str(raw.description, ''),
      location: {
        name: str(location.name, ''),
        lat: position?.lat ?? 0,
        lng: position?.lng ?? 0,
        address: str(location.address, ''),
      },
      timestamp: str(raw.timestamp, observedAt),
      agencyAssigned: str(raw.agencyAssigned, 'Unassigned'),
      // Copied as sent; the register is the record of what was filed. Whether it
      // is a genuine model score is decided below, for the event only.
      aiConfidence: num(raw.aiConfidence, 0),
      recommendedAction: str(raw.recommendedAction, ''),
      status,
      affectedRoads: asArray(raw.affectedRoads).filter((r): r is string => typeof r === 'string'),
      estimatedImpact: optStr(raw.estimatedImpact) ?? undefined,
      unitsDispatched: optNum(raw.unitsDispatched) ?? undefined,
      evidenceSources: evidence,
      reasoning: reasoning ?? undefined,
      workflowStage: optStr(raw.workflowStage) as Incident['workflowStage'],
      bufferRadiusMeters: optNum(raw.bufferRadiusMeters) ?? undefined,
      escalationRisk: (optStr(raw.escalationRisk) &&
      (ESCALATION as readonly string[]).includes(String(raw.escalationRisk))
        ? (raw.escalationRisk as Incident['escalationRisk'])
        : undefined),
      estimatedResolutionMin: optNum(raw.estimatedResolutionMin) ?? undefined,
    };

    // Units the operator has assigned in this session are a real join and belong
    // on the envelope, so the map and the tracker agree about who is working what.
    const related: EntityRef[] = arkaStore
      .assignmentsForIncident(id)
      .map((assignment) => ({ kind: 'resource' as const, id: assignment.unitId }));

    const entity: IncidentEntity = {
      id,
      kind: 'incident',
      label: incident.title,
      observedAt,
      state: declared,
      source: INCIDENT_SOURCE,
      position,
      health: incidentHealth(status, priority),
      severity: priority,
      related,
      data: incident,
    };
    entities.push(entity);

    const before = tracker.observe(id, { status, priority });
    const event = incidentEvent(entity, before, observedAt, declared);
    if (event) events.push(event);
  }

  tracker.retain(ids);
  // Only ids this feed put in the store are removed. An incident raised locally
  // and not yet accepted by the register survives the tick.
  const gone = owned.reconcile(ids);

  arkaStore.batch(() => {
    arkaStore.upsert(entities);
    if (gone.length > 0) {
      arkaStore.remove(gone.map((id) => ({ kind: 'incident' as const, id })));
    }
    if (events.length > 0) arkaStore.emit(events);
  });

  return { count: entities.length, state: declared };
}

/**
 * Confidence, only where the record shows its working.
 *
 * A number on its own is not a model output — it is a number. The brief's rule is
 * that an AI result must link back to the data that produced it, so a confidence
 * is carried onto the event only when the incident also carries evidence sources
 * or reasoning. Anything else is a figure with no provenance, and belongs nowhere
 * near a field labelled "confidence".
 */
function modelConfidence(incident: Incident): number | null {
  const hasWorking = (incident.evidenceSources?.length ?? 0) > 0 || !!incident.reasoning;
  if (!hasWorking) return null;
  const score = incident.aiConfidence;
  if (!Number.isFinite(score) || score <= 0) return null;
  // The register stores 0–100; ArkaEvent.confidence is 0–1.
  return Math.min(1, score > 1 ? score / 100 : score);
}

function incidentEvent(
  entity: IncidentEntity,
  before: IncidentSnapshot | undefined,
  observedAt: string,
  state: IncidentEntity['state']
): ArkaEventInput | null {
  const incident = entity.data;
  const isNew = before === undefined;
  const statusChanged = before !== undefined && before.status !== incident.status;
  const priorityChanged = before !== undefined && before.priority !== incident.priority;

  if (!isNew && !statusChanged && !priorityChanged) return null;

  const resolved = incident.status === 'RESOLVED';
  const signals = [
    ...(incident.evidenceSources ?? []),
    `category ${incident.category}`,
    `priority ${incident.priority}`,
  ];
  if (incident.affectedRoads && incident.affectedRoads.length > 0) {
    signals.push(`affected roads: ${incident.affectedRoads.join(', ')}`);
  }

  return {
    // Keyed on the state being reported, so re-polling the same status is inert
    // even if the tracker was reset by a component remount.
    id: `incident-${entity.id}-${incident.status}-${incident.priority}`,
    at: observedAt,
    kind: isNew ? 'INCIDENT_DETECTED' : 'INCIDENT_STATUS',
    tone: resolved ? 'resolved' : toneForSeverity(incident.priority),
    severity: incident.priority,
    title: isNew
      ? `${incident.category} — ${incident.title}`
      : `${incident.title} — ${incident.status.toLowerCase()}`,
    detail:
      (incident.description || incident.title) +
      (incident.location.name ? ` Location: ${incident.location.name}.` : '') +
      ` Assigned to ${incident.agencyAssigned}.` +
      (statusChanged ? ` Status moved from ${before?.status.toLowerCase()} to ${incident.status.toLowerCase()}.` : '') +
      (priorityChanged ? ` Priority regraded from ${before?.priority} to ${incident.priority}.` : '') +
      (incident.reasoning ? ` Basis: ${incident.reasoning}` : ''),
    provider: INCIDENT_SOURCE.provider,
    state,
    subjects: [{ kind: 'incident', id: entity.id }, ...entity.related],
    position: entity.position,
    confidence: modelConfidence(incident),
    sourceSignals: signals,
  };
}

/**
 * Gives up the records this feed owns.
 *
 * Locally raised incidents are left in place: the register being unreachable does
 * not undo an operator's report, and dropping it would lose work. What goes is
 * only what came from the register, because those are the ones ARKA can no longer
 * vouch for.
 */
function releaseIncidents(_error: DataError): void {
  tracker.clear();
  const gone = owned.clear();
  if (gone.length === 0) return;
  arkaStore.remove(gone.map((id) => ({ kind: 'incident' as const, id })));
}
