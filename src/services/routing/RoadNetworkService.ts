/**
 * Road network routing service.
 *
 * This is the only thing in ARKA allowed to produce route geometry. It owns the
 * whole path from a pair of raw coordinates to a validated, drawable line:
 *
 *   raw coordinate
 *     → snap to the nearest published road segment
 *     → road graph (nodes = junctions, edges = segments)
 *     → A* under one of several objectives
 *     → stitch the traversed segments' published vertices
 *     → validate
 *     → RouteCandidate, or an explicit failure
 *
 * Two fetch tiers, because the city publishes 33,256 road segments and pulling
 * all of them for every dispatch would be both slow and rude:
 *
 * - The ARTERIAL SKELETON — national highway, state highway, flyover, major road
 *   — is 2,825 segments city-wide, six requests, measured at ~3.6 s. Fetched once
 *   per session and kept. Long routes live here.
 * - LINK ROADS are 30,431 segments and are fetched per corridor bounding box.
 *   They are what makes the last few hundred metres of a route real.
 *
 * When a fetch is cut short by a budget or page cap the resulting network is
 * marked `truncated`, and that flag rides along on the solution so the UI can say
 * the route was calculated against a partial network instead of implying
 * completeness.
 *
 * What this service will never do: return a line it could not derive from
 * published road geometry. If the origin is off-network, if the destination is
 * unreachable, or if a candidate fails validation, it returns a failure with a
 * reason. There is no fallback polyline anywhere in this file.
 */

import type { CityGISProvider, GISBounds, RoadClassDef, RoadSegmentRecord } from '../gis/types';
import { RoadNetworkRequestError } from '../gis/BhubaneswarRoadNetwork';
import { bhubaneswarGIS } from '../gis/BhubaneswarGISService';
import { boundsAround, boundsContain, boundsKey, distanceBetween, distanceToPolylineM, haversineM } from './geo';
import { RoadGraph, type GraphEdge, type SnapAnchor } from './RoadGraph';
import { findPath, type EdgeCostFn, type PathResult, type PathSource, type PathTarget } from './pathfinder';
import { validateRoute, vertexKey } from './routeValidation';
import {
  ROUTE_OBJECTIVE_LABELS,
  type AvoidZone,
  type LatLng,
  type NetworkProvenance,
  type RouteCandidate,
  type RouteClassShare,
  type RouteFailure,
  type RouteLeg,
  type RouteObjective,
  type RouteRequest,
  type RouteSolution,
  type RouteStep,
  type SnapPoint,
  type TravelTimeEstimate,
} from './types';

/** How far a raw coordinate may sit from a road before it is off-network. */
const DEFAULT_MAX_SNAP_M = 250;

/** Padding around the origin–destination box, so a detour has room to exist. */
const MIN_PAD_M = 700;
const MAX_PAD_M = 6000;
const PAD_FRACTION = 0.35;

/** Link-road fetch ceiling per corridor box. */
const LOCAL_SEGMENT_BUDGET = 26_000;

/** Graphs held at once. Small: each is tens of thousands of coordinate pairs. */
const GRAPH_CACHE_SIZE = 4;

const ALL_OBJECTIVES: RouteObjective[] = ['SHORTEST', 'ARTERIAL', 'LOW_EXPOSURE'];

/**
 * Class preference weights for the `ARTERIAL` objective.
 *
 * These are routing preferences, not data: they express "prefer a highway to a
 * back lane for the same distance". All are >= 1 so straight-line distance stays
 * an admissible A* heuristic — a weight below 1 would let the search return a
 * suboptimal path while reporting it as optimal.
 */
const ARTERIAL_CLASS_WEIGHT: Record<string, number> = {
  'national-highway': 1,
  'state-highway': 1,
  flyover: 1,
  'major-road': 1.15,
  'link-road': 1.6,
};

/** Multiplier applied to segments inside a `PENALTY` avoid zone. */
const EXPOSURE_PENALTY = 4;

const NO_TRAVEL_TIME: TravelTimeEstimate = {
  status: 'UNAVAILABLE',
  minutes: null,
  reason: 'This road network publishes no speed or free-flow attribute, so travel time cannot be derived from source data.',
};

interface FetchedNetwork {
  segments: RoadSegmentRecord[];
  classIds: string[];
  truncated: boolean;
  fetchedAt: string;
  fetchMs: number;
}

interface CachedGraph {
  graph: RoadGraph;
  bounds: GISBounds;
  provenance: NetworkProvenance;
}

/** Result of resolving a multi-waypoint corridor onto the road network. */
export interface RouteChainResult {
  status: 'VALID' | 'PARTIAL' | 'FAILED';
  coordinates: [number, number][];
  lengthM: number;
  /** One entry per waypoint pair, in order. */
  legs: { from: LatLng; to: LatLng; lengthM: number; failure: RouteFailure | null }[];
  failure: RouteFailure | null;
  network: NetworkProvenance | null;
}

/** A candidate location in a nearest-by-road comparison. */
export interface RouteBestOption {
  /** Caller's own identifier, echoed back so it can map the winner to its record. */
  id: string;
  point: LatLng;
}

export interface RouteBestResult {
  status: 'VALID' | 'FAILED';
  /** Id of the option reached by the shortest road distance. */
  chosenId: string | null;
  /** Full multi-objective solution for the chosen option. */
  solution: RouteSolution | null;
  /** Every option considered, reachable ones first in road-distance order. */
  evaluated: { id: string; lengthM: number | null; failure: RouteFailure | null }[];
  network: NetworkProvenance | null;
  failure: RouteFailure | null;
}

