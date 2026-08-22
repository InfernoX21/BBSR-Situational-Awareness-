/**
 * Shared data-state contract.
 *
 * Imported by BOTH the Express server and the React client so a field's
 * provenance travels with its value and cannot drift between the two.
 *
 * The rule this file exists to enforce: no operational value is rendered
 * without a state, a named source and a timestamp. A field with no approved
 * upstream source is UNAVAILABLE — never a plausible-looking placeholder.
 */

/** How a value came to be on screen. */
export type DataState =
  /** Fetched from a real current source. */
  | 'LIVE'
  /** Previously live, replayed from cache because the source is unreachable. */
  | 'CACHED'
  /** Development/demo fixture, only shown when demo mode is explicitly on. */
  | 'SEED'
  /** Generated telemetry or animation, only shown when demo mode is on. */
  | 'SIMULATED'
  /** A substitute served when the live source failed. */
  | 'FALLBACK'
  /** No approved source is configured; nothing is shown. */
  | 'UNAVAILABLE';

/** Short labels for badges. Keep these terse — they sit inside chips. */
export const DATA_STATE_LABEL: Record<DataState, string> = {
  LIVE: 'Live',
  CACHED: 'Cached',
  SEED: 'Seed data',
  SIMULATED: 'Simulated',
  FALLBACK: 'Fallback',
  UNAVAILABLE: 'No data source',
};

/** Longer explanation used in tooltips and empty states. */
export const DATA_STATE_HELP: Record<DataState, string> = {
  LIVE: 'Fetched from the named source; the timestamp shows when.',
  CACHED: 'The source is currently unreachable. This is the last value received.',
  SEED: 'Committed demo fixture. Not operational data.',
  SIMULATED: 'Generated for demonstration. Not measured.',
  FALLBACK: 'Substitute value served because the live source failed.',
  UNAVAILABLE: 'No approved data source is connected for this field.',
};

/**
 * What sort of value this is. Operators need to tell a measurement from a
 * model output, and both from something a colleague typed in.
 */
export type SourceKind =
  /** Measured by an instrument or reported by the operating authority. */
  | 'observation'
  /** Numerical model output (forecast, reanalysis, gridded estimate). */
  | 'model'
  /** Third-party aggregation of other publishers (e.g. a news feed). */
  | 'aggregator'
  /** Entered by an operator in this application. */
  | 'operator'
  /** Static geographic or reference configuration, not a reading. */
  | 'reference'
  /** Nothing is connected. */
  | 'none';

export interface SourceMeta {
  /** Provider shown to the operator. */
  provider: string;
  kind: SourceKind;
  /** Attribution text the provider's licence requires us to display. */
  attribution?: string;
  /** Provider documentation or homepage. */
  url?: string;
  /**
   * Caveat that changes how the number should be read — model resolution,
   * spatial mismatch, update cadence. Shown next to the value.
   */
  note?: string;
  /** Update cadence in seconds, where the provider documents one. */
  cadenceSeconds?: number;
}

export interface DataError {
  /** Stable code for logs and tests: TIMEOUT, HTTP_503, MALFORMED, NOT_CONFIGURED… */
  code: string;
  /** Operator-readable sentence. Never contains credentials. */
  message: string;
  /** What would have to be integrated for this field to work. */
  requiredIntegration?: string;
  retryAfterSeconds?: number;
}

export interface DataEnvelope<T> {
  state: DataState;
  /** Null whenever state is UNAVAILABLE. */
  data: T | null;
  source: SourceMeta;
  /** When the payload now being shown was produced upstream. */
  fetchedAt: string | null;
  /** Last time a live fetch of this feed succeeded, if ever. */
  lastSuccessAt: string | null;
  /** Age of `fetchedAt` in seconds at the time the envelope was built. */
  ageSeconds: number | null;
  /** True when the data is older than the feed's freshness budget. */
  stale: boolean;
  error: DataError | null;
}

