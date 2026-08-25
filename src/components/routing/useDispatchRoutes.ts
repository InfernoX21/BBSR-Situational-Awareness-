/**
 * Dispatch and evacuation routes for the selected incident.
 *
 * Two movements matter when an operator opens an incident: how a response unit
 * gets there, and how a casualty gets out. Both used to be drawn as a straight
 * line between two markers. Both are now road routes.
 *
 * The layer split the redesign asks for is visible in the shape of this hook:
 *
 * - Geometry comes from `roadNetworkService` in an effect, because it involves
 *   network I/O and must not run on every telemetry tick.
 * - Ranking comes from `rankRoutes` in a memo, because it is a pure function of
 *   the candidates plus current context, and context changes every few seconds.
 *
 * Nothing in this file computes a coordinate. The nearest facility is chosen by
 * road distance rather than crow-fly, which is the whole point: the closest
 * hospital on a map is not always the closest hospital to drive to.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { HospitalNode, Incident, PoliceNode, TrafficCorridor } from '../../types';
import { CentralLayerManager } from '../../services/LayerManager';
import { roadNetworkService } from '../../services/routing/RoadNetworkService';
import type { RouteBestResult } from '../../services/routing/RoadNetworkService';
import {
  EMPTY_ROUTE_CONTEXT,
  rankRoutes,
  type CorridorSignal,
  type IncidentSignal,
  type RouteContext,
  type RouteRanking,
} from '../../services/routing/RouteIntelligence';
import type { NetworkProvenance, RouteFailure } from '../../services/routing/types';

/** How many crow-fly-nearest facilities to actually route to. */
const SHORTLIST = 3;

export type DispatchRouteKey = 'responder-dispatch' | 'casualty-evacuation';

export interface DispatchRouteView {
  key: DispatchRouteKey;
  /** Operator-facing name for the movement. */
  label: string;
  status: 'IDLE' | 'CALCULATING' | 'VALID' | 'FAILED';
  /** Where the movement starts, once a facility has been chosen by road distance. */
  fromLabel: string;
  toLabel: string;
  ranking: RouteRanking | null;
  failure: RouteFailure | null;
  network: NetworkProvenance | null;
  /** Every candidate considered, nearest by road first. */
  considered: { id: string; label: string; lengthM: number | null; failure: RouteFailure | null }[];
}

export interface DispatchRoutesState {
  routes: DispatchRouteView[];
  calculating: boolean;
  /** What this city's road data can and cannot support. */
  capability: ReturnType<typeof roadNetworkService.describe>;
  /** Modelling limits and provenance caveats worth showing beside the routes. */
  advisories: string[];
}

interface SolvedMovement {
  key: DispatchRouteKey;
  label: string;
  result: RouteBestResult;
  /** Candidate id → operator-facing name. */
  names: Record<string, string>;
  anchorLabel: string;
  /** True when the anchor (the incident) is the destination. */
  towardsAnchor: boolean;
}

const IDLE_VIEW: Record<DispatchRouteKey, Pick<DispatchRouteView, 'key' | 'label'>> = {
  'responder-dispatch': { key: 'responder-dispatch', label: 'Responder dispatch' },
  'casualty-evacuation': { key: 'casualty-evacuation', label: 'Casualty evacuation' },
};

function idle(key: DispatchRouteKey): DispatchRouteView {
  return {
    ...IDLE_VIEW[key],
    status: 'IDLE',
    fromLabel: '—',
    toLabel: '—',
    ranking: null,
    failure: null,
    network: null,
    considered: [],
  };
}

function policeLabel(unit: PoliceNode): string {
  return unit.unitCallsign ? `${unit.unitCallsign} · ${unit.name}` : unit.name;
}

function hospitalLabel(hospital: HospitalNode): string {
  return `${hospital.name} · ${hospital.availableBeds} beds free`;
}

