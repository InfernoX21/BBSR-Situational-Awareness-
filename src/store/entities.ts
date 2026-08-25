/**
 * Canonical entity model for the central store.
 *
 * Before this file existed, each module carried its own copy of the city: the
 * dashboard had incidents, the resource page had units, the map had markers, and
 * nothing could tell you that unit POL-INT-01 was the one assigned to INC-002.
 * Everything that ARKA knows about now lands here first, under one identity.
 *
 * Two rules hold the model together.
 *
 * 1. **One envelope, one identity.** Every record carries the same envelope —
 *    id, kind, when it was observed, where it is, and what state that knowledge
 *    is in. Modules join on `EntityRef`, never on a name or an array index.
 *
 * 2. **Provenance is not optional.** `state` and `source` sit in the envelope
 *    rather than in an optional field, so it is not possible to add an entity
 *    without saying where it came from. A record with no approved upstream
 *    source is `UNAVAILABLE` and carries no data — it is never a plausible
 *    placeholder. This is the same contract `shared/dataState.ts` enforces for
 *    scalar feeds, applied to entities.
 */

import type { DataState, SourceMeta } from '../shared/dataState';
import type {
  CameraNode,
  DroneUnit,
  FieldUnit,
  Incident,
  IntelligenceItem,
  LandmarkNode,
  Severity,
  TrafficCorridor,
  TrafficSensor,
  UtilityNode,
  WeatherData,
} from '../types';

/** Every kind of thing the platform tracks. */
export type EntityKind =
  | 'incident'
  | 'resource'
  | 'drone'
  | 'camera'
  | 'sensor'
  | 'infrastructure'
  | 'intelligence'
  | 'weather'
  | 'utility'
  | 'corridor';

/**
 * A pointer to another entity.
 *
 * Deliberately a value type rather than an object graph: entities are replaced
 * wholesale on every feed tick, so holding a direct reference would pin a stale
 * copy. Resolve refs through the store at read time.
 */
export interface EntityRef {
  kind: EntityKind;
  id: string;
}

export function refKey(ref: EntityRef): string {
  return `${ref.kind}:${ref.id}`;
}

export function sameRef(a: EntityRef | null, b: EntityRef | null): boolean {
  if (!a || !b) return a === b;
  return a.kind === b.kind && a.id === b.id;
}

/** Geographic position. Null for entities with no meaningful location. */
export interface EntityPosition {
  lat: number;
  lng: number;
}

/**
 * How an entity relates to the operational picture right now.
 *
 * Domain statuses ('PATROLLING', 'CRITICAL_OUTAGE', 'DISPATCHED') stay on the
 * payload where they belong. This is the coarse roll-up every module can render
 * without knowing the domain — the colour of the dot, essentially.
 */
export type EntityHealth =
  /** Working, nothing to report. */
  | 'nominal'
  /** Working, but something needs an operator's attention. */
  | 'attention'
  /** Actively degraded, failing, or the subject of a live incident. */
  | 'critical'
  /** Not reporting. Distinct from nominal: absence of alarm is not health. */
  | 'offline'
  /** Finished, closed, or stood down. */
  | 'resolved';

export interface EntityEnvelope {
  /** Stable across feed ticks. Modules join on this. */
  id: string;
  kind: EntityKind;
  /** Operator-facing name. Never a raw id. */
  label: string;
  /** When the underlying observation was made, ISO 8601. */
  observedAt: string;
  /** Honesty state of this record, from the shared data-state contract. */
  state: DataState;
  source: SourceMeta;
  position: EntityPosition | null;
  health: EntityHealth;
  /** Present only where the domain genuinely grades severity. */
  severity: Severity | null;
  /**
   * Cross-module links. Populated by the ingestion layer from real joins
   * (assignment records, spatial containment, corridor membership) — never by
   * guessing that two things near each other must be related.
   */
  related: EntityRef[];
}

/** Envelope plus the domain payload, discriminated on `kind`. */
export interface EntityRecord<K extends EntityKind, P> extends EntityEnvelope {
  kind: K;
  data: P;
}

export type IncidentEntity = EntityRecord<'incident', Incident>;
export type ResourceEntity = EntityRecord<'resource', FieldUnit>;
export type DroneEntity = EntityRecord<'drone', DroneUnit>;
export type CameraEntity = EntityRecord<'camera', CameraNode>;
export type SensorEntity = EntityRecord<'sensor', TrafficSensor>;
export type InfrastructureEntity = EntityRecord<'infrastructure', LandmarkNode>;
export type IntelligenceEntity = EntityRecord<'intelligence', IntelligenceItem>;
export type WeatherEntity = EntityRecord<'weather', WeatherData>;
export type UtilityEntity = EntityRecord<'utility', UtilityNode>;
export type CorridorEntity = EntityRecord<'corridor', TrafficCorridor>;

export type AnyEntity =
  | IncidentEntity
  | ResourceEntity
  | DroneEntity
  | CameraEntity
  | SensorEntity
  | InfrastructureEntity
  | IntelligenceEntity
  | WeatherEntity
  | UtilityEntity
  | CorridorEntity;

