/**
 * Resolves traffic corridors onto the road network.
 *
 * ARKA holds a corridor as an ordered list of real named junctions — Jayadev
 * Vihar rotary, Master Canteen, Patia Infocity. Those anchors are good data. What
 * was wrong was drawing them: joining consecutive anchors with a straight line
 * produced a corridor that cut across blocks, water and open land.
 *
 * This hook asks the routing engine for the actual road segments between each
 * consecutive pair and attaches the result as the corridor's drawable `path`. A
 * corridor whose legs cannot all be joined comes back `PARTIAL`; one that cannot
 * be resolved at all stays without geometry and is not drawn. Nothing here
 * fabricates a shape to fill the gap.
 *
 * Corridors are resolved against the city-wide arterial skeleton, which is a
 * single session-long fetch. That is both faster than a link-road pull per
 * corridor and truer to the data: a corridor named "National Highway 16" should
 * be resolved along highways, not through whichever lane happens to be shorter.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { TrafficCorridor } from '../../types';
import { roadNetworkService } from '../../services/routing/RoadNetworkService';

interface ResolvedGeometry {
  path: [number, number][];
  pathStatus: TrafficCorridor['pathStatus'];
  pathLengthM: number | null;
  pathNote?: string;
}

export interface CorridorGeometryState {
  /** Input corridors with real road geometry attached where it was resolved. */
  corridors: TrafficCorridor[];
  /** True while at least one corridor is still being resolved. */
  resolving: boolean;
  /** Corridors with complete road geometry. */
  resolvedCount: number;
  /** Corridors with partial geometry, or none at all. */
  unresolvedCount: number;
  /**
   * Why each unresolved corridor has no drawable geometry.
   *
   * Surfaced rather than swallowed: "4 of 6 resolved" on its own tells an operator
   * that something is missing but not what, and the reason is the routing engine's
   * own account of which leg it could not join.
   */
  unresolved: { id: string; name: string; status: TrafficCorridor['pathStatus']; note: string | null }[];
}

/** Identity of a corridor's anchor list, so telemetry refreshes do not re-resolve. */
function waypointSignature(corridor: TrafficCorridor): string {
  const points = corridor.waypoints ?? [];
  return `${corridor.id}::${points.map((p) => `${p[0].toFixed(5)},${p[1].toFixed(5)}`).join('|')}`;
}

/** True when a rejection is a cancelled wait rather than a routing outcome. */
function isAbandoned(error: unknown): boolean {
  return error instanceof Error && error.name === 'AbortError';
}

/** How many times an abandoned wait is retried before it is reported as a failure. */
const MAX_RETRIES = 2;

export function useCorridorGeometry(
  corridors: readonly TrafficCorridor[],
  enabled: boolean,
): CorridorGeometryState {
  const cacheRef = useRef<Map<string, ResolvedGeometry>>(new Map());
  const [version, setVersion] = useState(0);
  const [resolving, setResolving] = useState(false);
  const [retry, setRetry] = useState(0);

  // Signature list drives the effect, so a five-second telemetry poll that
  // returns the same anchors does not restart resolution.
  const signatures = useMemo(
    () => corridors.map((corridor) => ({ corridor, key: waypointSignature(corridor) })),
    [corridors],
  );
  const signatureKey = signatures.map((s) => s.key).join('~');

  useEffect(() => {
    if (!enabled || !roadNetworkService.available) return;

    const pending = signatures.filter(
      (entry) => !cacheRef.current.has(entry.key) && (entry.corridor.waypoints?.length ?? 0) >= 2,
    );
    if (pending.length === 0) return;

    const controller = new AbortController();
    let cancelled = false;
    setResolving(true);

    // Sequential on purpose: the first corridor pays for the skeleton fetch and
    // every one after it reuses the same graph, so parallelising would only
    // multiply the same request.
    (async () => {
      for (const entry of pending) {
        if (cancelled) return;

        const waypoints = entry.corridor.waypoints.map(([lat, lng]) => ({ lat, lng }));
        try {
          const result = await roadNetworkService.routeChain(waypoints, {
            signal: controller.signal,
            objective: 'ARTERIAL',
            arterialOnly: true,
            // Junction anchors are surveyed to the intersection centre, which can
            // sit a little off the published carriageway centreline.
            maxSnapDistanceM: 400,
          });
          if (cancelled) return;

          cacheRef.current.set(entry.key, {
            path: result.coordinates,
            pathStatus:
              result.status === 'VALID' ? 'ROAD_NETWORK' : result.status === 'PARTIAL' ? 'PARTIAL' : 'NO_ROUTE',
            pathLengthM: result.lengthM > 0 ? result.lengthM : null,
            pathNote: result.failure?.detail,
          });
        } catch (error) {
          if (cancelled) return;

          // A cancelled wait is not a routing outcome. The road-network fetches
          // are shared across the page, so a rejection here can originate in
          // another consumer walking away; caching it would leave this corridor
          // permanently marked unroutable on the strength of someone else's
          // cancellation. Retry a bounded number of times instead.
          if (isAbandoned(error) && retry < MAX_RETRIES) {
            setRetry((r) => r + 1);
            return;
          }

          cacheRef.current.set(entry.key, {
            path: [],
            pathStatus: 'NO_ROUTE',
            pathLengthM: null,
            pathNote: error instanceof Error ? error.message : 'Road network request failed.',
          });
        }

        setVersion((v) => v + 1);
      }

      if (!cancelled) setResolving(false);
    })();

    return () => {
      cancelled = true;
      controller.abort();
      setResolving(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, signatureKey, retry]);

  return useMemo(() => {
    let resolvedCount = 0;
    let unresolvedCount = 0;
    const unresolved: CorridorGeometryState['unresolved'] = [];

    const withGeometry = signatures.map(({ corridor, key }) => {
      const resolved = cacheRef.current.get(key);
      if (!resolved) {
        unresolvedCount += 1;
        const status = (enabled ? 'RESOLVING' : 'UNRESOLVED') as TrafficCorridor['pathStatus'];
        unresolved.push({ id: corridor.id, name: corridor.name, status, note: null });
        return {
          ...corridor,
          path: [] as [number, number][],
          pathStatus: status,
          pathLengthM: null,
        };
      }

      if (resolved.pathStatus === 'ROAD_NETWORK') {
        resolvedCount += 1;
      } else {
        unresolvedCount += 1;
        unresolved.push({
          id: corridor.id,
          name: corridor.name,
          status: resolved.pathStatus,
          note: resolved.pathNote ?? null,
        });
      }

      return { ...corridor, ...resolved };
    });

    return { corridors: withGeometry, resolving, resolvedCount, unresolvedCount, unresolved };
    // `version` is what makes an async cache write visible here; `signatureKey`
    // stands in for the corridor list identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signatureKey, version, resolving, enabled, signatures]);
}
