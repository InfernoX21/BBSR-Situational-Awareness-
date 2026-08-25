/**
 * Route validation.
 *
 * A route is not renderable because the pathfinder returned something. It is
 * renderable because it survives these checks. The point is to make the
 * failure mode loud: an invalid route reports `ROUTE STATUS: INVALID` with the
 * reason, and the renderer draws nothing. There is no fallback geometry, because
 * a fallback line is exactly the bug this system was built to remove.
 *
 * Every check is mechanical and cheap. None of them ask a model for an opinion.
 */

import { haversineM } from './geo';
import type { RouteCheck, RouteLeg, RouteValidation, SnapPoint } from './types';

/** How far apart two legs' shared endpoint may be and still count as joined. */
export const JOINT_TOLERANCE_M = 0.5;

/**
 * Largest step allowed between consecutive vertices.
 *
 * A teleport ceiling, not a smoothness rule. Published geometry legitimately
 * contains long straight runs — the largest observed inside a single segment in
 * the sampled corridor was 169 m — so this is set far above that. Anything past
 * it means the polyline jumped rather than drove.
 */
export const MAX_VERTEX_STEP_M = 2000;

/**
 * Ceiling on how far a road route may exceed the crow-fly distance.
 *
 * Bhubaneswar's arterial grid does not produce fourfold detours. A route past
 * this is a symptom — a torn graph, a missing link road class — and it gets
 * flagged rather than quietly shown.
 */
export const MAX_DETOUR_RATIO = 4;

export interface RouteValidationInput {
  start: SnapPoint;
  end: SnapPoint;
  maxSnapDistanceM: number;
  legs: RouteLeg[];
  coordinates: [number, number][];
  lengthM: number;
  straightLineM: number;
  reachable: boolean;
  startComponent: number;
  endComponent: number;
  /**
   * Every vertex published by the segments this route traverses, keyed to six
   * decimals. Used to prove the drawn line is the city's geometry.
   */
  publishedVertexKeys: Set<string>;
}

export function vertexKey(lat: number, lng: number): string {
  return `${lat.toFixed(6)},${lng.toFixed(6)}`;
}

