/**
 * The central entity and event store.
 *
 * Every module reads from here and nothing keeps its own copy of the city. When
 * an incident's status changes, one mutation lands here and the map, dashboard,
 * incident list, intelligence feed, resource tracker, analytics and ticker all
 * see it — not because they are wired to each other, but because they were never
 * holding separate data in the first place.
 *
 * Design notes worth knowing before editing:
 *
 * **Channels, not one big snapshot.** Subscribers register against a named slice
 * (`entities`, `events`, `feeds`, `focus`, `assignments`). The ticker re-renders
 * when an event arrives; it does not re-render because someone clicked a marker.
 * A single global version counter would make every selection change repaint the
 * whole application.
 *
 * **Immutable slices.** Each slice is replaced, never mutated, so React's
 * `useSyncExternalStore` can compare by identity and `getSnapshot` is safe to
 * call during render. Mutating in place is the classic way to make that hook
 * silently miss updates.
 *
 * **Feeds own their collections.** A feed tick calls `replaceKind`, which is
 * authoritative: if the live camera feed returns nothing, the cameras disappear.
 * That is deliberate. Retaining the previous list would leave the operator
 * looking at a stale picture with no indication it had stopped updating.
 */

import type { DataError, DataState, SourceMeta } from '../shared/dataState';
import type { NavItem } from '../types';
import {
  refKey,
  type AnyEntity,
  type EntityByKind,
  type EntityKind,
  type EntityRef,
} from './entities';
import { byNewest, type ArkaEvent, type ArkaEventInput } from './events';
import { applyFocus, focusEquivalent, INITIAL_FOCUS, type Focus, type FocusRequest } from './focus';
import {
  DEFAULT_SETTINGS,
  clearStoredSettings,
  loadSettings,
  mergeSettings,
  persistSettings,
  type ArkaSettings,
  type SettingsPatch,
} from './settings';

/** Slices a caller may subscribe to independently. */
export type StoreChannel = 'entities' | 'events' | 'feeds' | 'focus' | 'assignments' | 'settings';

const ALL_CHANNELS: StoreChannel[] = [
  'entities',
  'events',
  'feeds',
  'focus',
  'assignments',
  'settings',
];

/**
 * How many events the stream retains.
 *
 * Bounded because the store lives for the whole session and the feeds never
 * stop. 750 covers roughly a full shift at observed cadences while staying small
 * enough that the analytics pass over it stays instant.
 */
const EVENT_CAPACITY = 750;

// --- Entities ----------------------------------------------------------------

/**
 * One array per kind, as a mapped type.
 *
 * Written as a mapped type rather than ten declared properties so that
 * `buckets[kind]` for a generic `K extends EntityKind` resolves to
 * `readonly EntityByKind[K][]`. Spelling the properties out individually makes
 * that indexed access collapse to a union of all ten array types and forces every
 * generic selector into a cast.
 */
export type EntityBuckets = {
  readonly [K in EntityKind]: readonly EntityByKind[K][];
};

/** The entities slice: the per-kind buckets, plus a flat index for ref lookup. */
export interface EntitySlice extends EntityBuckets {
  /** Keyed by `refKey`, so any ref resolves in one lookup. */
  readonly index: ReadonlyMap<string, AnyEntity>;
}

/**
 * Reads one bucket out of a slice with the element type preserved.
 *
 * The widening assignment to `EntityBuckets` is what makes this work: indexing an
 * interface with a generic key yields a union, while indexing the mapped type it
 * extends yields the precise element type. No cast involved.
 */
export function bucketOf<K extends EntityKind>(slice: EntitySlice, kind: K): readonly EntityByKind[K][] {
  const buckets: EntityBuckets = slice;
  return buckets[kind];
}

const EMPTY_ENTITY_SLICE: EntitySlice = {
  incident: [],
  resource: [],
  drone: [],
  camera: [],
  sensor: [],
  infrastructure: [],
  intelligence: [],
  weather: [],
  utility: [],
  corridor: [],
  index: new Map(),
};

