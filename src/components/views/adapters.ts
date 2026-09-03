/**
 * Entity envelopes for the views that are still fed by props.
 *
 * `AssetCard` takes an `EntityEnvelope` and nothing else, deliberately: a page
 * cannot render an asset without saying where the asset came from. Most modules
 * satisfy that by reading the store, but two do not yet — `src/store/ingest/`
 * has no feed for the facility register or for drone telemetry, so
 * `InfrastructureView` and `DroneFeedView` receive plain `LandmarkNode[]` and
 * `DroneUnit[]` from `App`.
 *
 * Rather than let each of those pages invent its own mapping (the brief forbids
 * two versions of the same component, and a per-page provenance string is the
 * same problem wearing different clothes), the mapping lives here once. When a
 * real feed appears, these functions are what it replaces.
 *
 * Both sources are static fixtures compiled into the bundle, so both are labelled
 * honestly and neither claims an observation time it does not have:
 *
 * - Landmarks are `SEED`: real facilities at real coordinates, but a register
 *   ARKA carries rather than a reading it took.
 * - Drone telemetry is `SIMULATED`: `App` decrements the battery on a timer. No
 *   aircraft is transmitting any of it.
 *
 * `observedAt` is left empty in both cases, which renders NO TIMESTAMP. That is
 * the point — a fixture has no observation moment, and stamping `Date.now()` on
 * it would make a compiled constant look like a fresh reading.
 */

import type { SourceMeta } from '../../shared/dataState';
import type { DroneUnit, LandmarkNode } from '../../types';
import { droneHealth, landmarkHealth, type EntityEnvelope } from '../../store/entities';

/**
 * Provenance for the facility register.
 *
 * `kind: 'reference'` — the coordinates and names are correct, but nothing here
 * is a measurement, and the operational status is not telemetry.
 */
export const FACILITY_REGISTER_SOURCE: SourceMeta = {
  provider: 'ARKA facility register',
  kind: 'reference',
  note: 'Static register of city facilities compiled into the build. Positions and names are reference data; the status field is not live telemetry from the asset.',
};

export const DRONE_FIXTURE_SOURCE: SourceMeta = {
  provider: 'ARKA demo fixture',
  kind: 'reference',
  note: 'Locally generated flight telemetry. No MAVLink, DroneKit or RTSP link is configured, so no aircraft is reporting any of these values.',
};

/**
 * One facility as an entity.
 *
 * `severity` stays null: a landmark record grades operational status, not
 * severity, and the envelope's rule is that severity is present only where the
 * domain genuinely grades it. An asset in ALERT reads as a critical health dot,
 * which is what the register actually supports.
 */
export function landmarkEnvelope(landmark: LandmarkNode): EntityEnvelope {
  return {
    id: landmark.id,
    kind: 'infrastructure',
    label: landmark.name,
    observedAt: '',
    state: 'SEED',
    source: FACILITY_REGISTER_SOURCE,
    position: { lat: landmark.lat, lng: landmark.lng },
    health: landmarkHealth(landmark.status),
    severity: null,
    related: [],
  };
}

export function landmarkEnvelopes(landmarks: readonly LandmarkNode[]): EntityEnvelope[] {
  return landmarks.map(landmarkEnvelope);
}

/** One aircraft as an entity. Battery and status decide the health roll-up. */
export function droneEnvelope(drone: DroneUnit): EntityEnvelope {
  return {
    id: drone.id,
    kind: 'drone',
    label: drone.callsign,
    observedAt: '',
    state: 'SIMULATED',
    source: DRONE_FIXTURE_SOURCE,
    position: { lat: drone.lat, lng: drone.lng },
    health: droneHealth(drone.status, drone.battery),
    severity: null,
    related: [],
  };
}

export function droneEnvelopes(drones: readonly DroneUnit[]): EntityEnvelope[] {
  return drones.map(droneEnvelope);
}
