/**
 * Cross-module focus: the answer to "what is the operator looking at?"
 *
 * This is the mechanism behind every deep link the brief asks for — clicking a
 * marker and landing on the right incident, clicking an anomaly and landing on
 * the signals that produced it, clicking a resource and seeing it on the map.
 *
 * The design point is that focus is a *single* piece of shared state rather than
 * a parameter threaded through navigation callbacks. Threading works for one hop
 * (`setSelectedIncident` then `setActiveTab`) but collapses at two: there is no
 * way for the Analytics page to say "open the Incident Center on this incident,
 * and when the operator jumps to the map from there, keep it selected". Holding
 * focus centrally makes that automatic, because nothing has to pass it along.
 *
 * Focus is intentionally *not* an entity copy — only a reference. Entities are
 * replaced wholesale on every feed tick, so a stored copy would go stale within
 * seconds. Resolving the ref at read time means the selection always shows the
 * newest telemetry for the thing selected.
 */

import type { NavItem } from '../types';
import type { EntityRef } from './entities';
import { sameRef } from './entities';

/** What the map should do about the current selection. */
export type MapIntent =
  /** Nothing pending; the map is under the operator's control. */
  | 'none'
  /** Centre and zoom on the focused entity. */
  | 'locate'
  /** Centre, zoom, and draw attention to it. */
  | 'highlight';

export interface Focus {
  /** The module currently on screen. */
  tab: NavItem;
  /** The entity in context, shared across every module. Null when nothing is selected. */
  entity: EntityRef | null;
  /**
   * A pending instruction for the map, consumed once the map has acted on it.
   *
   * Modelled as a one-shot rather than a persistent flag because "locate this"
   * is an event, not a state: re-rendering the map must not re-trigger a fly-to
   * and yank the view out from under an operator who has since panned away.
   */
  mapIntent: MapIntent;
  /**
   * Monotonic counter bumped on every focus request, including a repeat request
   * for the entity already focused. Without it, clicking "locate on map" twice
   * for the same entity would be indistinguishable from a re-render and the
   * second click would do nothing.
   */
  nonce: number;
  /** Which module asked for this focus, for the "came from" affordance. */
  origin: NavItem | null;
}

export const INITIAL_FOCUS: Focus = {
  tab: 'Command Center',
  entity: null,
  mapIntent: 'none',
  nonce: 0,
  origin: null,
};

/** A focus request. Any field left out is preserved from the current focus. */
export interface FocusRequest {
  tab?: NavItem;
  entity?: EntityRef | null;
  mapIntent?: MapIntent;
}

export function applyFocus(current: Focus, request: FocusRequest): Focus {
  const nextTab = request.tab ?? current.tab;
  const nextEntity = request.entity === undefined ? current.entity : request.entity;
  return {
    tab: nextTab,
    entity: nextEntity,
    mapIntent: request.mapIntent ?? 'none',
    nonce: current.nonce + 1,
    // Only record an origin when the tab actually changed, so "back to where I
    // came from" doesn't point at the page you are already on.
    origin: nextTab !== current.tab ? current.tab : current.origin,
  };
}

/**
 * True when nothing about the focus changed in a way anyone needs to react to.
 * Used to avoid notifying subscribers for a no-op request.
 */
export function focusEquivalent(a: Focus, b: Focus): boolean {
  return (
    a.tab === b.tab &&
    a.mapIntent === b.mapIntent &&
    a.nonce === b.nonce &&
    a.origin === b.origin &&
    sameRef(a.entity, b.entity)
  );
}

/**
 * Which destination owns an entity kind — where "open details" should land.
 *
 * One table rather than a `switch` at each call site, so a marker on the map, a
 * row in analytics and a chip on an event all navigate to the same place.
 *
 * A corridor lands on Mobility because a corridor is part of how the city moves;
 * a roadside detector lands on Sensors because a detector is a piece of estate
 * ARKA operates and maintains. The two used to share a page and the distinction
 * was invisible.
 */
export const HOME_TAB_FOR_KIND: Record<EntityRef['kind'], NavItem> = {
  incident: 'Active Situations',
  resource: 'Resources',
  drone: 'Drones',
  camera: 'Cameras',
  sensor: 'Sensors',
  corridor: 'Mobility',
  infrastructure: 'Infrastructure',
  utility: 'Utilities',
  weather: 'Environment',
  intelligence: 'Intelligence',
};
