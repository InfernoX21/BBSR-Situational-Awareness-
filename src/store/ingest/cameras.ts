/**
 * Camera ingestion.
 *
 * `/api/cctv/streams` publishes the CCTV estate and whatever the configured
 * analytics engine reports against each feed. In production the endpoint answers
 * that BSCL's RTSP feeds need on-premise integration and returns nothing; in demo
 * mode it returns labelled fixtures. Both land here through the same path, and
 * the `state` on every record is what the source declared — so a view can render
 * a camera tile without having to decide for itself whether a picture exists.
 *
 * Two event kinds come out of this feed, because two different things happen to a
 * camera. A rising anomaly count is a *detection* — the analytics engine saw
 * something. A camera dropping off the network is an *asset* event — nothing was
 * seen, which is the opposite claim. Collapsing them into one kind would let a
 * dead camera read as a quiet one.
 *
 * `detectedVehicles`, `detectedPedestrians` and `anomaliesDetected` are counts
 * from the engine named in `model`. This module copies them; it does not add to
 * them, average them, or decorate them with a confidence the engine did not
 * report.
 */

import type { DataError, SourceMeta } from '../../shared/dataState';
import type { CameraNode } from '../../types';
import { arkaStore } from '../ArkaStore';
import { cameraHealth, type CameraEntity } from '../entities';
import type { ArkaEventInput } from '../events';
import type { FeedDefinition, FeedOutcome } from '../transport';
import { asArray, asRecord, coords, dataStateOf, isoOr, num, oneOf, optStr, str } from './coerce';
import { ChangeTracker } from './transitions';

export const CAMERA_FEED_ID = 'cameras';

const CAMERA_SOURCE: SourceMeta = {
  provider: 'BSCL CCTV estate (via ARKA server)',
  kind: 'observation',
  note: 'Camera positions and analytics counts as published by the configured stream gateway. Detection counts come from the engine named on each camera; ARKA does not run its own inference over these feeds.',
  cadenceSeconds: 45,
};

const CADENCE_SECONDS = 45;

const CAMERA_STATUSES = ['ONLINE', 'ALERT', 'OFFLINE'] as const;

interface CameraSnapshot {
  status: CameraNode['status'];
  anomalies: number;
}

const tracker = new ChangeTracker<CameraSnapshot>();

export function createCameraFeed(): FeedDefinition {
  return {
    id: CAMERA_FEED_ID,
    label: 'Cameras — CCTV and analytics',
    source: CAMERA_SOURCE,
    cadenceSeconds: CADENCE_SECONDS,
    transports: [{ kind: 'poll', url: '/api/cctv/streams' }],
    handler: handleCameras,
    onUnavailable: clearCameras,
  };
}

function handleCameras(payload: unknown, ctx: { receivedAt: string }): FeedOutcome {
  const root = asRecord(payload);
  const declared = dataStateOf(root.classification, 'UNAVAILABLE');

  if (root.success !== true || declared === 'UNAVAILABLE') {
    const reason = str(root.unavailableReason, 'No camera stream gateway is connected.');
    const error: DataError = {
      code: 'SOURCE_UNAVAILABLE',
      message: reason,
      requiredIntegration: 'BSCL RTSP camera stream gateway',
    };
    clearCameras(error);
    return { count: 0, unavailable: error };
  }

  const entities: CameraEntity[] = [];
  const events: ArkaEventInput[] = [];
  const ids = new Set<string>();

  for (const raw of asArray(root.cameras).map(asRecord)) {
    const id = optStr(raw.id);
    if (!id) continue;
    ids.add(id);

    const status = oneOf(raw.status, CAMERA_STATUSES, 'OFFLINE');
    const position = coords(raw);
    const anomalies = num(raw.anomaliesDetected, 0);
    const observedAt = isoOr(raw.lastUpdate, ctx.receivedAt);

    const camera: CameraNode = {
      id,
      name: str(raw.name, id),
      locationName: str(raw.locationName, ''),
      lat: position?.lat ?? 0,
      lng: position?.lng ?? 0,
      status,
      direction: str(raw.direction, ''),
      fovAngle: num(raw.fovAngle, 0),
      model: str(raw.model, 'Not reported'),
      detectedVehicles: num(raw.detectedVehicles, 0),
      detectedPedestrians: num(raw.detectedPedestrians, 0),
      anomaliesDetected: anomalies,
      lastUpdate: str(raw.lastUpdate, ''),
      streamUrl: optStr(raw.streamUrl) ?? undefined,
      thumbnailUrl: optStr(raw.thumbnailUrl) ?? undefined,
      clusterGroup: optStr(raw.clusterGroup) ?? undefined,
    };

    const entity: CameraEntity = {
      id,
      kind: 'camera',
      label: camera.name,
      observedAt,
      state: declared,
      source: CAMERA_SOURCE,
      position,
      health: cameraHealth(status),
      // A camera is not graded. The thing it detects might be, but that grading
      // belongs to the incident raised from it, not to the lens.
      severity: null,
      // No join exists in the payload: cameras carry a `clusterGroup`, not a
      // corridor or incident id. Linking by proximity would invent a relationship
      // the source never asserted.
      related: [],
      data: camera,
    };
    entities.push(entity);

    const before = tracker.observe(id, { status, anomalies });
    events.push(...cameraEvents(entity, before, observedAt, declared));
  }

  tracker.retain(ids);

  arkaStore.batch(() => {
    arkaStore.replaceKind('camera', entities);
    if (events.length > 0) arkaStore.emit(events);
  });

  return { count: entities.length, state: declared };
}

