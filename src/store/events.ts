/**
 * The single event stream.
 *
 * ARKA used to maintain three parallel notions of "something happened": a
 * `LiveLog` array for the bottom ticker, an `IntelligenceItem` array for the
 * right-hand feed, and per-view ad-hoc lists. They never agreed, and the ticker
 * had its own fabricated dataset because nothing real was reaching it.
 *
 * There is now one `ArkaEvent`. The ticker, the intelligence feed, the incident
 * timeline and the analytics trend charts are four presentations of the same
 * log. An event that is not in this stream did not happen.
 *
 * An event is an immutable statement about a moment. Entities mutate; events do
 * not. That is what makes the stream usable as an audit trail and as the input
 * to trend analysis — you can recount history without replaying mutations.
 */

import type { DataState } from '../shared/dataState';
import type { Severity } from '../types';
import { EVENT_TONE_HEX } from '../ui/tokens';
import type { EntityRef } from './entities';

/**
 * What sort of occurrence this is.
 *
 * Kept coarse on purpose. These are the categories an operator filters by, not
 * a taxonomy of every message the system can emit — detail belongs in `title`
 * and `detail`.
 */
export type EventKind =
  | 'INCIDENT_DETECTED'
  | 'INCIDENT_STATUS'
  | 'AI_ANOMALY'
  | 'CAMERA_DETECTION'
  | 'SENSOR_EVENT'
  | 'TRAFFIC_ANOMALY'
  | 'WEATHER_ALERT'
  | 'INFRASTRUCTURE_EVENT'
  | 'UTILITY_EVENT'
  | 'DRONE_OBSERVATION'
  | 'RESOURCE_DISPATCH'
  | 'ADVISORY'
  /** A feed connected, dropped, or changed data state. */
  | 'FEED_STATUS'
  /** Something an operator did in this application. */
  | 'OPERATOR_ACTION';

export const EVENT_KIND_LABEL: Record<EventKind, string> = {
  INCIDENT_DETECTED: 'Incident detected',
  INCIDENT_STATUS: 'Incident status',
  AI_ANOMALY: 'AI anomaly',
  CAMERA_DETECTION: 'Camera detection',
  SENSOR_EVENT: 'Sensor event',
  TRAFFIC_ANOMALY: 'Traffic anomaly',
  WEATHER_ALERT: 'Weather alert',
  INFRASTRUCTURE_EVENT: 'Infrastructure event',
  UTILITY_EVENT: 'Utility event',
  DRONE_OBSERVATION: 'Drone observation',
  RESOURCE_DISPATCH: 'Resource dispatch',
  ADVISORY: 'Advisory',
  FEED_STATUS: 'Feed status',
  OPERATOR_ACTION: 'Operator action',
};

/**
 * Presentation grade, which is *not* the same as severity.
 *
 * A resolved CRITICAL incident is green, not red — the event reports good news
 * about a serious thing. Keeping tone separate from severity is what lets the
 * ticker colour correctly without re-deriving intent at every call site.
 *
 * Maps onto the v2 status ramp:
 *   critical → red · high → amber · medium → yellow · low → steel · resolved → green
 *
 * Note what is absent: the interaction accent. Burnt orange means "this is where
 * you are" or "this is the action", never "this is how bad it is".
 */
export type EventTone = 'critical' | 'high' | 'medium' | 'low' | 'resolved';

export const EVENT_TONE_RANK: Record<EventTone, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
  resolved: 4,
};

/**
 * Colour per tone, taken from the one token mirror in `src/ui/tokens.ts`.
 *
 * The ticker, the feed, the timeline and the chart series all read this, so a
 * critical event cannot be one red here and a different red two panels over.
 */
export const EVENT_TONE_COLOR: Record<EventTone, string> = EVENT_TONE_HEX;

export const EVENT_TONE_LABEL: Record<EventTone, string> = {
  critical: 'CRITICAL',
  high: 'HIGH',
  medium: 'MEDIUM',
  low: 'INFO',
  resolved: 'RESOLVED',
};

