/**
 * Traffic ingestion: corridors and roadside sensors.
 *
 * Two entity kinds come out of one payload, and they are joined to each other
 * here rather than in the views — sensors carry a `corridorId`, so the corridor
 * gains links to its sensors and each sensor links back. That join is real
 * configuration from the source, not proximity guesswork.
 *
 * **Geometry is not touched.** Corridors arrive with surveyed junction
 * `waypoints` and an empty `path` marked `UNRESOLVED`. This module copies both
 * verbatim. Drawable geometry is the routing engine's output, resolved from
 * published road segments; interpolating between anchors here would put a
 * straight line across whatever lies between two junctions, which is exactly the
 * fake-route failure the routing architecture exists to prevent.
 */

import type { DataError, SourceMeta } from '../../shared/dataState';
import type { TrafficCorridor, TrafficSensor } from '../../types';
import { arkaStore } from '../ArkaStore';
import {
  corridorHealth,
  corridorSeverity,
  sensorHealth,
  type CorridorEntity,
  type EntityRef,
  type SensorEntity,
} from '../entities';
import { toneForSeverity, type ArkaEventInput } from '../events';
import type { FeedDefinition, FeedOutcome } from '../transport';
import { asArray, asRecord, coords, dataStateOf, isoOr, latLngPairs, num, oneOf, optStr, str } from './coerce';
import { ChangeTracker } from './transitions';

export const TRAFFIC_FEED_ID = 'traffic';

const TRAFFIC_SOURCE: SourceMeta = {
  provider: 'BSCL traffic speed gateway (via ARKA server)',
  kind: 'observation',
  note: 'Corridor speeds and vehicle counts as published by the configured traffic gateway. Junction anchors are surveyed reference points; drawable road geometry is resolved separately by the routing engine.',
  cadenceSeconds: 60,
};

const CADENCE_SECONDS = 60;

const CONGESTION_LEVELS = ['CLEAR', 'SLOW', 'JAMMED', 'SEVERE'] as const;
const TRENDS = ['IMPROVING', 'STABLE', 'WORSENING'] as const;
const PATH_STATUSES = ['UNRESOLVED', 'RESOLVING', 'ROAD_NETWORK', 'PARTIAL', 'NO_ROUTE'] as const;
const SENSOR_STATUSES = ['ONLINE', 'ALERT', 'OFFLINE'] as const;

const corridorTracker = new ChangeTracker<TrafficCorridor['congestionLevel']>();
const sensorTracker = new ChangeTracker<TrafficSensor['status']>();

export function createTrafficFeed(): FeedDefinition {
  return {
    id: TRAFFIC_FEED_ID,
    label: 'Traffic — corridors and sensors',
    source: TRAFFIC_SOURCE,
    cadenceSeconds: CADENCE_SECONDS,
    transports: [{ kind: 'poll', url: '/api/traffic/live' }],
    handler: handleTraffic,
    onUnavailable: clearTraffic,
  };
}