function cameraEvents(
  entity: CameraEntity,
  before: CameraSnapshot | undefined,
  observedAt: string,
  state: CameraEntity['state']
): ArkaEventInput[] {
  const camera = entity.data;
  const out: ArkaEventInput[] = [];

  // --- Detections ----------------------------------------------------------
  //
  // Only the increase is announced. On first sight the running total is adopted
  // silently: a camera that has logged three anomalies since before the operator
  // arrived has not just logged them, and replaying them as fresh detections
  // would misdate the incident picture.
  const delta = before === undefined ? 0 : camera.anomaliesDetected - before.anomalies;
  if (delta > 0) {
    out.push({
      id: `camera-detect-${entity.id}-${camera.anomaliesDetected}-${observedAt}`,
      at: observedAt,
      kind: 'CAMERA_DETECTION',
      tone: camera.status === 'ALERT' ? 'high' : 'medium',
      severity: camera.status === 'ALERT' ? 'HIGH' : null,
      title: `${camera.name} — ${delta} new ${delta === 1 ? 'anomaly' : 'anomalies'}`,
      detail:
        `${camera.locationName || camera.name}, facing ${camera.direction || 'an unreported bearing'}. ` +
        `Reported by ${camera.model}. Running totals: ${camera.detectedVehicles} vehicles, ` +
        `${camera.detectedPedestrians} pedestrians, ${camera.anomaliesDetected} anomalies.`,
      provider: CAMERA_SOURCE.provider,
      state,
      subjects: [{ kind: 'camera', id: entity.id }],
      position: entity.position,
      // The endpoint reports counts, not per-detection scores. Nothing to put here.
      confidence: null,
      sourceSignals: [
        `anomaly count ${before?.anomalies ?? 0} → ${camera.anomaliesDetected}`,
        `analytics engine ${camera.model}`,
        `vehicles ${camera.detectedVehicles}`,
        `pedestrians ${camera.detectedPedestrians}`,
      ],
    });
  }

  // --- Asset availability --------------------------------------------------
  //
  // First sight announces a camera that is already down, because an operator
  // planning around a blind spot needs to know it is blind.
  const statusChanged = before !== undefined && before.status !== camera.status;
  const firstSightDown = before === undefined && camera.status === 'OFFLINE';

  if (firstSightDown || (statusChanged && (camera.status === 'OFFLINE' || before?.status === 'OFFLINE'))) {
    const recovered = camera.status !== 'OFFLINE';
    out.push({
      id: `camera-status-${entity.id}-${camera.status}-${observedAt}`,
      at: observedAt,
      kind: 'INFRASTRUCTURE_EVENT',
      tone: recovered ? 'resolved' : 'medium',
      severity: null,
      title: recovered
        ? `${camera.name} back online`
        : `${camera.name} offline — no coverage at ${camera.locationName || 'this location'}`,
      detail: recovered
        ? `${camera.name} is reporting again.`
        : `${camera.name} stopped reporting. Nothing is being observed at ${camera.locationName || 'this location'}; treat the area as uncovered rather than clear.`,
      provider: CAMERA_SOURCE.provider,
      state,
      subjects: [{ kind: 'camera', id: entity.id }],
      position: entity.position,
      confidence: null,
      sourceSignals: [`camera status ${before?.status ?? 'unknown'} → ${camera.status}`],
    });
  }

  return out;
}

/**
 * Empties the camera estate.
 *
 * Deliberately removes the markers rather than leaving them grey: a marker on the
 * map is a claim that ARKA knows something about that point, and with the gateway
 * down it does not. The camera view renders its own "integration required" state
 * from the empty bucket and the feed's error.
 */
function clearCameras(_error: DataError): void {
  tracker.clear();
  if (arkaStore.getEntities().camera.length > 0) {
    arkaStore.replaceKind('camera', []);
  }
}