export interface ArkaEvent {
  id: string;
  /** ISO 8601. The moment being reported, not the moment of ingestion. */
  at: string;
  kind: EventKind;
  tone: EventTone;
  /**
   * Grade of the underlying condition, where the domain grades one. A resolved
   * critical incident keeps `severity: 'CRITICAL'` and takes `tone: 'resolved'`.
   */
  severity: Severity | null;
  /** One line, ticker-ready. No trailing punctuation. */
  title: string;
  /** Optional expansion shown when the operator opens the event. */
  detail: string | null;
  /** Who reported it, operator-facing. */
  provider: string;
  /** Honesty state of the event itself, from the shared contract. */
  state: DataState;
  /** Entities this event is about. Drives every "jump to…" affordance. */
  subjects: EntityRef[];
  /** Where it happened, when that is known and meaningful. */
  position: { lat: number; lng: number } | null;
  /**
   * Model confidence, 0–1, present *only* when a model actually reported one.
   * Never synthesised: an event with no model behind it leaves this null rather
   * than carrying a comfortable-looking number.
   */
  confidence: number | null;
  /** Signals a model consumed to reach its conclusion. Empty for non-AI events. */
  sourceSignals: string[];
  /** Operator acknowledgement. Local to this session unless persisted upstream. */
  reviewed: boolean;
}

/** Everything needed to create an event; the store fills in id and reviewed. */
export type ArkaEventInput = Omit<ArkaEvent, 'id' | 'reviewed'> & {
  id?: string;
  reviewed?: boolean;
};

/** Severity → tone, for the common case where the event reports a live problem. */
export function toneForSeverity(severity: Severity | null): EventTone {
  switch (severity) {
    case 'CRITICAL':
      return 'critical';
    case 'HIGH':
      return 'high';
    case 'MEDIUM':
      return 'medium';
    case 'LOW':
      return 'low';
    default:
      return 'low';
  }
}

/**
 * Clock time for the ticker, in the 24-hour form the command centre uses.
 * Returns '--:--:--' for an unparseable stamp rather than throwing inside render.
 */
export function eventClock(at: string): string {
  const t = new Date(at);
  if (Number.isNaN(t.getTime())) return '--:--:--';
  return t.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

/** Newest first. Ties broken by id so the order is stable across renders. */
export function byNewest(a: ArkaEvent, b: ArkaEvent): number {
  const delta = Date.parse(b.at) - Date.parse(a.at);
  if (delta !== 0 && !Number.isNaN(delta)) return delta;
  return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
}

// --- Filtering ---------------------------------------------------------------

export interface EventFilter {
  /** Empty means "all". */
  kinds: EventKind[];
  tones: EventTone[];
  states: DataState[];
  /** Free text over title, detail and provider. Case-insensitive. */
  search: string;
  /** Only events at or newer than this many minutes ago. Null means no limit. */
  withinMinutes: number | null;
  /** When true, hide events the operator has marked reviewed. */
  hideReviewed: boolean;
}

export const EMPTY_EVENT_FILTER: EventFilter = {
  kinds: [],
  tones: [],
  states: [],
  search: '',
  withinMinutes: null,
  hideReviewed: false,
};

export function filterEvents(events: readonly ArkaEvent[], filter: EventFilter): ArkaEvent[] {
  const needle = filter.search.trim().toLowerCase();
  // Computed once rather than per-event: `Date.now()` inside the predicate would
  // let the cutoff drift across a long list.
  const cutoff = filter.withinMinutes == null ? null : Date.now() - filter.withinMinutes * 60_000;

  return events.filter((event) => {
    if (filter.kinds.length > 0 && !filter.kinds.includes(event.kind)) return false;
    if (filter.tones.length > 0 && !filter.tones.includes(event.tone)) return false;
    if (filter.states.length > 0 && !filter.states.includes(event.state)) return false;
    if (filter.hideReviewed && event.reviewed) return false;
    if (cutoff != null) {
      const t = Date.parse(event.at);
      // An unparseable timestamp is kept: dropping it would silently hide an
      // event, which is worse than showing one whose age we cannot judge.
      if (!Number.isNaN(t) && t < cutoff) return false;
    }
    if (needle) {
      const haystack = `${event.title} ${event.detail ?? ''} ${event.provider}`.toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

/** True when any filter would actually exclude something. */
export function isFilterActive(filter: EventFilter): boolean {
  return (
    filter.kinds.length > 0 ||
    filter.tones.length > 0 ||
    filter.states.length > 0 ||
    filter.search.trim() !== '' ||
    filter.withinMinutes != null ||
    filter.hideReviewed
  );
}