function handleTraffic(payload: unknown, ctx: { receivedAt: string }): FeedOutcome {
  const root = asRecord(payload);
  const declared = dataStateOf(root.classification, 'UNAVAILABLE');

  if (root.success !== true || declared === 'UNAVAILABLE') {
    const reason = str(
      root.unavailableReason,
      'The traffic gateway reported no corridor or sensor data.'
    );
    const error: DataError = {
      code: 'SOURCE_UNAVAILABLE',
      message: reason,
      requiredIntegration: 'BSCL traffic speed radar gateway',
    };
    clearTraffic(error);
    return { count: 0, unavailable: error };
  }

  // Sensors are grouped first so each corridor can carry links to the sensors
  // measuring it — a join the source supports through `corridorId`.
  const rawSensors = asArray(root.sensors).map(asRecord);
  const sensorsByCorridor = new Map<string, EntityRef[]>();
  for (const raw of rawSensors) {
    const id = optStr(raw.id);
    const corridorId = optStr(raw.corridorId);
    if (!id || !corridorId) continue;
    const list = sensorsByCorridor.get(corridorId) ?? [];
    list.push({ kind: 'sensor', id });
    sensorsByCorridor.set(corridorId, list);
  }

  const events: ArkaEventInput[] = [];
  const corridors: CorridorEntity[] = [];
  const corridorIds = new Set<string>();

  for (const raw of asArray(root.corridors).map(asRecord)) {
    const id = optStr(raw.id);
    if (!id) continue;
    corridorIds.add(id);

    const level = oneOf(raw.congestionLevel, CONGESTION_LEVELS, 'CLEAR');
    const waypoints = latLngPairs(raw.waypoints);
    const observedAt = isoOr(raw.observedAt, ctx.receivedAt);

    const corridor: TrafficCorridor = {
      id,
      name: str(raw.name, id),
      roadName: str(raw.roadName, ''),
      waypoints,
      // Copied, never derived. An empty path stays empty.
      path: latLngPairs(raw.path),
      pathStatus: oneOf(raw.pathStatus, PATH_STATUSES, 'UNRESOLVED'),
      pathLengthM: typeof raw.pathLengthM === 'number' ? raw.pathLengthM : null,
      pathNote: optStr(raw.pathNote) ?? undefined,
      avgSpeedKmh: num(raw.avgSpeedKmh, 0),
      freeFlowSpeedKmh: num(raw.freeFlowSpeedKmh, 0),
      congestionLevel: level,
      congestionScore: num(raw.congestionScore, 0),
      vehicleCount: num(raw.vehicleCount, 0),
      trend: oneOf(raw.trend, TRENDS, 'STABLE'),
      activeIncidentId: optStr(raw.activeIncidentId) ?? undefined,
      updatedAt: str(raw.updatedAt, ''),
    };

    const related: EntityRef[] = [...(sensorsByCorridor.get(id) ?? [])];
    if (corridor.activeIncidentId) {
      related.push({ kind: 'incident', id: corridor.activeIncidentId });
    }

    // The midpoint anchor rather than a computed centroid: it is an actual
    // surveyed junction, so "locate" puts the operator on a real place.
    const anchor = waypoints.length > 0 ? waypoints[Math.floor(waypoints.length / 2)] : null;

    corridors.push({
      id,
      kind: 'corridor',
      label: corridor.name,
      observedAt,
      state: declared,
      source: TRAFFIC_SOURCE,
      position: anchor ? { lat: anchor[0], lng: anchor[1] } : null,
      health: corridorHealth(level),
      severity: corridorSeverity(level),
      related,
      data: corridor,
    });

    const event = corridorEvent(corridors[corridors.length - 1], observedAt, declared);
    if (event) events.push(event);
  }

  const sensors: SensorEntity[] = [];
  const sensorIds = new Set<string>();

  for (const raw of rawSensors) {
    const id = optStr(raw.id);
    if (!id) continue;
    sensorIds.add(id);

    const status = oneOf(raw.status, SENSOR_STATUSES, 'OFFLINE');
    const position = coords(raw);
    const observedAt = isoOr(raw.observedAt, ctx.receivedAt);
    const corridorId = optStr(raw.corridorId);

    const sensor: TrafficSensor = {
      id,
      name: str(raw.name, id),
      lat: position?.lat ?? 0,
      lng: position?.lng ?? 0,
      speed: num(raw.speed, 0),
      status,
      vehicleRatePerMin: num(raw.vehicleRatePerMin, 0),
      corridorId: corridorId ?? '',
    };

    sensors.push({
      id,
      kind: 'sensor',
      label: sensor.name,
      observedAt,
      state: declared,
      source: TRAFFIC_SOURCE,
      position,
      health: sensorHealth(status),
      severity: null,
      related: corridorId ? [{ kind: 'corridor', id: corridorId }] : [],
      data: sensor,
    });

    const event = sensorEvent(sensors[sensors.length - 1], observedAt, declared);
    if (event) events.push(event);
  }

  corridorTracker.retain(corridorIds);
  sensorTracker.retain(sensorIds);

  arkaStore.batch(() => {
    arkaStore.replaceKind('corridor', corridors);
    arkaStore.replaceKind('sensor', sensors);
    if (events.length > 0) arkaStore.emit(events);
  });

  return { count: corridors.length + sensors.length, state: declared };
}

