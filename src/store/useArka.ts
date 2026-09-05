/**
 * React bindings for the central store.
 *
 * Built on `useSyncExternalStore`, so a component subscribes to exactly the
 * channel it cares about and React tears the subscription down correctly under
 * `<StrictMode>`'s double-mount (which this app runs — see `src/main.tsx`).
 *
 * **The rule that matters when adding a hook here:** whatever you pass as
 * `getSnapshot` must return a *referentially stable* value between mutations.
 * Returning a freshly-built array or object on every call makes React think the
 * store changed on every render and it will loop. So the hooks below return raw
 * slices, and anything derived — filtered, sorted, counted — is computed in a
 * `useMemo` keyed on the slice.
 */

import { useCallback, useMemo, useSyncExternalStore } from 'react';
import type { NavItem } from '../types';
import {
  arkaStore,
  bucketOf,
  type Assignment,
  type AssignmentSlice,
  type EntitySlice,
  type FeedSlice,
  type FeedStatus,
  type StoreChannel,
} from './ArkaStore';
import {
  HEALTH_RANK,
  refKey,
  type AnyEntity,
  type EntityByKind,
  type EntityKind,
  type EntityRef,
} from './entities';
import { filterEvents, type ArkaEvent, type EventFilter } from './events';
import { HOME_TAB_FOR_KIND, type Focus, type MapIntent } from './focus';
import type { ArkaSettings } from './settings';

/** Subscribes to one channel. `getSnapshot` must return a stable reference. */
function useChannel<T>(channel: StoreChannel, getSnapshot: () => T): T {
  const subscribe = useCallback((onChange: () => void) => arkaStore.subscribe(channel, onChange), [channel]);
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// --- Entities ----------------------------------------------------------------

export function useEntitySlice(): EntitySlice {
  return useChannel('entities', arkaStore.getEntities);
}

/**
 * All records of one kind.
 *
 * The returned array keeps its identity while that kind is untouched, so a
 * weather tick does not re-render the incident list.
 */
export function useEntitiesOfKind<K extends EntityKind>(kind: K): readonly EntityByKind[K][] {
  const slice = useEntitySlice();
  return bucketOf(slice, kind);
}

/** Resolves a ref against the live snapshot. Null once the record has gone. */
export function useEntity(ref: EntityRef | null): AnyEntity | null {
  const slice = useEntitySlice();
  const key = ref ? refKey(ref) : null;
  return useMemo(() => (key == null ? null : slice.index.get(key) ?? null), [slice, key]);
}

/** Ref lookup narrowed to a kind, for call sites that know what they want. */
export function useEntityOfKind<K extends EntityKind>(kind: K, id: string | null): EntityByKind[K] | null {
  const slice = useEntitySlice();
  return useMemo(() => {
    if (!id) return null;
    const found = slice.index.get(refKey({ kind, id }));
    return (found && found.kind === kind ? (found as EntityByKind[K]) : null);
  }, [slice, kind, id]);
}

/** Worst-health-first ordering, the default for any operational list. */
export function useEntitiesByUrgency<K extends EntityKind>(kind: K): readonly EntityByKind[K][] {
  const records = useEntitiesOfKind(kind);
  return useMemo(
    () => [...records].sort((a, b) => HEALTH_RANK[a.health] - HEALTH_RANK[b.health]),
    [records]
  );
}

// --- Events ------------------------------------------------------------------

export function useEvents(): readonly ArkaEvent[] {
  return useChannel('events', arkaStore.getEvents);
}

/** The event stream through an operator filter. */
export function useFilteredEvents(filter: EventFilter): ArkaEvent[] {
  const events = useEvents();
  return useMemo(() => filterEvents(events, filter), [events, filter]);
}

/** Events naming a particular entity — the timeline for one thing. */
export function useEventsForEntity(ref: EntityRef | null): ArkaEvent[] {
  const events = useEvents();
  const key = ref ? refKey(ref) : null;
  return useMemo(() => {
    if (!key) return [];
    return events.filter((event) => event.subjects.some((subject) => refKey(subject) === key));
  }, [events, key]);
}

// --- Feeds -------------------------------------------------------------------

export function useFeeds(): FeedSlice {
  return useChannel('feeds', arkaStore.getFeeds);
}

export function useFeedList(): FeedStatus[] {
  const feeds = useFeeds();
  return useMemo(() => Object.values(feeds).sort((a, b) => a.label.localeCompare(b.label)), [feeds]);
}

export function useFeed(id: string): FeedStatus | null {
  const feeds = useFeeds();
  return feeds[id] ?? null;
}

// --- Assignments -------------------------------------------------------------

export function useAssignments(): AssignmentSlice {
  return useChannel('assignments', arkaStore.getAssignments);
}

export function useAssignmentsForIncident(incidentId: string | null): Assignment[] {
  const assignments = useAssignments();
  return useMemo(
    () => (incidentId ? assignments.filter((a) => a.incidentId === incidentId) : []),
    [assignments, incidentId]
  );
}

export function useAssignmentForUnit(unitId: string | null): Assignment | null {
  const assignments = useAssignments();
  return useMemo(
    () => (unitId ? assignments.find((a) => a.unitId === unitId) ?? null : null),
    [assignments, unitId]
  );
}

// --- Settings ----------------------------------------------------------------

export function useSettings(): ArkaSettings {
  return useChannel('settings', arkaStore.getSettings);
}

// --- Focus -------------------------------------------------------------------

export function useFocus(): Focus {
  return useChannel('focus', arkaStore.getFocus);
}

/** The focused entity, resolved. Convenience for the common pairing. */
export function useFocusedEntity(): AnyEntity | null {
  const focus = useFocus();
  return useEntity(focus.entity);
}

/**
 * Navigation actions.
 *
 * Plain functions on a module-level singleton rather than context values, so any
 * component can deep-link without a provider in its ancestry and without the
 * callback churn that would re-render the map on every parent update.
 */
export const arkaNav = {
  /** Switch module, leaving the selection alone. */
  goTo(tab: NavItem): void {
    arkaStore.setTab(tab);
  },

  /** Select an entity in place, without navigating. */
  select(entity: EntityRef | null): void {
    arkaStore.setFocus({ entity });
  },

  /** Select an entity and open the module that owns it. */
  open(entity: EntityRef): void {
    arkaStore.setFocus({ entity, tab: HOME_TAB_FOR_KIND[entity.kind] });
  },

  /** Select an entity and ask the map to go to it. */
  locate(entity: EntityRef, intent: MapIntent = 'locate', tab: NavItem = 'Live City'): void {
    arkaStore.setFocus({ entity, tab, mapIntent: intent });
  },

  /** Clear the selection. */
  clear(): void {
    arkaStore.setFocus({ entity: null });
  },

  /** Return to whichever module requested the current focus. */
  back(): void {
    const { origin } = arkaStore.getFocus();
    if (origin) arkaStore.setTab(origin);
  },
};