export function useDispatchRoutes(input: {
  selectedIncident: Incident | null;
  incidents: readonly Incident[];
  /** Corridors carrying resolved road geometry. Straight-line paths are ignored. */
  corridors: readonly TrafficCorridor[];
  enabled: boolean;
}): DispatchRoutesState {
  const { selectedIncident, incidents, corridors, enabled } = input;
  const layerManager = CentralLayerManager.getInstance();

  const [solved, setSolved] = useState<SolvedMovement[]>([]);
  const [calculating, setCalculating] = useState(false);
  const [fatal, setFatal] = useState<RouteFailure | null>(null);

  const capability = useMemo(() => roadNetworkService.describe(), []);

  // Keyed on the incident, not on the incident object: telemetry updates rewrite
  // the record every few seconds and must not restart a network fetch.
  const incidentKey = selectedIncident
    ? `${selectedIncident.id}:${selectedIncident.location.lat.toFixed(5)},${selectedIncident.location.lng.toFixed(5)}`
    : null;

  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!enabled || !selectedIncident || !roadNetworkService.available) {
      setSolved([]);
      setFatal(null);
      setCalculating(false);
      return;
    }

    const anchor = { lat: selectedIncident.location.lat, lng: selectedIncident.location.lng };
    const units = layerManager.nearestPolicePatrols(anchor.lat, anchor.lng, SHORTLIST);
    const hospitals = layerManager.nearestHospitals(anchor.lat, anchor.lng, SHORTLIST);

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;

    setCalculating(true);
    setFatal(null);

    (async () => {
      const movements: SolvedMovement[] = [];

      try {
        if (units.length > 0) {
          const result = await roadNetworkService.routeBest(
            anchor,
            units.map((unit) => ({ id: unit.id, point: { lat: unit.lat, lng: unit.lng } })),
            { direction: 'TO_ANCHOR', signal: controller.signal },
          );
          movements.push({
            key: 'responder-dispatch',
            label: 'Responder dispatch',
            result,
            names: Object.fromEntries(units.map((unit) => [unit.id, policeLabel(unit)])),
            anchorLabel: selectedIncident.location.name,
            towardsAnchor: true,
          });
        }

        if (hospitals.length > 0) {
          const result = await roadNetworkService.routeBest(
            anchor,
            hospitals.map((hospital) => ({ id: hospital.id, point: { lat: hospital.lat, lng: hospital.lng } })),
            { direction: 'FROM_ANCHOR', signal: controller.signal },
          );
          movements.push({
            key: 'casualty-evacuation',
            label: 'Casualty evacuation',
            result,
            names: Object.fromEntries(hospitals.map((hospital) => [hospital.id, hospitalLabel(hospital)])),
            anchorLabel: selectedIncident.location.name,
            towardsAnchor: false,
          });
        }

        if (requestIdRef.current !== requestId) return;
        setSolved(movements);
      } catch (error) {
        if (requestIdRef.current !== requestId) return;
        // A cancelled wait is not a network fault. The routing service rethrows an
        // abandonment rather than reporting it as a routing verdict, so it must not
        // be turned into a failure banner here either.
        if (controller.signal.aborted || (error instanceof Error && error.name === 'AbortError')) return;
        setSolved([]);
        setFatal({
          code: 'ROAD_NETWORK_REQUEST_FAILED',
          message: 'ROAD NETWORK REQUEST FAILED',
          detail: error instanceof Error ? error.message : 'The road network could not be reached.',
        });
      } finally {
        if (requestIdRef.current === requestId) setCalculating(false);
      }
    })();

    return () => {
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, incidentKey]);

  // --- Intelligence layer: pure, and re-run as context moves ---------------

  const context = useMemo<RouteContext>(() => {
    if (!selectedIncident) return EMPTY_ROUTE_CONTEXT;

    // Only corridors with real road geometry can influence a ranking. An
    // unresolved corridor contributes nothing rather than matching against the
    // straight line it used to be drawn as.
    const corridorSignals: CorridorSignal[] = corridors
      .filter((corridor) => corridor.pathStatus === 'ROAD_NETWORK' && corridor.path.length >= 2)
      .map((corridor) => ({
        id: corridor.id,
        name: corridor.name,
        path: corridor.path,
        congestionLevel: corridor.congestionLevel,
        congestionScore: corridor.congestionScore,
      }));

    const incidentSignals: IncidentSignal[] = incidents
      .filter((incident) => incident.status === 'ACTIVE' || incident.status === 'DISPATCHED')
      .map((incident) => ({
        id: incident.id,
        title: incident.title,
        location: { lat: incident.location.lat, lng: incident.location.lng },
        priority: incident.priority,
        // ARKA's incident model publishes no road-closure flag, and inferring one
        // from priority or category would fabricate a closure. Until a source
        // records closures, no route is ever marked blocked by an incident.
        blocksRoad: false,
      }));

    return {
      corridors: corridorSignals,
      // Corridor congestion is seeded locally and replaced by the traffic
      // endpoint's SIMULATED demo feed. Neither is a live sensor read, so the
      // weighting it drives is labelled as simulation wherever it is shown.
      corridorSourceState: corridorSignals.length > 0 ? 'simulation' : 'no-data',
      incidents: incidentSignals,
      incidentSourceState: incidentSignals.length > 0 ? 'simulation' : 'no-data',
      emergencyPriority: selectedIncident.priority === 'CRITICAL' || selectedIncident.priority === 'HIGH',
    };
  }, [corridors, incidents, selectedIncident]);

  const routes = useMemo<DispatchRouteView[]>(() => {
    if (!enabled || !selectedIncident) {
      return [idle('responder-dispatch'), idle('casualty-evacuation')];
    }

    if (!capability.available) {
      const failure: RouteFailure = {
        code: 'ROAD_NETWORK_UNAVAILABLE',
        message: 'ROAD NETWORK UNAVAILABLE',
        detail: 'This city publishes no routable road geometry, so no dispatch route can be calculated.',
      };
      return (['responder-dispatch', 'casualty-evacuation'] as DispatchRouteKey[]).map((key) => ({
        ...idle(key),
        status: 'FAILED' as const,
        failure,
      }));
    }

    const byKey = new Map<DispatchRouteKey, SolvedMovement>(
      solved.map((movement) => [movement.key, movement]),
    );

    return (['responder-dispatch', 'casualty-evacuation'] as DispatchRouteKey[]).map((key) => {
      const movement = byKey.get(key);

      if (!movement) {
        const base = idle(key);
        if (fatal) return { ...base, status: 'FAILED' as const, failure: fatal };
        if (calculating) return { ...base, status: 'CALCULATING' as const };
        return {
          ...base,
          status: 'FAILED' as const,
          failure: {
            code: 'NO_VALID_ROUTE_AVAILABLE',
            message: 'NO VALID ROUTE AVAILABLE',
            detail:
              key === 'responder-dispatch'
                ? 'No dispatchable unit is currently available to route from.'
                : 'No hospital is available to route to.',
          },
        };
      }

      const considered = movement.result.evaluated.map((entry) => ({
        id: entry.id,
        label: movement.names[entry.id] ?? entry.id,
        lengthM: entry.lengthM,
        failure: entry.failure,
      }));

      if (movement.result.status !== 'VALID' || !movement.result.solution) {
        return {
          ...idle(key),
          status: 'FAILED' as const,
          failure: movement.result.failure,
          network: movement.result.network,
          considered,
        };
      }

      const chosenId = movement.result.chosenId;
      const chosenName = (chosenId && movement.names[chosenId]) || 'Unnamed unit';
      const ranking = rankRoutes(movement.result.solution.candidates, context);

      return {
        key,
        label: movement.label,
        status: 'VALID' as const,
        fromLabel: movement.towardsAnchor ? chosenName : movement.anchorLabel,
        toLabel: movement.towardsAnchor ? movement.anchorLabel : chosenName,
        ranking,
        failure: null,
        network: movement.result.network,
        considered,
      };
    });
  }, [enabled, selectedIncident, capability.available, solved, context, calculating, fatal]);

  const advisories = useMemo(() => {
    const notes: string[] = [];
    if (!capability.available) return notes;

    if (!capability.directionModelled) {
      notes.push('One-way restrictions are not modelled: the road dataset publishes no travel-direction attribute.');
    }
    if (!capability.speedPublished) {
      notes.push('Travel time is unavailable: the road dataset publishes no speed or free-flow attribute.');
    }
    if (!capability.serverRouting) {
      notes.push('Pathfinding runs locally in ARKA; the city GIS deployment exposes no network-analysis service.');
    }
    for (const route of routes) {
      if (route.network?.truncated) {
        notes.push('The road network was truncated by a provider record cap, so a shorter route may exist.');
        break;
      }
    }
    for (const route of routes) {
      for (const note of route.ranking?.advisories ?? []) {
        if (!notes.includes(note)) notes.push(note);
      }
    }
    return notes;
  }, [capability, routes]);

  return { routes, calculating, capability, advisories };
}
