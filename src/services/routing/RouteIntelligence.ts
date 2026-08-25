/**
 * ARKA route intelligence.
 *
 * The layer that has opinions. It receives valid road-network routes from the
 * engine and decides which one to recommend, given congestion, incidents,
 * closures and the priority of the job. What it explicitly cannot do — and is
 * structurally unable to do, because it never sees a coordinate array it can
 * write to — is produce or alter geometry. Every line it recommends was
 * calculated by the routing engine from published road segments.
 *
 * The second rule is provenance. Every factor that moves a score carries the
 * source state of the data behind it, so a recommendation driven by simulated
 * congestion telemetry is labelled as such rather than presented as an
 * operational judgement. A confident-looking ranking built on demo numbers is
 * exactly the failure mode this codebase is trying to eliminate.
 */

import type { GISSourceState } from '../gis/types';
import { distanceToPolylineM } from './geo';
import type { LatLng, RouteCandidate } from './types';

/** How close a route must pass to a corridor to count as using it. */
const CORRIDOR_MATCH_M = 70;

/** Fraction of a route that must sit on a corridor before congestion applies. */
const CORRIDOR_MATCH_SHARE = 0.15;

/** Distance from an incident within which a route is considered exposed. */
const INCIDENT_PROXIMITY_M = 150;

/** A corridor's live-ish congestion state, as ARKA holds it. */
export interface CorridorSignal {
  id: string;
  name: string;
  /** Road-network geometry. Empty when the corridor has not been resolved. */
  path: readonly [number, number][];
  congestionLevel: 'CLEAR' | 'SLOW' | 'JAMMED' | 'SEVERE';
  congestionScore: number;
}

/** An incident that a route may have to pass, or avoid. */
export interface IncidentSignal {
  id: string;
  title: string;
  location: LatLng;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  /** True when the incident closes the road rather than merely slowing it. */
  blocksRoad: boolean;
}

export interface RouteContext {
  corridors: readonly CorridorSignal[];
  /** Where the corridor congestion figures come from. */
  corridorSourceState: GISSourceState;
  incidents: readonly IncidentSignal[];
  incidentSourceState: GISSourceState;
  /** True for emergency dispatch: arterial capacity outweighs raw distance. */
  emergencyPriority: boolean;
}

export const EMPTY_ROUTE_CONTEXT: RouteContext = {
  corridors: [],
  corridorSourceState: 'no-data',
  incidents: [],
  incidentSourceState: 'no-data',
  emergencyPriority: false,
};

/** One reason a route scored the way it did. */
export interface RouteFactor {
  id: string;
  label: string;
  /** Multiplier applied to the route's cost. Above 1 is a penalty. */
  effect: number;
  detail: string;
  /** Where the data behind this factor came from. */
  sourceState: GISSourceState;
}

/** How the map should draw a ranked route. */
export type RouteDisplay = 'PRIMARY' | 'ALTERNATE' | 'BLOCKED';

export interface RankedRoute {
  candidate: RouteCandidate;
  /** Adjusted cost in metres-equivalent. Lower is better. */
  score: number;
  factors: RouteFactor[];
  advisories: string[];
  recommended: boolean;
  display: RouteDisplay;
  /** One-line summary of why this route ranked where it did. */
  rationale: string;
}

export interface RouteRanking {
  routes: RankedRoute[];
  recommended: RankedRoute | null;
  /** Modelling limits and provenance caveats to show beside the route. */
  advisories: string[];
}