// --- Feeds -------------------------------------------------------------------

/** How a feed reaches ARKA. Reported so the operator can see the mechanism. */
export type TransportKind = 'websocket' | 'sse' | 'poll' | 'request' | 'local';

export interface FeedStatus {
  id: string;
  label: string;
  transport: TransportKind;
  state: DataState;
  source: SourceMeta;
  /** ISO 8601 of the last attempt, successful or not. */
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  /** Round-trip of the last successful attempt. Null when never succeeded. */
  latencyMs: number | null;
  error: DataError | null;
  /** Requested cadence in seconds. 0 for push transports. */
  cadenceSeconds: number;
  /** Records handed over by the last successful attempt. */
  recordCount: number | null;
}

export type FeedSlice = Readonly<Record<string, FeedStatus>>;

// --- Assignments -------------------------------------------------------------

export type AssignmentStatus = 'ASSIGNED' | 'EN_ROUTE' | 'ON_SCENE' | 'RETURNING' | 'CLEARED';

/**
 * An operator's record that a unit is working an incident.
 *
 * This is the one class of data in ARKA that is genuinely created here rather
 * than fetched, which is why it carries `SourceKind: 'operator'` and a note
 * saying no agency dispatch system has confirmed it. It is real — the operator
 * really did assign the unit — but it is not an agency CAD record.
 */
export interface Assignment {
  unitId: string;
  incidentId: string;
  assignedAt: string;
  status: AssignmentStatus;
  /** Set when the assignment followed a route calculation, for traceability. */
  basis: 'operator' | 'route-recommendation';
  /** Road distance in metres when the assignment came from a route. */
  routeLengthM: number | null;
}

export type AssignmentSlice = readonly Assignment[];

export const ASSIGNMENT_SOURCE: SourceMeta = {
  provider: 'ARKA operator entry',
  kind: 'operator',
  note: 'Recorded in ARKA by an operator on this workstation. Not confirmed by an agency dispatch system.',
};

// --- Store -------------------------------------------------------------------

type Listener = () => void;

/**
 * The mutable working set, one map per kind and each typed to its own record.
 *
 * Correlating the key with the value type here is what keeps `patch`, `replaceKind`
 * and the snapshot rebuild free of assertions — the compiler knows that the map
 * under `'incident'` holds incidents.
 */
type KindMaps = {
  readonly [K in EntityKind]: Map<string, EntityByKind[K]>;
};

export class ArkaStore {
  private static instance: ArkaStore | null = null;

  private readonly maps: KindMaps = {
    incident: new Map(),
    resource: new Map(),
    drone: new Map(),
    camera: new Map(),
    sensor: new Map(),
    infrastructure: new Map(),
    intelligence: new Map(),
    weather: new Map(),
    utility: new Map(),
    corridor: new Map(),
  };

  private entitySlice: EntitySlice = EMPTY_ENTITY_SLICE;
  private eventSlice: readonly ArkaEvent[] = [];
  private feedSlice: FeedSlice = {};
  private focusSlice: Focus = INITIAL_FOCUS;
  private assignmentSlice: AssignmentSlice = [];
  private settingsSlice: ArkaSettings = loadSettings();

  private readonly listeners = new Map<StoreChannel, Set<Listener>>();

  /**
   * Set while a batch is open, collecting channels that changed. Lets an
   * ingestion tick that touches entities, events and feed health notify each
   * channel once instead of three times, which is the difference between one
   * repaint and three.
   */
  private batchDepth = 0;
  private readonly pending = new Set<StoreChannel>();

  /** Monotonic counter for generated event ids; avoids collisions within a tick. */
  private eventSeq = 0;

  private constructor() {
    for (const channel of ALL_CHANNELS) this.listeners.set(channel, new Set());
  }

  static getInstance(): ArkaStore {
    if (!ArkaStore.instance) ArkaStore.instance = new ArkaStore();
    return ArkaStore.instance;
  }