/**
 * A corridor event on congestion change.
 *
 * First sight only announces a corridor that is already jammed or worse — the
 * operator needs to know they have walked into a problem, but not that four
 * corridors are flowing normally.
 */
function corridorEvent(
  entity: CorridorEntity,
  observedAt: string,
  state: CorridorEntity['state']
): ArkaEventInput | null {
  const level = entity.data.congestionLevel;
  const before = corridorTracker.observe(entity.id, level);
  const notable = level === 'JAMMED' || level === 'SEVERE';

  if (before === undefined) {
    if (!notable) return null;
  } else if (before === level) {
    return null;
  }

  const easing =
    before !== undefined &&
    CONGESTION_LEVELS.indexOf(level) < CONGESTION_LEVELS.indexOf(before);

  return {
    id: `corridor-${entity.id}-${level}-${observedAt}`,
    at: observedAt,
    kind: 'TRAFFIC_ANOMALY',
    tone: easing && !notable ? 'resolved' : toneForSeverity(entity.severity),
    severity: entity.severity,
    title: `${entity.data.name} — ${level.toLowerCase()} at ${entity.data.avgSpeedKmh} km/h`,
    detail:
      `${entity.data.roadName || entity.data.name}. ` +
      `Average ${entity.data.avgSpeedKmh} km/h against a free-flow reference of ` +
      `${entity.data.freeFlowSpeedKmh} km/h, ${entity.data.vehicleCount} vehicles counted, ` +
      `trend ${entity.data.trend.toLowerCase()}` +
      (before !== undefined ? `. Previously ${before.toLowerCase()}.` : '.'),
    provider: TRAFFIC_SOURCE.provider,
    state,
    subjects: [{ kind: 'corridor', id: entity.id }, ...entity.related],
    position: entity.position,
    confidence: null,
    sourceSignals: [
      `average speed ${entity.data.avgSpeedKmh} km/h`,
      `free-flow reference ${entity.data.freeFlowSpeedKmh} km/h`,
      `vehicle count ${entity.data.vehicleCount}`,
      `congestion score ${entity.data.congestionScore}`,
    ],
  };
}

/** A sensor event when it enters or leaves an alert state. */
function sensorEvent(
  entity: SensorEntity,
  observedAt: string,
  state: SensorEntity['state']
): ArkaEventInput | null {
  const status = entity.data.status;
  const before = sensorTracker.observe(entity.id, status);

  if (before === undefined) {
    if (status === 'ONLINE') return null;
  } else if (before === status) {
    return null;
  }

  const recovered = status === 'ONLINE';

  return {
    id: `sensor-${entity.id}-${status}-${observedAt}`,
    at: observedAt,
    kind: 'SENSOR_EVENT',
    tone: recovered ? 'resolved' : status === 'ALERT' ? 'high' : 'medium',
    severity: status === 'ALERT' ? 'HIGH' : null,
    title: `${entity.data.name} — ${status.toLowerCase()}`,
    detail:
      status === 'OFFLINE'
        ? `${entity.data.name} stopped reporting. No speed or count is available for this point.`
        : `Reporting ${entity.data.speed} km/h at ${entity.data.vehicleRatePerMin} vehicles per minute.`,
    provider: TRAFFIC_SOURCE.provider,
    state,
    subjects: [{ kind: 'sensor', id: entity.id }, ...entity.related],
    position: entity.position,
    confidence: null,
    sourceSignals: [
      `spot speed ${entity.data.speed} km/h`,
      `flow ${entity.data.vehicleRatePerMin} vehicles/min`,
    ],
  };
}

/**
 * Clears both kinds.
 *
 * Corridors and sensors go together: a corridor with no sensors reporting is not
 * a corridor ARKA knows anything current about, and leaving the last speeds on
 * the map would present a picture that has stopped updating as if it had not.
 */
function clearTraffic(_error: DataError): void {
  corridorTracker.clear();
  sensorTracker.clear();
  const entities = arkaStore.getEntities();
  if (entities.corridor.length === 0 && entities.sensor.length === 0) return;
  arkaStore.batch(() => {
    arkaStore.replaceKind('corridor', []);
    arkaStore.replaceKind('sensor', []);
  });
}
