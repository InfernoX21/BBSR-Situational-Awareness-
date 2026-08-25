/**
 * Routing contracts.
 *
 * These types exist to keep four things apart that were previously one thing:
 *
 *   road data  →  routing engine  →  route intelligence  →  map rendering
 *
 * The engine returns geometry it can prove came from published road segments.
 * The intelligence layer ranks what the engine returned and may not touch a
 * coordinate. The renderer draws what it is handed and may not invent a point.
 * Every type below is shaped to make those boundaries hard to cross by accident:
 * a `RouteCandidate` carries its own provenance and its own validation report,
 * so a consumer can always answer "where did this line come from".
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * What a candidate was optimised for.
 *
 * There is deliberately no `FASTEST`. This road network publishes no speed or
 * free-flow attribute, so a "fastest" route would be a guess wearing a
 * stopwatch. `ARTERIAL` is the honest neighbour: it prefers higher-capacity
 * published road classes, which is a real attribute of the data.
 */
export type RouteObjective = 'SHORTEST' | 'ARTERIAL' | 'LOW_EXPOSURE';

export const ROUTE_OBJECTIVE_LABELS: Record<RouteObjective, string> = {
  SHORTEST: 'Shortest distance',
  ARTERIAL: 'Arterial priority',
  LOW_EXPOSURE: 'Lower exposure',
};

/** Where a raw coordinate landed once pulled onto the road network. */
export interface SnapPoint {
  /** The coordinate as supplied by the caller. */
  requested: LatLng;
  /** The projection of that coordinate onto a published road segment. */
  snapped: LatLng;
  /** Straight-line offset between the two, in metres. */
  distanceM: number;
  segmentId: string;
  classId: string;
  street: string | null;
}

/** One traversed road segment, in travel order. */
export interface RouteLeg {
  segmentId: string;
  classId: string;
  classLabel: string;
  street: string | null;
  lengthM: number;
  from: LatLng;
  to: LatLng;
  /** True when only part of the segment is used (the first and last legs). */
  partial: boolean;
}

/** Consecutive legs on the same street, merged for a readable directions list. */
export interface RouteStep {
  street: string | null;
  classId: string;
  classLabel: string;
  lengthM: number;
  segmentCount: number;
}

/**
 * Travel time.
 *
 * `UNAVAILABLE` is the only value this network can honestly produce today, and
 * the reason travels with it so the UI can say why instead of showing a dash.
 * The shape leaves room for a real estimate later — but only if a source that
 * actually publishes speed is wired in.
 */
export interface TravelTimeEstimate {
  status: 'UNAVAILABLE';
  minutes: null;
  reason: string;
}

export interface RouteCheck {
  id: string;
  label: string;
  passed: boolean;
  detail: string;
  /** A failed blocking check makes the route unrenderable. */
  blocking: boolean;
}

export interface RouteValidation {
  status: 'VALID' | 'INVALID';
  checks: RouteCheck[];
  /** Human-readable reasons, populated only when status is INVALID. */
  failures: string[];
}

export interface RouteClassShare {
  classId: string;
  label: string;
  lengthM: number;
}

export interface RouteCandidate {
  id: string;
  objective: RouteObjective;
  objectiveLabel: string;
  /**
   * The drawable line, `[lat, lng]` in travel order.
   *
   * Every vertex is either a vertex published by the road service or the
   * projection of the origin/destination onto a published segment. Nothing is
   * interpolated, smoothed or invented.
   */
  coordinates: [number, number][];
  lengthM: number;
  straightLineM: number;
  /** `lengthM / straightLineM`. Below 1 would mean the geometry is wrong. */
  detourRatio: number;
  legs: RouteLeg[];
  steps: RouteStep[];
  classBreakdown: RouteClassShare[];
  start: SnapPoint;
  end: SnapPoint;
  travelTime: TravelTimeEstimate;
  /** A* work done, kept so the calculation stays traceable. */
  nodesExpanded: number;
  computeMs: number;
  validation: RouteValidation;
}

export type RouteFailureCode =
  | 'ROAD_NETWORK_UNAVAILABLE'
  | 'ROAD_NETWORK_REQUEST_FAILED'
  | 'ORIGIN_NOT_ON_ROAD_NETWORK'
  | 'DESTINATION_NOT_ON_ROAD_NETWORK'
  | 'NO_VALID_ROUTE_AVAILABLE'
  | 'ROUTE_VALIDATION_FAILED'
  | 'CANCELLED';

export interface RouteFailure {
  code: RouteFailureCode;
  /** Short operator-facing headline, e.g. `NO VALID ROUTE AVAILABLE`. */
  message: string;
  detail: string;
}

/**
 * What the route was calculated against.
 *
 * Carried on every solution so a route can be audited after the fact: which
 * dataset, how much of it, whether it was truncated, and which modelling limits
 * were in force.
 */
export interface NetworkProvenance {
  datasetLabel: string;
  attribution: string;
  segmentCount: number;
  nodeCount: number;
  edgeCount: number;
  classIds: string[];
  /** True when a fetch budget or page cap cut the network short. */
  truncated: boolean;
  fetchedAt: string;
  /** False for this city: no oneway attribute is published. */
  directionModelled: boolean;
  /** False for this city: no speed attribute is published. */
  speedPublished: boolean;
  /** False for this city: no server-side network-analysis service exists. */
  serverRouting: boolean;
  graphBuildMs: number;
  fetchMs: number;
}

/** A place the route should avoid or refuse to enter. */
export interface AvoidZone {
  id: string;
  label: string;
  center: LatLng;
  radiusM: number;
  /** `BLOCK` makes intersecting segments impassable; `PENALTY` discourages. */
  severity: 'BLOCK' | 'PENALTY';
}

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  /** Defaults to all three objectives. */
  objectives?: RouteObjective[];
  avoid?: AvoidZone[];
  /** Segment ids known to be closed. Applied as impassable edges. */
  blockedSegmentIds?: string[];
  /** How far a raw coordinate may be from a road before it is off-network. */
  maxSnapDistanceM?: number;
  signal?: AbortSignal;
}

export interface RouteSolution {
  status: 'VALID' | 'FAILED';
  /** Engine order, deduplicated. Ranking is the intelligence layer's job. */
  candidates: RouteCandidate[];
  failure: RouteFailure | null;
  network: NetworkProvenance | null;
  origin: LatLng;
  destination: LatLng;
}