  // --- Subscription ---------------------------------------------------------

  subscribe(channel: StoreChannel, listener: Listener): () => void {
    const set = this.listeners.get(channel);
    if (!set) return () => {};
    set.add(listener);
    return () => {
      set.delete(listener);
    };
  }

  private mark(channel: StoreChannel): void {
    if (this.batchDepth > 0) {
      this.pending.add(channel);
      return;
    }
    this.flush([channel]);
  }

  private flush(channels: Iterable<StoreChannel>): void {
    for (const channel of channels) {
      const set = this.listeners.get(channel);
      if (!set) continue;
      // Copied before iterating: a listener that unsubscribes during notification
      // would otherwise mutate the set mid-iteration.
      for (const listener of Array.from(set)) listener();
    }
  }

  /**
   * Runs `work` with notifications deferred until it returns.
   *
   * Re-entrant, so an ingestion adapter can batch internally without knowing
   * whether its caller already opened a batch.
   */
  batch<T>(work: () => T): T {
    this.batchDepth += 1;
    try {
      return work();
    } finally {
      this.batchDepth -= 1;
      if (this.batchDepth === 0 && this.pending.size > 0) {
        const channels = Array.from(this.pending);
        this.pending.clear();
        this.flush(channels);
      }
    }
  }

  // --- Reads ----------------------------------------------------------------

  getEntities = (): EntitySlice => this.entitySlice;
  getEvents = (): readonly ArkaEvent[] => this.eventSlice;
  getFeeds = (): FeedSlice => this.feedSlice;
  getFocus = (): Focus => this.focusSlice;
  getAssignments = (): AssignmentSlice => this.assignmentSlice;
  getSettings = (): ArkaSettings => this.settingsSlice;

  /** Resolves a ref against the current snapshot, or null if it has gone. */
  resolve(ref: EntityRef | null): AnyEntity | null {
    if (!ref) return null;
    return this.entitySlice.index.get(refKey(ref)) ?? null;
  }

  // --- Entity writes -------------------------------------------------------

  /**
   * Replaces every record of one kind. This is the feed-tick path: the incoming
   * set is the complete truth for that kind, including emptiness.
   */
  replaceKind<K extends EntityKind>(kind: K, records: readonly EntityByKind[K][]): void {
    const map = this.maps[kind];
    map.clear();
    for (const record of records) map.set(record.id, record);
    this.rebuildEntities([kind]);
  }

  /** Inserts or updates individual records without disturbing the rest. */
  upsert(records: readonly AnyEntity[]): void {
    if (records.length === 0) return;
    const dirty = new Set<EntityKind>();
    for (const record of records) {
      // TypeScript cannot correlate `record.kind` with the payload type of the
      // same union member, so the destination map is widened for the write. Sound
      // by construction: the key comes from the record itself, so a record can
      // only ever land in the map for its own kind.
      const map = this.maps[record.kind] as Map<string, AnyEntity>;
      map.set(record.id, record);
      dirty.add(record.kind);
    }
    this.rebuildEntities(dirty);
  }

  remove(refs: readonly EntityRef[]): void {
    const dirty = new Set<EntityKind>();
    for (const ref of refs) {
      if (this.maps[ref.kind].delete(ref.id)) dirty.add(ref.kind);
    }
    if (dirty.size > 0) this.rebuildEntities(dirty);
  }

  /**
   * Applies a transform to one record in place. Returns false when the record is
   * absent, so callers can distinguish "changed nothing" from "no such entity"
   * instead of failing silently.
   */
  patch<K extends EntityKind>(
    kind: K,
    id: string,
    transform: (current: EntityByKind[K]) => EntityByKind[K]
  ): boolean {
    const map = this.maps[kind];
    const current = map.get(id);
    if (!current) return false;
    map.set(id, transform(current));
    this.rebuildEntities([kind]);
    return true;
  }