function fmtM(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function abandonedError(): Error {
  const error = new Error('Road network request abandoned by the caller.');
  error.name = 'AbortError';
  return error;
}

/**
 * True when a rejection is a caller's cancelled wait, not a routing outcome.
 *
 * The distinction matters downstream. "No route exists" is a statement about the
 * road network; "you stopped waiting" is a statement about the caller. Reporting
 * the second as the first would tell an operator a corridor is unroutable when
 * nothing was ever searched.
 */
function isAbandoned(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Let one caller stop waiting without stopping the fetch.
 *
 * The skeleton and per-box fetches are single-flight and shared by every consumer
 * on the page. Handing a caller's `AbortSignal` straight to a shared fetch made
 * the first arrival's lifetime govern everyone else's: when a dispatch re-keyed
 * onto a new incident and aborted, corridors waiting on the same skeleton saw a
 * rejection they never asked for and recorded it as a routing failure.
 *
 * So the shared fetch always runs to completion — its result is wanted either way
 * and it populates the session cache — and only the individual await is dropped.
 */
function abandonOnAbort<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    // Still attach a handler, or the shared promise rejects unobserved.
    void promise.catch(() => undefined);
    return Promise.reject(abandonedError());
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abandonedError());
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

export class RoadNetworkService {
  private readonly provider: CityGISProvider;

  private skeleton: FetchedNetwork | null = null;
  private skeletonPromise: Promise<FetchedNetwork> | null = null;

  private readonly localCache = new Map<string, FetchedNetwork>();
  private readonly localPending = new Map<string, Promise<FetchedNetwork>>();
  private readonly graphCache = new Map<string, CachedGraph>();

  /**
   * The arterial skeleton as a standalone graph.
   *
   * Held apart from `graphCache` on purpose. Its bounding box covers the whole
   * city, so leaving it in the cache would make the containment check hand it to
   * every subsequent request — silently routing dispatches without link roads.
   */
  private skeletonGraph: CachedGraph | null = null;
  private skeletonGraphPromise: Promise<CachedGraph> | null = null;

  constructor(provider: CityGISProvider) {
    this.provider = provider;
  }

  /** False when the city publishes no line-geometry road layer at all. */
  get available(): boolean {
    return this.provider.roadNetwork !== null;
  }

  /**
   * What routing can and cannot promise here, available without any fetch.
   *
   * Surfaced so the UI can state the modelling limits next to the route instead
   * of letting an operator assume one-way streets are respected.
   */
  describe(): {
    available: boolean;
    datasetLabel: string;
    attribution: string;
    directionModelled: boolean;
    speedPublished: boolean;
    serverRouting: boolean;
    classes: RoadClassDef[];
  } {
    const source = this.provider.roadNetwork;
    if (!source) {
      return {
        available: false,
        datasetLabel: 'No routable road network published',
        attribution: '',
        directionModelled: false,
        speedPublished: false,
        serverRouting: false,
        classes: [],
      };
    }
    return {
      available: true,
      datasetLabel: source.datasetLabel,
      attribution: source.attribution,
      directionModelled: source.publishesDirection,
      speedPublished: source.publishesSpeedLimit,
      serverRouting: source.hasServerRoutingEngine,
      classes: source.listClasses(),
    };
  }

  /** Pre-fetch the arterial skeleton so the first dispatch is not the slow one. */
  async warm(signal?: AbortSignal): Promise<void> {
    if (!this.available) return;
    try {
      await this.ensureSkeleton(signal);
    } catch {
      // A failed warm-up is not an error worth surfacing: the next real request
      // will retry and report properly.
    }
  }

  /** Discard cached geometry. Used when the operator forces a network refresh. */
  clearCache(): void {
    this.skeleton = null;
    this.skeletonPromise = null;
    this.skeletonGraph = null;
    this.skeletonGraphPromise = null;
    this.localCache.clear();
    this.graphCache.clear();
  }

  /**
   * Calculate every requested objective between two points.
   *
   * Returns candidates in engine order. Ranking, recommendation and colour are
   * decided downstream — this layer has no opinion about which route is best,
   * only about which ones are real.
   */
  async route(request: RouteRequest): Promise<RouteSolution> {
    const { origin, destination } = request;
    const base: Pick<RouteSolution, 'origin' | 'destination'> = { origin, destination };

    if (!this.available) {
      return {
        status: 'FAILED',
        candidates: [],
        network: null,
        failure: {
          code: 'ROAD_NETWORK_UNAVAILABLE',
          message: 'ROAD NETWORK UNAVAILABLE',
          detail: 'The configured city GIS provider publishes no routable road geometry, so no route can be calculated.',
        },
        ...base,
      };
    }

    let cached: CachedGraph;
    try {
      cached = await this.graphFor([origin, destination], request.signal);
    } catch (error) {
      // A cancelled wait is the caller's own doing and is rethrown, not dressed up
      // as a routing verdict.
      if (isAbandoned(error)) throw error;
      return { status: 'FAILED', candidates: [], network: null, failure: this.toFailure(error), ...base };
    }

    return this.routeWithin(cached, request);
  }

  /**
   * Route to whichever candidate is nearest **by road**, from one shared graph.
   *
   * The reason this exists rather than living in the caller: "nearest hospital" is
   * a routing question, not a geometry question. Crow-fly distance picks the
   * facility on the far side of the river; road distance picks the one an
   * ambulance can actually reach. Every candidate is routed inside a single graph
   * covering all of them, so the honest answer costs one fetch rather than one per
   * candidate.
   *
   * `direction: 'TO_ANCHOR'` reverses each pair, for dispatch (unit → incident)
   * rather than evacuation (incident → facility).
   */
  async routeBest(
    anchor: LatLng,
    options: readonly RouteBestOption[],
    settings: {
      direction?: 'FROM_ANCHOR' | 'TO_ANCHOR';
      objectives?: RouteObjective[];
      avoid?: AvoidZone[];
      blockedSegmentIds?: string[];
      maxSnapDistanceM?: number;
      signal?: AbortSignal;
    } = {},
  ): Promise<RouteBestResult> {
    const empty = (failure: RouteFailure): RouteBestResult => ({
      status: 'FAILED',
      chosenId: null,
      solution: null,
      evaluated: [],
      network: null,
      failure,
    });

    if (options.length === 0) {
      return empty({
        code: 'NO_VALID_ROUTE_AVAILABLE',
        message: 'NO VALID ROUTE AVAILABLE',
        detail: 'No candidate locations were supplied, so there is nothing to route to.',
      });
    }

    if (!this.available) {
      return empty({
        code: 'ROAD_NETWORK_UNAVAILABLE',
        message: 'ROAD NETWORK UNAVAILABLE',
        detail: 'The configured city GIS provider publishes no routable road geometry, so no route can be calculated.',
      });
    }

    let cached: CachedGraph;
    try {
      cached = await this.graphFor([anchor, ...options.map((o) => o.point)], settings.signal);
    } catch (error) {
      if (isAbandoned(error)) throw error;
      return empty(this.toFailure(error));
    }

    const toAnchor = settings.direction === 'TO_ANCHOR';
    const evaluated: RouteBestResult['evaluated'] = [];
    let best: { id: string; lengthM: number; solution: RouteSolution } | null = null;

    for (const option of options) {
      const solution = this.routeWithin(cached, {
        origin: toAnchor ? option.point : anchor,
        destination: toAnchor ? anchor : option.point,
        objectives: settings.objectives,
        avoid: settings.avoid,
        blockedSegmentIds: settings.blockedSegmentIds,
        maxSnapDistanceM: settings.maxSnapDistanceM,
        signal: settings.signal,
      });

      const shortest = solution.candidates.reduce<number | null>(
        (min, candidate) => (min === null || candidate.lengthM < min ? candidate.lengthM : min),
        null,
      );

      evaluated.push({ id: option.id, lengthM: shortest, failure: solution.failure });

      if (shortest !== null && (best === null || shortest < best.lengthM)) {
        best = { id: option.id, lengthM: shortest, solution };
      }
    }

    // Reachable candidates first, in road-distance order; unreachable ones after.
    evaluated.sort((a, b) => {
      if (a.lengthM === null && b.lengthM === null) return 0;
      if (a.lengthM === null) return 1;
      if (b.lengthM === null) return -1;
      return a.lengthM - b.lengthM;
    });

    if (!best) {
      return {
        status: 'FAILED',
        chosenId: null,
        solution: null,
        evaluated,
        network: cached.provenance,
        failure:
          evaluated.find((e) => e.failure)?.failure ?? {
            code: 'NO_VALID_ROUTE_AVAILABLE',
            message: 'NO VALID ROUTE AVAILABLE',
            detail: 'None of the candidate locations can be reached through the published road network.',
          },
      };
    }

    return {
      status: 'VALID',
      chosenId: best.id,
      solution: best.solution,
      evaluated,
      network: cached.provenance,
      failure: null,
    };
  }

  /**
   * Calculate inside a graph that has already been fetched.
   *
   * Synchronous on purpose: once the geometry is in memory, snapping, search,
   * stitching and validation involve no I/O at all. That is what makes routing to
   * several candidate facilities cheap enough to do honestly.
   */
  private routeWithin(cached: CachedGraph, request: RouteRequest): RouteSolution {
    const { origin, destination } = request;
    const base: Pick<RouteSolution, 'origin' | 'destination'> = { origin, destination };
    const { graph, provenance } = cached;
    const maxSnap = request.maxSnapDistanceM ?? DEFAULT_MAX_SNAP_M;

    const startAnchor = graph.snap(origin.lat, origin.lng, maxSnap);
    if (!startAnchor) {
      return {
        status: 'FAILED',
        candidates: [],
        network: provenance,
        failure: {
          code: 'ORIGIN_NOT_ON_ROAD_NETWORK',
          message: 'ORIGIN NOT ON ROAD NETWORK',
          detail: `No published road segment lies within ${maxSnap} m of the start location, so the route has no valid starting point.`,
        },
        ...base,
      };
    }

    const endAnchor = graph.snap(destination.lat, destination.lng, maxSnap);
    if (!endAnchor) {
      return {
        status: 'FAILED',
        candidates: [],
        network: provenance,
        failure: {
          code: 'DESTINATION_NOT_ON_ROAD_NETWORK',
          message: 'DESTINATION NOT ON ROAD NETWORK',
          detail: `No published road segment lies within ${maxSnap} m of the destination, so the route has no valid end point.`,
        },
        ...base,
      };
    }

    const startPoint = toSnapPoint(startAnchor);
    const endPoint = toSnapPoint(endAnchor);
    const straightLineM = distanceBetween(startAnchor.point, endAnchor.point);

    // Same segment: the drive is a stretch of one road, and routing it through
    // junctions would send the vehicle away and back.
    if (startAnchor.edgeIndex === endAnchor.edgeIndex) {
      const run = graph.subRun(startAnchor, endAnchor);
      if (run) {
        const edge = graph.edgeAt(startAnchor.edgeIndex);
        const candidate = this.assembleSingleSegment(
          graph,
          edge,
          run,
          startPoint,
          endPoint,
          straightLineM,
          maxSnap,
        );
        if (candidate.validation.status === 'VALID') {
          return { status: 'VALID', candidates: [candidate], network: provenance, failure: null, ...base };
        }
        return {
          status: 'FAILED',
          candidates: [],
          network: provenance,
          failure: {
            code: 'ROUTE_VALIDATION_FAILED',
            message: 'ROUTE STATUS: INVALID',
            detail: candidate.validation.failures.join('; '),
          },
          ...base,
        };
      }
    }

    // Reachability before search, so an unreachable pair gets a specific reason
    // rather than an exhausted-search shrug.
    const startComponents = new Set(startAnchor.entries.map((e) => graph.componentOf(e.nodeId)));
    const endComponents = endAnchor.entries.map((e) => graph.componentOf(e.nodeId));
    const shared = endComponents.some((c) => c >= 0 && startComponents.has(c));
    if (!shared) {
      return {
        status: 'FAILED',
        candidates: [],
        network: provenance,
        failure: {
          code: 'NO_VALID_ROUTE_AVAILABLE',
          message: 'NO VALID ROUTE AVAILABLE',
          detail:
            'Start and destination snap to disconnected parts of the published road network; no connected sequence of road segments joins them.',
        },
        ...base,
      };
    }

    const blocked = this.blockedEdges(graph, request);
    const penalised = this.penalisedEdges(graph, request.avoid ?? []);

    const sources: PathSource[] = startAnchor.entries.map((e) => ({ nodeId: e.nodeId, initialCostM: e.tailM }));
    const targets: PathTarget[] = endAnchor.entries.map((e) => ({ nodeId: e.nodeId, finalCostM: e.tailM }));

    const objectives = request.objectives?.length ? request.objectives : ALL_OBJECTIVES;
    const candidates: RouteCandidate[] = [];
    const seen = new Set<string>();
    const rejected: string[] = [];

    for (const objective of objectives) {
      const started = Date.now();
      const cost = this.costFn(objective, blocked, penalised);
      const path = findPath(graph, { sources, targets, cost });
      if (!path) {
        rejected.push(`${ROUTE_OBJECTIVE_LABELS[objective]}: no connected path under this objective`);
        continue;
      }

      const signature = path.edges.map((e) => e.edge.index).join('>');
      if (seen.has(signature)) continue;
      seen.add(signature);

      const candidate = this.assemble(
        graph,
        objective,
        path,
        startAnchor,
        endAnchor,
        startPoint,
        endPoint,
        straightLineM,
        maxSnap,
        Date.now() - started,
      );

      if (!candidate) {
        rejected.push(`${ROUTE_OBJECTIVE_LABELS[objective]}: route geometry could not be stitched from published segments`);
        continue;
      }
      if (candidate.validation.status !== 'VALID') {
        rejected.push(`${ROUTE_OBJECTIVE_LABELS[objective]}: ${candidate.validation.failures.join('; ')}`);
        continue;
      }
      candidates.push(candidate);
    }

    if (candidates.length === 0) {
      const validationFailed = rejected.length > 0 && seen.size > 0;
      return {
        status: 'FAILED',
        candidates: [],
        network: provenance,
        failure: {
          code: validationFailed ? 'ROUTE_VALIDATION_FAILED' : 'NO_VALID_ROUTE_AVAILABLE',
          message: validationFailed ? 'ROUTE STATUS: INVALID' : 'NO VALID ROUTE AVAILABLE',
          detail: rejected.join(' · ') || 'No connected road path exists between these locations.',
        },
        ...base,
      };
    }

    return { status: 'VALID', candidates, network: provenance, failure: null, ...base };
  }

  /**
   * Resolve a chain of waypoints onto the road network.
   *
   * Used for traffic corridors, which ARKA holds as ordered lists of real named
   * junctions. Each consecutive pair is routed independently and the results are
   * concatenated; because both legs snap the shared waypoint to the same point on
   * the same segment, the join is exact rather than approximate.
   *
   * A corridor with one unroutable leg comes back `PARTIAL` with that leg's
   * failure recorded. It is the caller's decision whether a partial corridor is
   * worth drawing — but it will never be padded out with a straight line.
   */
  async routeChain(
    waypoints: readonly LatLng[],
    options: {
      signal?: AbortSignal;
      maxSnapDistanceM?: number;
      objective?: RouteObjective;
      /**
       * Route on the city-wide arterial skeleton alone.
       *
       * For named arterial corridors this is both faster and more faithful: the
       * skeleton is one session-long fetch instead of a link-road pull per
       * corridor box, and a corridor called "National Highway 16" should not be
       * resolved through a residential lane that happens to be shorter.
       */
      arterialOnly?: boolean;
    } = {},
  ): Promise<RouteChainResult> {
    if (waypoints.length < 2) {
      return {
        status: 'FAILED',
        coordinates: [],
        lengthM: 0,
        legs: [],
        network: null,
        failure: {
          code: 'NO_VALID_ROUTE_AVAILABLE',
          message: 'NO VALID ROUTE AVAILABLE',
          detail: 'A corridor needs at least two waypoints to be resolved onto the road network.',
        },
      };
    }

    if (!this.available) {
      return {
        status: 'FAILED',
        coordinates: [],
        lengthM: 0,
        legs: [],
        network: null,
        failure: {
          code: 'ROAD_NETWORK_UNAVAILABLE',
          message: 'ROAD NETWORK UNAVAILABLE',
          detail: 'The configured city GIS provider publishes no routable road geometry.',
        },
      };
    }

    // One graph covering the whole corridor, so every leg shares the same fetch.
    let cached: CachedGraph;
    try {
      cached = options.arterialOnly
        ? await this.arterialGraph(options.signal)
        : await this.graphFor(waypoints, options.signal);
    } catch (error) {
      if (isAbandoned(error)) throw error;
      return { status: 'FAILED', coordinates: [], lengthM: 0, legs: [], network: null, failure: this.toFailure(error) };
    }

    const objective = options.objective ?? 'SHORTEST';
    const coordinates: [number, number][] = [];
    const legs: RouteChainResult['legs'] = [];
    let lengthM = 0;
    let failures = 0;

    for (let i = 1; i < waypoints.length; i += 1) {
      const from = waypoints[i - 1];
      const to = waypoints[i];
      const solution = this.routeWithin(cached, {
        origin: from,
        destination: to,
        objectives: [objective],
        maxSnapDistanceM: options.maxSnapDistanceM,
        signal: options.signal,
      });

      const candidate = solution.candidates[0];
      if (!candidate) {
        failures += 1;
        legs.push({ from, to, lengthM: 0, failure: solution.failure });
        continue;
      }

      legs.push({ from, to, lengthM: candidate.lengthM, failure: null });
      lengthM += candidate.lengthM;

      for (const point of candidate.coordinates) {
        const prev = coordinates[coordinates.length - 1];
        if (prev && prev[0] === point[0] && prev[1] === point[1]) continue;
        coordinates.push(point);
      }
    }

    if (coordinates.length < 2) {
      return {
        status: 'FAILED',
        coordinates: [],
        lengthM: 0,
        legs,
        network: cached.provenance,
        failure: {
          code: 'NO_VALID_ROUTE_AVAILABLE',
          message: 'NO VALID ROUTE AVAILABLE',
          detail: 'None of this corridor’s waypoint pairs could be joined through the published road network.',
        },
      };
    }

    return {
      status: failures === 0 ? 'VALID' : 'PARTIAL',
      coordinates,
      lengthM,
      legs,
      network: cached.provenance,
      failure:
        failures === 0
          ? null
          : {
              code: 'NO_VALID_ROUTE_AVAILABLE',
              message: 'CORRIDOR PARTIALLY RESOLVED',
              detail: `${failures} of ${waypoints.length - 1} corridor legs have no connected road path and are not drawn.`,
            },
    };
  }

  // --- Network assembly --------------------------------------------------

  /**
   * The city-wide arterial skeleton as a graph, built once per session.
   *
   * Used for named arterial corridors, which span the whole city and would
   * otherwise each trigger a link-road pull over a box several kilometres wide.
   *
   * Shared and single-flight, so like the fetches beneath it the caller's signal
   * governs the caller's wait only. Binding this promise to whichever consumer
   * arrived first is what made one corridor drop out whenever React re-ran the
   * resolving effect: the second pass inherited the first pass's cancellation.
   */
  private arterialGraph(signal?: AbortSignal): Promise<CachedGraph> {
    if (this.skeletonGraph) return Promise.resolve(this.skeletonGraph);
    if (this.skeletonGraphPromise) return abandonOnAbort(this.skeletonGraphPromise, signal);

    this.skeletonGraphPromise = this.ensureSkeleton()
      .then((skeleton) => {
        const source = this.provider.roadNetwork;
        const buildStarted = Date.now();
        const graph = RoadGraph.build(skeleton.segments, source ? source.listClasses() : []);
        const graphBuildMs = Date.now() - buildStarted;

        let south = Number.POSITIVE_INFINITY;
        let west = Number.POSITIVE_INFINITY;
        let north = Number.NEGATIVE_INFINITY;
        let east = Number.NEGATIVE_INFINITY;
        for (const segment of skeleton.segments) {
          for (const [lat, lng] of segment.coordinates) {
            if (lat < south) south = lat;
            if (lat > north) north = lat;
            if (lng < west) west = lng;
            if (lng > east) east = lng;
          }
        }

        const entry: CachedGraph = {
          graph,
          bounds: { west, south, east, north },
          provenance: {
            datasetLabel: source?.datasetLabel ?? 'Unknown road dataset',
            attribution: source?.attribution ?? '',
            segmentCount: graph.edgeCount,
            nodeCount: graph.nodeCount,
            edgeCount: graph.edgeCount,
            classIds: skeleton.classIds,
            truncated: skeleton.truncated,
            fetchedAt: skeleton.fetchedAt,
            directionModelled: source?.publishesDirection ?? false,
            speedPublished: source?.publishesSpeedLimit ?? false,
            serverRouting: source?.hasServerRoutingEngine ?? false,
            graphBuildMs,
            fetchMs: skeleton.fetchMs,
          },
        };

        this.skeletonGraph = entry;
        this.skeletonGraphPromise = null;
        return entry;
      })
      .catch((error) => {
        this.skeletonGraphPromise = null;
        throw error;
      });

    return abandonOnAbort(this.skeletonGraphPromise, signal);
  }

  private async graphFor(points: readonly LatLng[], signal?: AbortSignal): Promise<CachedGraph> {
    const spread = points.reduce((max, a) => {
      for (const b of points) {
        const d = distanceBetween(a, b);
        if (d > max) max = d;
      }
      return max;
    }, 0);

    const padM = Math.min(MAX_PAD_M, Math.max(MIN_PAD_M, spread * PAD_FRACTION));
    const bounds = boundsAround(points, padM);
    const key = boundsKey(bounds);

    // An existing graph whose box already covers this one is reused rather than
    // rebuilt — successive dispatches in the same district are the common case.
    const exact = this.graphCache.get(key);
    if (exact) return exact;
    for (const entry of this.graphCache.values()) {
      if (boundsContain(entry.bounds, bounds)) return entry;
    }

    const skeleton = await this.ensureSkeleton(signal);
    const local = await this.ensureLocal(bounds, signal);

    const source = this.provider.roadNetwork;
    const classes = source ? source.listClasses() : [];
    const segments = [...skeleton.segments, ...local.segments];

    const buildStarted = Date.now();
    const graph = RoadGraph.build(segments, classes);
    const graphBuildMs = Date.now() - buildStarted;

    const provenance: NetworkProvenance = {
      datasetLabel: source?.datasetLabel ?? 'Unknown road dataset',
      attribution: source?.attribution ?? '',
      segmentCount: graph.edgeCount,
      nodeCount: graph.nodeCount,
      edgeCount: graph.edgeCount,
      classIds: Array.from(new Set([...skeleton.classIds, ...local.classIds])),
      truncated: skeleton.truncated || local.truncated,
      fetchedAt: local.fetchedAt > skeleton.fetchedAt ? local.fetchedAt : skeleton.fetchedAt,
      directionModelled: source?.publishesDirection ?? false,
      speedPublished: source?.publishesSpeedLimit ?? false,
      serverRouting: source?.hasServerRoutingEngine ?? false,
      graphBuildMs,
      fetchMs: skeleton.fetchMs + local.fetchMs,
    };

    const entry: CachedGraph = { graph, bounds, provenance };
    this.graphCache.set(key, entry);
    while (this.graphCache.size > GRAPH_CACHE_SIZE) {
      const oldest = this.graphCache.keys().next().value as string | undefined;
      if (oldest === undefined) break;
      this.graphCache.delete(oldest);
    }

    return entry;
  }

  /**
   * The city-wide arterial classes. Fetched once, kept for the session.
   *
   * The caller's signal governs the caller's wait only — see `abandonOnAbort`.
   * This fetch is shared, so one consumer walking away must not cancel it for the
   * others.
   */
  private ensureSkeleton(signal?: AbortSignal): Promise<FetchedNetwork> {
    if (this.skeleton) return Promise.resolve(this.skeleton);
    if (this.skeletonPromise) return abandonOnAbort(this.skeletonPromise, signal);

    const source = this.provider.roadNetwork;
    if (!source) return Promise.reject(new Error('No routable road network is published for this city.'));

    const classIds = source
      .listClasses()
      .filter((c) => c.cityWide)
      .map((c) => c.id);

    const started = Date.now();
    this.skeletonPromise = source
      .fetchSegments({ classIds })
      .then((result) => {
        const fetched: FetchedNetwork = {
          segments: result.segments,
          classIds: result.classIds,
          truncated: result.truncated,
          fetchedAt: result.fetchedAt,
          fetchMs: Date.now() - started,
        };
        this.skeleton = fetched;
        this.skeletonPromise = null;
        return fetched;
      })
      .catch((error) => {
        this.skeletonPromise = null;
        throw error;
      });

    return abandonOnAbort(this.skeletonPromise, signal);
  }

  /**
   * Link roads inside one corridor box. Cached by rounded bbox.
   *
   * Shared and single-flight like the skeleton, and abandoned the same way.
   */
  private ensureLocal(bounds: GISBounds, signal?: AbortSignal): Promise<FetchedNetwork> {
    const key = boundsKey(bounds);
    const cached = this.localCache.get(key);
    if (cached) return Promise.resolve(cached);
    const pending = this.localPending.get(key);
    if (pending) return abandonOnAbort(pending, signal);

    const source = this.provider.roadNetwork;
    if (!source) return Promise.reject(new Error('No routable road network is published for this city.'));

    const classIds = source
      .listClasses()
      .filter((c) => !c.cityWide)
      .map((c) => c.id);

    if (classIds.length === 0) {
      const empty: FetchedNetwork = {
        segments: [],
        classIds: [],
        truncated: false,
        fetchedAt: new Date().toISOString(),
        fetchMs: 0,
      };
      this.localCache.set(key, empty);
      return Promise.resolve(empty);
    }

    const started = Date.now();
    const promise = source
      .fetchSegments({ bounds, classIds, maxSegments: LOCAL_SEGMENT_BUDGET })
      .then((result) => {
        const fetched: FetchedNetwork = {
          segments: result.segments,
          classIds: result.classIds,
          truncated: result.truncated,
          fetchedAt: result.fetchedAt,
          fetchMs: Date.now() - started,
        };
        this.localCache.set(key, fetched);
        this.localPending.delete(key);
        return fetched;
      })
      .catch((error) => {
        this.localPending.delete(key);
        throw error;
      });

    this.localPending.set(key, promise);
    return abandonOnAbort(promise, signal);
  }

  // --- Cost ---------------------------------------------------------------

  /** Segments that are closed, for every objective. Closure is not a preference. */
  private blockedEdges(graph: RoadGraph, request: RouteRequest): Set<number> {
    const blocked = new Set<number>();
    const blockedIds = new Set(request.blockedSegmentIds ?? []);
    const blockZones = (request.avoid ?? []).filter((z) => z.severity === 'BLOCK');

    if (blockedIds.size === 0 && blockZones.length === 0) return blocked;

    for (let i = 0; i < graph.edgeCount; i += 1) {
      const edge = graph.edgeAt(i);
      if (blockedIds.has(edge.segmentId)) {
        blocked.add(i);
        continue;
      }
      if (this.intersectsAny(edge, blockZones)) blocked.add(i);
    }
    return blocked;
  }

  /** Segments inside a `PENALTY` zone, discouraged only by `LOW_EXPOSURE`. */
  private penalisedEdges(graph: RoadGraph, zones: readonly AvoidZone[]): Set<number> {
    const penalty = zones.filter((z) => z.severity === 'PENALTY');
    const result = new Set<number>();
    if (penalty.length === 0) return result;

    for (let i = 0; i < graph.edgeCount; i += 1) {
      if (this.intersectsAny(graph.edgeAt(i), penalty)) result.add(i);
    }
    return result;
  }

  private intersectsAny(edge: GraphEdge, zones: readonly AvoidZone[]): boolean {
    for (const zone of zones) {
      if (distanceToPolylineM(zone.center.lat, zone.center.lng, edge.coordinates) <= zone.radiusM) return true;
    }
    return false;
  }

  private costFn(objective: RouteObjective, blocked: Set<number>, penalised: Set<number>): EdgeCostFn {
    return (edge: GraphEdge): number => {
      if (blocked.has(edge.index)) return Number.POSITIVE_INFINITY;

      switch (objective) {
        case 'SHORTEST':
          return edge.lengthM;
        case 'ARTERIAL':
          return edge.lengthM * (ARTERIAL_CLASS_WEIGHT[edge.classId] ?? 1.3);
        case 'LOW_EXPOSURE':
          return edge.lengthM * (penalised.has(edge.index) ? EXPOSURE_PENALTY : 1);
        default:
          return edge.lengthM;
      }
    };
  }

  // --- Candidate assembly -------------------------------------------------

  /**
   * Stitch a path into a candidate.
   *
   * Every coordinate written here comes from `edge.coordinates` — the vertices
   * the road service published — or from a snap projection onto one of those
   * segments. The joint vertex between consecutive segments is written once, so
   * the polyline is continuous by construction rather than by tolerance.
   */
  private assemble(
    graph: RoadGraph,
    objective: RouteObjective,
    path: PathResult,
    startAnchor: SnapAnchor,
    endAnchor: SnapAnchor,
    startPoint: SnapPoint,
    endPoint: SnapPoint,
    straightLineM: number,
    maxSnapDistanceM: number,
    computeMs: number,
  ): RouteCandidate | null {
    const startEntry = startAnchor.entries.find((e) => e.nodeId === path.startNodeId);
    const endEntry = endAnchor.entries.find((e) => e.nodeId === path.endNodeId);
    if (!startEntry || !endEntry) return null;

    const coordinates: [number, number][] = [];
    const legs: RouteLeg[] = [];
    const publishedVertexKeys = new Set<string>();

    const push = (point: [number, number]): void => {
      const prev = coordinates[coordinates.length - 1];
      if (prev && prev[0] === point[0] && prev[1] === point[1]) return;
      coordinates.push(point);
    };

    const registerEdgeVertices = (edge: GraphEdge): void => {
      for (const [lat, lng] of edge.coordinates) publishedVertexKeys.add(vertexKey(lat, lng));
    };

    // Approach: the partial run of the segment the origin sits on.
    const startEdge = graph.edgeAt(startAnchor.edgeIndex);
    registerEdgeVertices(startEdge);
    if (startEntry.tail.length >= 2) {
      for (const point of startEntry.tail) push(point);
      legs.push({
        segmentId: startEdge.segmentId,
        classId: startEdge.classId,
        classLabel: startEdge.classLabel,
        street: startEdge.street,
        lengthM: startEntry.tailM,
        from: { lat: startEntry.tail[0][0], lng: startEntry.tail[0][1] },
        to: { lat: startEntry.tail[startEntry.tail.length - 1][0], lng: startEntry.tail[startEntry.tail.length - 1][1] },
        partial: true,
      });
    } else {
      push([startAnchor.point.lat, startAnchor.point.lng]);
    }

    // Body: whole published segments, oriented to travel direction.
    for (const step of path.edges) {
      const edge = step.edge;
      registerEdgeVertices(edge);
      const run = step.forward ? edge.coordinates : [...edge.coordinates].reverse();
      for (const point of run) push(point);
      legs.push({
        segmentId: edge.segmentId,
        classId: edge.classId,
        classLabel: edge.classLabel,
        street: edge.street,
        lengthM: edge.lengthM,
        from: { lat: run[0][0], lng: run[0][1] },
        to: { lat: run[run.length - 1][0], lng: run[run.length - 1][1] },
        partial: false,
      });
    }

    // Exit: the partial run of the destination's segment, reversed so it reads
    // node → snapped point.
    const endEdge = graph.edgeAt(endAnchor.edgeIndex);
    registerEdgeVertices(endEdge);
    if (endEntry.tail.length >= 2) {
      const run = [...endEntry.tail].reverse();
      for (const point of run) push(point);
      legs.push({
        segmentId: endEdge.segmentId,
        classId: endEdge.classId,
        classLabel: endEdge.classLabel,
        street: endEdge.street,
        lengthM: endEntry.tailM,
        from: { lat: run[0][0], lng: run[0][1] },
        to: { lat: run[run.length - 1][0], lng: run[run.length - 1][1] },
        partial: true,
      });
    } else {
      push([endAnchor.point.lat, endAnchor.point.lng]);
    }

    if (coordinates.length < 2) return null;

    const lengthM = legs.reduce((sum, leg) => sum + leg.lengthM, 0);

    return this.finish({
      objective,
      coordinates,
      legs,
      lengthM,
      straightLineM,
      startPoint,
      endPoint,
      maxSnapDistanceM,
      publishedVertexKeys,
      reachable: true,
      startComponent: graph.componentOf(path.startNodeId),
      endComponent: graph.componentOf(path.endNodeId),
      nodesExpanded: path.expanded,
      computeMs,
    });
  }

  /** The origin and destination share a segment: one partial leg, no search. */
  private assembleSingleSegment(
    graph: RoadGraph,
    edge: GraphEdge,
    run: { coordinates: [number, number][]; lengthM: number },
    startPoint: SnapPoint,
    endPoint: SnapPoint,
    straightLineM: number,
    maxSnapDistanceM: number,
  ): RouteCandidate {
    const publishedVertexKeys = new Set<string>();
    for (const [lat, lng] of edge.coordinates) publishedVertexKeys.add(vertexKey(lat, lng));

    const legs: RouteLeg[] = [
      {
        segmentId: edge.segmentId,
        classId: edge.classId,
        classLabel: edge.classLabel,
        street: edge.street,
        lengthM: run.lengthM,
        from: { lat: run.coordinates[0][0], lng: run.coordinates[0][1] },
        to: {
          lat: run.coordinates[run.coordinates.length - 1][0],
          lng: run.coordinates[run.coordinates.length - 1][1],
        },
        partial: true,
      },
    ];

    const component = graph.componentOf(edge.a);

    return this.finish({
      objective: 'SHORTEST',
      coordinates: run.coordinates,
      legs,
      lengthM: run.lengthM,
      straightLineM,
      startPoint,
      endPoint,
      maxSnapDistanceM,
      publishedVertexKeys,
      reachable: true,
      startComponent: component,
      endComponent: component,
      nodesExpanded: 0,
      computeMs: 0,
    });
  }

  private finish(input: {
    objective: RouteObjective;
    coordinates: [number, number][];
    legs: RouteLeg[];
    lengthM: number;
    straightLineM: number;
    startPoint: SnapPoint;
    endPoint: SnapPoint;
    maxSnapDistanceM: number;
    publishedVertexKeys: Set<string>;
    reachable: boolean;
    startComponent: number;
    endComponent: number;
    nodesExpanded: number;
    computeMs: number;
  }): RouteCandidate {
    const validation = validateRoute({
      start: input.startPoint,
      end: input.endPoint,
      maxSnapDistanceM: input.maxSnapDistanceM,
      legs: input.legs,
      coordinates: input.coordinates,
      lengthM: input.lengthM,
      straightLineM: input.straightLineM,
      reachable: input.reachable,
      startComponent: input.startComponent,
      endComponent: input.endComponent,
      publishedVertexKeys: input.publishedVertexKeys,
    });

    return {
      id: `${input.objective}:${input.legs.map((l) => l.segmentId).join('|')}`,
      objective: input.objective,
      objectiveLabel: ROUTE_OBJECTIVE_LABELS[input.objective],
      coordinates: input.coordinates,
      lengthM: input.lengthM,
      straightLineM: input.straightLineM,
      detourRatio: input.straightLineM > 0 ? input.lengthM / input.straightLineM : 0,
      legs: input.legs,
      steps: buildSteps(input.legs),
      classBreakdown: buildClassBreakdown(input.legs),
      start: input.startPoint,
      end: input.endPoint,
      travelTime: NO_TRAVEL_TIME,
      nodesExpanded: input.nodesExpanded,
      computeMs: input.computeMs,
      validation,
    };
  }

  private toFailure(error: unknown): RouteFailure {
    if (error instanceof RoadNetworkRequestError) {
      return {
        code: 'ROAD_NETWORK_REQUEST_FAILED',
        message: 'ROAD NETWORK REQUEST FAILED',
        detail: error.message,
      };
    }
    if (error instanceof DOMException && error.name === 'AbortError') {
      return { code: 'CANCELLED', message: 'ROUTE CALCULATION CANCELLED', detail: 'The request was superseded.' };
    }
    return {
      code: 'ROAD_NETWORK_REQUEST_FAILED',
      message: 'ROAD NETWORK REQUEST FAILED',
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

function toSnapPoint(anchor: SnapAnchor): SnapPoint {
  return {
    requested: anchor.requested,
    snapped: anchor.point,
    distanceM: anchor.distanceM,
    segmentId: anchor.segmentId,
    classId: anchor.classId,
    street: anchor.street,
  };
}

/** Merge consecutive legs on the same street into one readable instruction. */
function buildSteps(legs: readonly RouteLeg[]): RouteStep[] {
  const steps: RouteStep[] = [];
  for (const leg of legs) {
    const last = steps[steps.length - 1];
    if (last && last.street === leg.street && last.classId === leg.classId) {
      last.lengthM += leg.lengthM;
      last.segmentCount += 1;
      continue;
    }
    steps.push({
      street: leg.street,
      classId: leg.classId,
      classLabel: leg.classLabel,
      lengthM: leg.lengthM,
      segmentCount: 1,
    });
  }
  return steps;
}

function buildClassBreakdown(legs: readonly RouteLeg[]): RouteClassShare[] {
  const totals = new Map<string, { label: string; lengthM: number }>();
  for (const leg of legs) {
    const entry = totals.get(leg.classId);
    if (entry) entry.lengthM += leg.lengthM;
    else totals.set(leg.classId, { label: leg.classLabel, lengthM: leg.lengthM });
  }

  return Array.from(totals.entries())
    .map(([classId, { label, lengthM }]) => ({ classId, label, lengthM }))
    .sort((a, b) => b.lengthM - a.lengthM);
}

/** Straight-line distance helper, exported for callers ranking nearby origins. */
export function crowFlyM(a: LatLng, b: LatLng): number {
  return haversineM(a.lat, a.lng, b.lat, b.lng);
}

export { fmtM as formatRouteDistance };

/**
 * The app-wide routing service, bound to the active city GIS provider.
 *
 * One instance so the arterial skeleton and every corridor graph are fetched
 * once and shared across dispatch, corridors and any future consumer.
 */
export const roadNetworkService = new RoadNetworkService(bhubaneswarGIS);