/** A source with nothing behind it, used for UNAVAILABLE envelopes. */
export const NO_SOURCE: SourceMeta = { provider: 'Not connected', kind: 'none' };

export function unavailable<T>(
  source: SourceMeta,
  error: DataError,
  lastSuccessAt: string | null = null
): DataEnvelope<T> {
  return {
    state: 'UNAVAILABLE',
    data: null,
    source,
    fetchedAt: null,
    lastSuccessAt,
    ageSeconds: null,
    stale: false,
    error,
  };
}

export function live<T>(
  data: T,
  source: SourceMeta,
  fetchedAt: string,
  staleAfterSeconds?: number
): DataEnvelope<T> {
  return {
    state: 'LIVE',
    data,
    source,
    fetchedAt,
    lastSuccessAt: fetchedAt,
    ageSeconds: ageOf(fetchedAt),
    stale: isPastBudget(fetchedAt, staleAfterSeconds),
    error: null,
  };
}

export function cached<T>(
  data: T,
  source: SourceMeta,
  fetchedAt: string,
  error: DataError,
  staleAfterSeconds?: number
): DataEnvelope<T> {
  return {
    state: 'CACHED',
    data,
    source,
    fetchedAt,
    lastSuccessAt: fetchedAt,
    ageSeconds: ageOf(fetchedAt),
    // No freshness budget given: a cached value is stale by definition.
    stale: staleAfterSeconds == null ? true : isPastBudget(fetchedAt, staleAfterSeconds),
    error,
  };
}

/** Demo fixtures. Only ever produced when demo mode is explicitly enabled. */
export function fixture<T>(
  data: T,
  state: 'SEED' | 'SIMULATED',
  provider = 'Committed demo fixture'
): DataEnvelope<T> {
  const now = new Date().toISOString();
  return {
    state,
    data,
    source: { provider, kind: 'reference', note: 'Demo mode is on. This is not operational data.' },
    fetchedAt: now,
    lastSuccessAt: null,
    ageSeconds: 0,
    stale: false,
    error: null,
  };
}

export function ageOf(iso: string | null): number | null {
  const exact = exactAge(iso);
  return exact == null ? null : Math.round(exact);
}

/** Unrounded age in seconds. Used for freshness decisions, not for display. */
function exactAge(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 1000);
}

/**
 * Staleness is decided on the unrounded age with `>=`, so a value that has
 * reached its freshness budget is always flagged. Rounding is display-only —
 * it must never be able to make old data look current.
 */
function isPastBudget(iso: string | null, staleAfterSeconds?: number): boolean {
  if (staleAfterSeconds == null) return false;
  const exact = exactAge(iso);
  return exact != null && exact >= staleAfterSeconds;
}

/** True when the envelope carries something renderable. */
export function hasData<T>(env: DataEnvelope<T> | null | undefined): env is DataEnvelope<T> {
  return !!env && env.data != null && env.state !== 'UNAVAILABLE';
}

/** True when the value must not be treated as current operational truth. */
export function isTrustworthy<T>(env: DataEnvelope<T> | null | undefined): boolean {
  return !!env && env.state === 'LIVE' && !env.stale;
}

/** "12 s ago" / "4 min ago" / "2 h ago" — compact age for badges. */
export function formatAge(ageSeconds: number | null): string {
  if (ageSeconds == null) return '—';
  if (ageSeconds < 60) return `${ageSeconds} s ago`;
  if (ageSeconds < 3600) return `${Math.floor(ageSeconds / 60)} min ago`;
  if (ageSeconds < 86400) return `${Math.floor(ageSeconds / 3600)} h ago`;
  return `${Math.floor(ageSeconds / 86400)} d ago`;
}

/** Local clock time of an ISO timestamp, for "last updated" lines. */
export function formatClock(iso: string | null): string {
  if (!iso) return '—';
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return '—';
  return t.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}