  /**
   * Rebuilds the entities snapshot, reusing the arrays of kinds that did not
   * change.
   *
   * Preserving identity per kind is what stops a traffic tick from repainting the
   * camera grid: `useEntitiesOfKind('camera')` compares by reference, so if the
   * camera array is the same object React does no work. Rebuilding all ten arrays
   * on every tick would make every subscriber re-render on every feed.
   */
  private rebuildEntities(dirty: Iterable<EntityKind>): void {
    const changed = dirty instanceof Set ? dirty : new Set(dirty);
    const previous = this.entitySlice;
    const index = new Map<string, AnyEntity>();

    const bucket = <K extends EntityKind>(kind: K): readonly EntityByKind[K][] => {
      const list: readonly EntityByKind[K][] = changed.has(kind)
        ? Array.from(this.maps[kind].values())
        : bucketOf(previous, kind);

      // The index is always rebuilt in full — it is one insert per entity, and a
      // partially-updated index would resolve refs to records that no longer exist.
      for (const record of list) index.set(refKey(record), record);
      return list;
    };

    this.entitySlice = {
      incident: bucket('incident'),
      resource: bucket('resource'),
      drone: bucket('drone'),
      camera: bucket('camera'),
      sensor: bucket('sensor'),
      infrastructure: bucket('infrastructure'),
      intelligence: bucket('intelligence'),
      weather: bucket('weather'),
      utility: bucket('utility'),
      corridor: bucket('corridor'),
      index,
    };
    this.mark('entities');
  }

  // --- Event writes --------------------------------------------------------

