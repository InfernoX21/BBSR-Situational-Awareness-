/**
 * Per-feed cache with rate-limit protection.
 *
 * Each upstream provider gets one Feed. The Feed owns:
 *   - the TTL (how long a fetched value counts as current)
 *   - the freshness budget (when a value should be flagged stale on screen)
 *   - the minimum interval between upstream calls (provider quota protection)
 *   - the last successful payload, so an outage degrades to CACHED, not to a
 *     fabricated substitute
 *   - single-flight, so N concurrent browsers cause 1 upstream call
 *
 * A Feed never invents data. If it has never succeeded, it returns UNAVAILABLE
 * with the real error.
 */

import {
  cached,
  live,
  unavailable,
  type DataEnvelope,
  type DataError,
  type SourceMeta,
} from '../../src/shared/dataState';
import { ProviderError } from './http';

export interface FeedOptions<T> {
  /** Stable id used in the source registry and logs. */
  id: string;
  /** Human-facing description of what this feed supplies. */
  label: string;
  source: SourceMeta;
  /** Seconds a fetched payload is served without re-fetching. */
  ttlSeconds: number;
  /** Seconds after which the payload is flagged stale in the UI. */
  staleAfterSeconds: number;
  /**
   * Minimum seconds between upstream calls, to respect provider quotas.
   * Defaults to ttlSeconds when omitted.
   */
  minIntervalSeconds?: number;
  /** Performs the upstream call and returns a normalised payload. */
  fetch: () => Promise<T>;
}

export interface FeedStatus {
  id: string;
  label: string;
  source: SourceMeta;
  state: DataEnvelope<unknown>['state'];
  lastSuccessAt: string | null;
  lastAttemptAt: string | null;
  lastErrorAt: string | null;
  lastError: DataError | null;
  upstreamCalls: number;
  consecutiveFailures: number;
  ttlSeconds: number;
}

export class Feed<T> {
  private readonly options: FeedOptions<T>;
  private payload: T | null = null;
  private payloadAt: string | null = null;
  private lastAttemptAt: string | null = null;
  private lastErrorAt: string | null = null;
  private lastError: DataError | null = null;
  private inflight: Promise<void> | null = null;
  private upstreamCalls = 0;
  private consecutiveFailures = 0;

  constructor(options: FeedOptions<T>) {
    this.options = options;
  }

  get id(): string {
    return this.options.id;
  }

  /**
   * Current value as an envelope. Refreshes from upstream when the cached
   * payload has aged past the TTL and the provider's minimum interval allows.
   */
  async get(): Promise<DataEnvelope<T>> {
    const { source, staleAfterSeconds, ttlSeconds } = this.options;
    const minInterval = this.options.minIntervalSeconds ?? ttlSeconds;

    const payloadAge = secondsSince(this.payloadAt);
    const needsRefresh = payloadAge == null || payloadAge >= ttlSeconds;
    const attemptAge = secondsSince(this.lastAttemptAt);
    const quotaBlocked = attemptAge != null && attemptAge < minInterval;

    if (needsRefresh && !quotaBlocked) {
      await this.refresh();
    }

    if (this.payload != null && this.payloadAt) {
      const fresh = secondsSince(this.payloadAt);
      const withinTtl = fresh != null && fresh < ttlSeconds;
      // A payload still inside its TTL is current: report LIVE and show its age.
      // Past the TTL with a failing upstream, it is explicitly CACHED.
      if (withinTtl && !this.lastError) {
        return live(this.payload, source, this.payloadAt, staleAfterSeconds);
      }
      return cached(
        this.payload,
        source,
        this.payloadAt,
        this.lastError ?? {
          code: 'STALE',
          message: 'Waiting for the next successful refresh from the provider.',
        },
        staleAfterSeconds
      );
    }

    return unavailable<T>(
      source,
      this.lastError ?? {
        code: 'NOT_FETCHED',
        message: 'No value has been retrieved from this provider yet.',
      },
      null
    );
  }

  /** Force an upstream call on the next get(), ignoring the TTL. */
  invalidate(): void {
    this.payloadAt = null;
  }

  status(): FeedStatus {
    const age = secondsSince(this.payloadAt);
    const withinTtl = age != null && age < this.options.ttlSeconds;
    const state: DataEnvelope<unknown>['state'] =
      this.payload == null
        ? 'UNAVAILABLE'
        : withinTtl && !this.lastError
          ? 'LIVE'
          : 'CACHED';

    return {
      id: this.options.id,
      label: this.options.label,
      source: this.options.source,
      state,
      lastSuccessAt: this.payloadAt,
      lastAttemptAt: this.lastAttemptAt,
      lastErrorAt: this.lastErrorAt,
      lastError: this.lastError,
      upstreamCalls: this.upstreamCalls,
      consecutiveFailures: this.consecutiveFailures,
      ttlSeconds: this.options.ttlSeconds,
    };
  }

  /** Single-flight upstream refresh. Never throws. */
  private refresh(): Promise<void> {
    if (this.inflight) return this.inflight;

    this.inflight = (async () => {
      this.lastAttemptAt = new Date().toISOString();
      this.upstreamCalls += 1;
      try {
        const value = await this.options.fetch();
        this.payload = value;
        this.payloadAt = new Date().toISOString();
        this.lastError = null;
        this.consecutiveFailures = 0;
      } catch (err) {
        this.consecutiveFailures += 1;
        this.lastErrorAt = new Date().toISOString();
        this.lastError =
          err instanceof ProviderError
            ? err.detail
            : {
                code: 'PROVIDER_ERROR',
                message: err instanceof Error ? err.message : 'Unknown provider failure.',
              };
        // Log without the URL query string; provider keys never reach the log.
        console.warn(`[feed:${this.options.id}] ${this.lastError.code} — ${this.lastError.message}`);
      } finally {
        this.inflight = null;
      }
    })();

    return this.inflight;
  }
}

function secondsSince(iso: string | null): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, (Date.now() - t) / 1000);
}

/** Registry so /api/system/sources can report every feed's real state. */
export class FeedRegistry {
  private readonly feeds = new Map<string, Feed<any>>();

  register<T>(feed: Feed<T>): Feed<T> {
    this.feeds.set(feed.id, feed);
    return feed;
  }

  statuses(): FeedStatus[] {
    return [...this.feeds.values()].map((f) => f.status());
  }
}

export const feedRegistry = new FeedRegistry();