/** Maps a kind to its record type, so selectors can stay typed. */
export interface EntityByKind {
  incident: IncidentEntity;
  resource: ResourceEntity;
  drone: DroneEntity;
  camera: CameraEntity;
  sensor: SensorEntity;
  infrastructure: InfrastructureEntity;
  intelligence: IntelligenceEntity;
  weather: WeatherEntity;
  utility: UtilityEntity;
  corridor: CorridorEntity;
}

/** Operator-facing names for each kind, singular then plural. */
export const ENTITY_KIND_LABEL: Record<EntityKind, { one: string; many: string }> = {
  incident: { one: 'Incident', many: 'Incidents' },
  resource: { one: 'Field unit', many: 'Field units' },
  drone: { one: 'Drone', many: 'Drones' },
  camera: { one: 'Camera', many: 'Cameras' },
  sensor: { one: 'Sensor', many: 'Sensors' },
  infrastructure: { one: 'Infrastructure asset', many: 'Infrastructure assets' },
  intelligence: { one: 'Intelligence item', many: 'Intelligence items' },
  weather: { one: 'Weather observation', many: 'Weather observations' },
  utility: { one: 'Utility asset', many: 'Utility assets' },
  corridor: { one: 'Traffic corridor', many: 'Traffic corridors' },
};

// --- Health derivation -------------------------------------------------------
//
// Each domain maps its own status vocabulary onto EntityHealth exactly once,
// here, so a "critical" dot means the same thing on the map, the dashboard and
// the tracker. Anything unrecognised becomes 'attention' rather than 'nominal':
// an unknown status is a reason to look, not a reason to relax.

export function incidentHealth(status: Incident['status'], priority: Severity): EntityHealth {
  if (status === 'RESOLVED') return 'resolved';
  if (status === 'CONTAINED') return 'attention';
  return priority === 'CRITICAL' || priority === 'HIGH' ? 'critical' : 'attention';
}

export function landmarkHealth(status: LandmarkNode['status']): EntityHealth {
  switch (status) {
    case 'OPERATIONAL':
      return 'nominal';
    case 'ALERT':
      return 'critical';
    case 'MAINTENANCE':
      return 'attention';
    default:
      return 'attention';
  }
}

export function utilityHealth(status: UtilityNode['status']): EntityHealth {
  switch (status) {
    case 'NORMAL':
      return 'nominal';
    case 'WARNING':
      return 'attention';
    case 'CRITICAL_OUTAGE':
      return 'critical';
    case 'MAINTENANCE':
      return 'attention';
    default:
      return 'attention';
  }
}

export function cameraHealth(status: CameraNode['status']): EntityHealth {
  switch (status) {
    case 'ONLINE':
      return 'nominal';
    case 'ALERT':
      return 'critical';
    case 'OFFLINE':
      return 'offline';
    default:
      return 'attention';
  }
}

export function sensorHealth(status: TrafficSensor['status']): EntityHealth {
  switch (status) {
    case 'ONLINE':
      return 'nominal';
    case 'ALERT':
      return 'critical';
    case 'OFFLINE':
      return 'offline';
    default:
      return 'attention';
  }
}

export function corridorHealth(level: TrafficCorridor['congestionLevel']): EntityHealth {
  switch (level) {
    case 'CLEAR':
      return 'nominal';
    case 'SLOW':
      return 'attention';
    case 'JAMMED':
    case 'SEVERE':
      return 'critical';
    default:
      return 'attention';
  }
}

export function droneHealth(status: DroneUnit['status'], battery: number): EntityHealth {
  if (battery <= 15) return 'critical';
  if (status === 'CHARGING') return 'offline';
  if (status === 'DISPATCHED') return 'attention';
  return 'nominal';
}

export function fieldUnitHealth(status: FieldUnit['status']): EntityHealth {
  switch (status) {
    case 'AVAILABLE':
      return 'nominal';
    case 'ASSIGNED':
    case 'EN_ROUTE':
    case 'ACTIVE':
      return 'attention';
    case 'RETURNING':
      return 'resolved';
    case 'OFFLINE':
      return 'offline';
    default:
      return 'attention';
  }
}

/** Congestion grade a corridor's severity, for ranking alongside incidents. */
export function corridorSeverity(level: TrafficCorridor['congestionLevel']): Severity | null {
  switch (level) {
    case 'SEVERE':
      return 'CRITICAL';
    case 'JAMMED':
      return 'HIGH';
    case 'SLOW':
      return 'MEDIUM';
    case 'CLEAR':
      return null;
    default:
      return null;
  }
}

/** Rank order for sorting mixed entity lists worst-first. */
export const HEALTH_RANK: Record<EntityHealth, number> = {
  critical: 0,
  attention: 1,
  offline: 2,
  nominal: 3,
  resolved: 4,
};

export const SEVERITY_RANK: Record<Severity, number> = {
  CRITICAL: 0,
  HIGH: 1,
  MEDIUM: 2,
  LOW: 3,
};

/**
 * True when a record may be presented as current operational truth.
 *
 * Used by anything that aggregates — a count of "active incidents" must not
 * silently include demo fixtures. Callers that legitimately want everything
 * (the incident list, say, which labels each row) simply don't call this.
 */
export function isOperational(entity: EntityEnvelope): boolean {
  return entity.state === 'LIVE' || entity.state === 'CACHED';
}