  /**
   * Appends events to the stream, newest first, de-duplicated by id.
   *
   * De-duplication matters because polled feeds re-deliver the same advisories
   * on every tick. Without it the ticker would fill with repeats within a minute
   * and the analytics counts would inflate.
   */
  emit(inputs: readonly ArkaEventInput[]): void {
    if (inputs.length === 0) return;

    const seen = new Set(this.eventSlice.map((event) => event.id));
    const fresh: ArkaEvent[] = [];

    for (const input of inputs) {
      const id = input.id ?? `evt-${Date.now().toString(36)}-${(this.eventSeq += 1).toString(36)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      fresh.push({ ...input, id, reviewed: input.reviewed ?? false });
    }

    if (fresh.length === 0) return;

    this.eventSlice = [...fresh, ...this.eventSlice].sort(byNewest).slice(0, EVENT_CAPACITY);
    this.mark('events');
  }

  /** Convenience for the single-event case, which is most operator actions. */
  emitOne(input: ArkaEventInput): void {
    this.emit([input]);
  }

  setEventReviewed(id: string, reviewed: boolean): void {
    let changed = false;
    const next = this.eventSlice.map((event) => {
      if (event.id !== id || event.reviewed === reviewed) return event;
      changed = true;
      return { ...event, reviewed };
    });
    if (!changed) return;
    this.eventSlice = next;
    this.mark('events');
  }

  markAllReviewed(ids: readonly string[]): void {
    if (ids.length === 0) return;
    const target = new Set(ids);
    let changed = false;
    const next = this.eventSlice.map((event) => {
      if (!target.has(event.id) || event.reviewed) return event;
      changed = true;
      return { ...event, reviewed: true };
    });
    if (!changed) return;
    this.eventSlice = next;
    this.mark('events');
  }

  clearEvents(): void {
    if (this.eventSlice.length === 0) return;
    this.eventSlice = [];
    this.mark('events');
  }

  // --- Feed health ---------------------------------------------------------

  /**
   * Registers a feed before its first attempt.
   *
   * Registration deliberately starts at `UNAVAILABLE` rather than `LIVE`: a feed
   * that has not yet succeeded has not yet proven anything, and seeding a
   * confident-looking status is exactly the failure this codebase had before.
   */
  registerFeed(status: Omit<FeedStatus, 'lastAttemptAt' | 'lastSuccessAt' | 'latencyMs' | 'recordCount'>): void {
    if (this.feedSlice[status.id]) return;
    this.feedSlice = {
      ...this.feedSlice,
      [status.id]: {
        ...status,
        lastAttemptAt: null,
        lastSuccessAt: null,
        latencyMs: null,
        recordCount: null,
      },
    };
    this.mark('feeds');
  }

  updateFeed(id: string, patch: Partial<Omit<FeedStatus, 'id'>>): void {
    const current = this.feedSlice[id];
    if (!current) return;
    this.feedSlice = { ...this.feedSlice, [id]: { ...current, ...patch } };
    this.mark('feeds');
  }

  // --- Focus ---------------------------------------------------------------

  setFocus(request: FocusRequest): void {
    const next = applyFocus(this.focusSlice, request);
    if (focusEquivalent(this.focusSlice, next)) return;
    this.focusSlice = next;
    this.mark('focus');
  }

  setTab(tab: NavItem): void {
    this.setFocus({ tab });
  }

  /** Clears the pending map instruction once the map has acted on it. */
  consumeMapIntent(): void {
    if (this.focusSlice.mapIntent === 'none') return;
    this.focusSlice = { ...this.focusSlice, mapIntent: 'none' };
    this.mark('focus');
  }

  // --- Assignments ---------------------------------------------------------

  /**
   * Assigns a unit to an incident, replacing any prior assignment for that unit.
   *
   * A unit can only work one incident at a time, so this is a move rather than
   * an add — allowing two would let the tracker report a unit in two places.
   */
  assignUnit(assignment: Assignment): void {
    this.assignmentSlice = [
      assignment,
      ...this.assignmentSlice.filter((existing) => existing.unitId !== assignment.unitId),
    ];
    this.mark('assignments');
  }

  releaseUnit(unitId: string): Assignment | null {
    const existing = this.assignmentSlice.find((a) => a.unitId === unitId) ?? null;
    if (!existing) return null;
    this.assignmentSlice = this.assignmentSlice.filter((a) => a.unitId !== unitId);
    this.mark('assignments');
    return existing;
  }

  setAssignmentStatus(unitId: string, status: AssignmentStatus): void {
    let changed = false;
    const next = this.assignmentSlice.map((a) => {
      if (a.unitId !== unitId || a.status === status) return a;
      changed = true;
      return { ...a, status };
    });
    if (!changed) return;
    this.assignmentSlice = next;
    this.mark('assignments');
  }

  assignmentsForIncident(incidentId: string): Assignment[] {
    return this.assignmentSlice.filter((a) => a.incidentId === incidentId);
  }

  assignmentForUnit(unitId: string): Assignment | null {
    return this.assignmentSlice.find((a) => a.unitId === unitId) ?? null;
  }

  // --- Settings ------------------------------------------------------------

  /**
   * Applies a settings patch and writes it through to storage.
   *
   * Returns false when the write was rejected (private browsing, quota) so the
   * settings page can tell the operator their choice will not survive a reload
   * rather than showing a save confirmation that isn't true.
   */
  updateSettings(patch: SettingsPatch): boolean {
    const next = mergeSettings(this.settingsSlice, patch);
    this.settingsSlice = next;
    this.mark('settings');
    return persistSettings(next);
  }

  resetSettings(): void {
    clearStoredSettings();
    this.settingsSlice = DEFAULT_SETTINGS;
    this.mark('settings');
  }

  /** Test-only reset. Not used by the application. */
  resetForTests(): void {
    for (const kind of Object.keys(this.maps) as EntityKind[]) this.maps[kind].clear();
    this.entitySlice = EMPTY_ENTITY_SLICE;
    this.eventSlice = [];
    this.feedSlice = {};
    this.focusSlice = INITIAL_FOCUS;
    this.assignmentSlice = [];
    this.settingsSlice = DEFAULT_SETTINGS;
    this.flush(ALL_CHANNELS);
  }
}

export const arkaStore = ArkaStore.getInstance();