function fmt(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

/**
 * How much of a candidate runs along a corridor, as a share of its length.
 *
 * Measured against the corridor's own road-network geometry. A corridor with no
 * resolved geometry contributes nothing — there is no straight-line stand-in to
 * match against, which is the point.
 */
function corridorShare(candidate: RouteCandidate, corridor: CorridorSignal): number {
  if (corridor.path.length < 2) return 0;

  let matched = 0;
  let total = 0;
  const coords = candidate.coordinates;

  for (let i = 1; i < coords.length; i += 1) {
    const midLat = (coords[i - 1][0] + coords[i][0]) / 2;
    const midLng = (coords[i - 1][1] + coords[i][1]) / 2;
    const stepM = Math.hypot(
      (coords[i][0] - coords[i - 1][0]) * 111_195,
      (coords[i][1] - coords[i - 1][1]) * 104_300,
    );
    total += stepM;
    if (distanceToPolylineM(midLat, midLng, corridor.path) <= CORRIDOR_MATCH_M) matched += stepM;
  }

  return total > 0 ? matched / total : 0;
}

/** Congestion penalty per level. Applied only to the matched share of a route. */
const CONGESTION_PENALTY: Record<CorridorSignal['congestionLevel'], number> = {
  CLEAR: 0,
  SLOW: 0.25,
  JAMMED: 0.7,
  SEVERE: 1.2,
};

/**
 * Rank valid candidates and pick one to recommend.
 *
 * Scoring starts from real road distance — the one number here derived purely
 * from published geometry — and multiplies it by factors drawn from context.
 * Nothing is scored on a hunch, and every multiplier is reported.
 */
export function rankRoutes(candidates: readonly RouteCandidate[], context: RouteContext): RouteRanking {
  const advisories: string[] = [];

  if (candidates.length === 0) {
    return { routes: [], recommended: null, advisories };
  }

  const ranked: RankedRoute[] = candidates.map((candidate) => {
    const factors: RouteFactor[] = [];
    const routeAdvisories: string[] = [];
    let multiplier = 1;

    // --- Congestion, from corridor telemetry -----------------------------
    if (context.corridorSourceState !== 'no-data' && context.corridorSourceState !== 'unavailable') {
      for (const corridor of context.corridors) {
        const share = corridorShare(candidate, corridor);
        if (share < CORRIDOR_MATCH_SHARE) continue;

        const penalty = CONGESTION_PENALTY[corridor.congestionLevel] * share;
        if (penalty <= 0) continue;

        multiplier += penalty;
        factors.push({
          id: `congestion:${corridor.id}`,
          label: `${corridor.name} — ${corridor.congestionLevel}`,
          effect: 1 + penalty,
          detail: `${Math.round(share * 100)}% of this route runs on a corridor reporting ${corridor.congestionScore}% congestion.`,
          sourceState: context.corridorSourceState,
        });
      }
    }

    // --- Incidents on the path -------------------------------------------
    let blockedByIncident = false;
    if (context.incidentSourceState !== 'no-data' && context.incidentSourceState !== 'unavailable') {
      for (const incident of context.incidents) {
        const offset = distanceToPolylineM(incident.location.lat, incident.location.lng, candidate.coordinates);
        if (offset > INCIDENT_PROXIMITY_M) continue;

        if (incident.blocksRoad) {
          blockedByIncident = true;
          factors.push({
            id: `blocked:${incident.id}`,
            label: `Road closure — ${incident.title}`,
            effect: Number.POSITIVE_INFINITY,
            detail: `A road-blocking incident sits ${Math.round(offset)} m from this route.`,
            sourceState: context.incidentSourceState,
          });
          routeAdvisories.push(`Passes a reported road closure (${incident.id}).`);
          continue;
        }

        const penalty = incident.priority === 'CRITICAL' ? 0.35 : incident.priority === 'HIGH' ? 0.2 : 0.08;
        multiplier += penalty;
        factors.push({
          id: `incident:${incident.id}`,
          label: `${incident.priority} incident — ${incident.title}`,
          effect: 1 + penalty,
          detail: `Active incident ${Math.round(offset)} m from this route.`,
          sourceState: context.incidentSourceState,
        });
      }
    }

    // --- Road class, from published attributes ----------------------------
    // Emergency dispatch prefers arterial capacity: fewer side lanes, fewer
    // unmodelled turn restrictions, more room for a vehicle under lights.
    if (context.emergencyPriority) {
      const linkM = candidate.classBreakdown
        .filter((c) => c.classId === 'link-road')
        .reduce((sum, c) => sum + c.lengthM, 0);
      const linkShare = candidate.lengthM > 0 ? linkM / candidate.lengthM : 0;
      if (linkShare > 0.4) {
        const penalty = (linkShare - 0.4) * 0.5;
        multiplier += penalty;
        factors.push({
          id: 'link-road-share',
          label: 'Mostly link roads',
          effect: 1 + penalty,
          detail: `${Math.round(linkShare * 100)}% of this route is classified Link Road, the narrowest published class.`,
          sourceState: 'available-dataset',
        });
      }
    }

    const score = blockedByIncident ? Number.POSITIVE_INFINITY : candidate.lengthM * multiplier;

    return {
      candidate,
      score,
      factors,
      advisories: routeAdvisories,
      recommended: false,
      display: blockedByIncident ? ('BLOCKED' as RouteDisplay) : ('ALTERNATE' as RouteDisplay),
      rationale: '',
    };
  });

  ranked.sort((a, b) => a.score - b.score);

  const best = ranked.find((r) => Number.isFinite(r.score)) ?? null;
  if (best) {
    best.recommended = true;
    best.display = 'PRIMARY';
  }

  for (const route of ranked) {
    route.rationale = buildRationale(route, best);
  }

  // --- Ranking-wide caveats ---------------------------------------------
  if (context.corridorSourceState === 'simulation') {
    advisories.push('Congestion weighting uses simulated corridor telemetry, not a live traffic feed.');
  }
  if (context.corridorSourceState === 'unavailable' || context.corridorSourceState === 'no-data') {
    advisories.push('No traffic feed is available; ranking is by road distance and road class only.');
  }
  if (ranked.every((r) => !Number.isFinite(r.score))) {
    advisories.push('Every calculated route passes a reported road closure.');
  }

  return { routes: ranked, recommended: best, advisories };
}

function buildRationale(route: RankedRoute, best: RankedRoute | null): string {
  if (!Number.isFinite(route.score)) {
    return 'Not recommended: passes a reported road closure.';
  }

  const distance = fmt(route.candidate.lengthM);
  if (route.recommended) {
    if (route.factors.length === 0) {
      return `Recommended: shortest valid road path at ${distance} with no congestion or incident penalty applied.`;
    }
    return `Recommended: best adjusted cost at ${distance} after ${route.factors.length} weighting factor${route.factors.length === 1 ? '' : 's'}.`;
  }

  if (best && Number.isFinite(best.score)) {
    const deltaPct = Math.round(((route.score - best.score) / best.score) * 100);
    return `Alternate: ${distance} by road, ${deltaPct}% higher adjusted cost than the recommended route.`;
  }

  return `Alternate: ${distance} by road.`;
}