function fmt(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

export function validateRoute(input: RouteValidationInput): RouteValidation {
  const checks: RouteCheck[] = [];

  // 1 & 2 — both ends must actually be on the network.
  checks.push({
    id: 'start-snapped',
    label: 'Start snapped to road',
    passed: input.start.distanceM <= input.maxSnapDistanceM,
    blocking: true,
    detail:
      input.start.distanceM <= input.maxSnapDistanceM
        ? `${Math.round(input.start.distanceM)} m to ${input.start.street ?? input.start.segmentId}`
        : `${Math.round(input.start.distanceM)} m from the nearest road (limit ${input.maxSnapDistanceM} m)`,
  });

  checks.push({
    id: 'end-snapped',
    label: 'End snapped to road',
    passed: input.end.distanceM <= input.maxSnapDistanceM,
    blocking: true,
    detail:
      input.end.distanceM <= input.maxSnapDistanceM
        ? `${Math.round(input.end.distanceM)} m to ${input.end.street ?? input.end.segmentId}`
        : `${Math.round(input.end.distanceM)} m from the nearest road (limit ${input.maxSnapDistanceM} m)`,
  });

  // 3 — every segment hands over to the next at the same coordinate.
  let maxJointGap = 0;
  for (let i = 1; i < input.legs.length; i += 1) {
    const prev = input.legs[i - 1].to;
    const next = input.legs[i].from;
    const gap = haversineM(prev.lat, prev.lng, next.lat, next.lng);
    if (gap > maxJointGap) maxJointGap = gap;
  }
  const jointCount = Math.max(0, input.legs.length - 1);
  checks.push({
    id: 'segments-connected',
    label: 'All route segments connected',
    passed: maxJointGap <= JOINT_TOLERANCE_M,
    blocking: true,
    detail:
      jointCount === 0
        ? 'Single segment; no joints to verify'
        : `${jointCount} joint${jointCount === 1 ? '' : 's'}, widest ${maxJointGap.toFixed(2)} m`,
  });

  // 4 — no vertex-to-vertex teleports.
  let maxStep = 0;
  let maxStepAt = -1;
  for (let i = 1; i < input.coordinates.length; i += 1) {
    const step = haversineM(
      input.coordinates[i - 1][0],
      input.coordinates[i - 1][1],
      input.coordinates[i][0],
      input.coordinates[i][1],
    );
    if (step > maxStep) {
      maxStep = step;
      maxStepAt = i;
    }
  }
  checks.push({
    id: 'no-coordinate-jumps',
    label: 'No coordinate jumps',
    passed: maxStep <= MAX_VERTEX_STEP_M,
    blocking: true,
    detail:
      maxStep <= MAX_VERTEX_STEP_M
        ? `${input.coordinates.length} vertices, longest step ${fmt(maxStep)}`
        : `Step of ${fmt(maxStep)} at vertex ${maxStepAt} exceeds the ${MAX_VERTEX_STEP_M} m ceiling`,
  });

  // 5 — the drawn line is the published line.
  let foreign = 0;
  const snapKeys = new Set([
    vertexKey(input.start.snapped.lat, input.start.snapped.lng),
    vertexKey(input.end.snapped.lat, input.end.snapped.lng),
  ]);
  for (const [lat, lng] of input.coordinates) {
    const key = vertexKey(lat, lng);
    if (input.publishedVertexKeys.has(key) || snapKeys.has(key)) continue;
    foreign += 1;
  }
  checks.push({
    id: 'follows-road-geometry',
    label: 'Path follows road geometry',
    passed: foreign === 0,
    blocking: true,
    detail:
      foreign === 0
        ? `All ${input.coordinates.length} vertices are published road vertices or snap projections`
        : `${foreign} vertex/vertices are not present in the published segments`,
  });

  // 6 — reachability, stated as a graph fact rather than an inference.
  const sameComponent = input.startComponent >= 0 && input.startComponent === input.endComponent;
  checks.push({
    id: 'reachable',
    label: 'Route is reachable',
    passed: input.reachable && sameComponent,
    blocking: true,
    detail: sameComponent
      ? `Both ends in road-network component ${input.startComponent}`
      : `Ends sit in disconnected components (${input.startComponent} and ${input.endComponent})`,
  });

  // 7 — sanity on the numbers themselves.
  const ratio = input.straightLineM > 0 ? input.lengthM / input.straightLineM : Number.POSITIVE_INFINITY;
  const distanceOk =
    input.lengthM > 0 && input.lengthM + 1 >= input.straightLineM && ratio <= MAX_DETOUR_RATIO;
  checks.push({
    id: 'distance-realistic',
    label: 'Distance is realistic',
    passed: distanceOk,
    blocking: true,
    detail: distanceOk
      ? `${fmt(input.lengthM)} by road vs ${fmt(input.straightLineM)} direct (${ratio.toFixed(2)}×)`
      : input.lengthM + 1 < input.straightLineM
        ? `Road distance ${fmt(input.lengthM)} is shorter than the direct line ${fmt(input.straightLineM)}`
        : `Detour ${ratio.toFixed(2)}× exceeds the ${MAX_DETOUR_RATIO}× ceiling`,
  });

  // 8 — informational. The absence of an ETA is a property of the source data,
  // not a defect in the route, so it does not block rendering. It does get
  // stated, because a blank ETA with no explanation reads as a bug.
  checks.push({
    id: 'eta-basis',
    label: 'ETA basis declared',
    passed: true,
    blocking: false,
    detail: 'No speed or free-flow attribute is published for this road network; travel time is reported as unavailable rather than estimated.',
  });

  const failures = checks.filter((c) => c.blocking && !c.passed).map((c) => `${c.label}: ${c.detail}`);

  return {
    status: failures.length === 0 ? 'VALID' : 'INVALID',
    checks,
    failures,
  };
}
