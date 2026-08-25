/**
 * Transport layer for live data.
 *
 * One place decides *how* data arrives, so no view contains a `setInterval` and
 * no view has to know whether its numbers came over a socket or a poll. Feeds
 * declare what they want; this decides what is achievable and reports the truth
 * back into the store's feed status.
 *
 * **Three transports, honestly labelled.** WebSocket, Server-Sent Events and
 * polling are all implemented. A feed lists the transports it will accept in
 * order of preference and the runner walks down the list until one opens. The
 * transport that actually carried the data is what lands in `FeedStatus.transport`
 * and what the operator sees — a feed that fell back to polling says `poll`, not
 * `websocket`.
 *
 * As of writing, `server.ts` exposes REST endpoints only: there is no `/ws` and
 * no `text/event-stream` route anywhere in it. So every feed ARKA ships today
 * declares `poll` and resolves to `poll`. The socket and SSE paths exist so that
 * adding a push endpoint is a one-line change to a feed definition rather than a
 * rewrite of the ingestion layer — not because a socket is secretly in use.
 *
 * **Failure is a state, not an exception.** A feed that cannot reach its source
 * moves to `UNAVAILABLE` carrying the reason, and backs off. It never retains the
 * last good payload and presents it as current, and it never substitutes a
 * plausible-looking default.
 */

import type { DataError, DataState, SourceMeta } from '../shared/dataState';
import { arkaStore, type TransportKind } from './ArkaStore';

/** A transport a feed is willing to use, with the endpoint it would use. */
export type TransportSpec =
  | { kind: 'websocket'; url: string }
  | { kind: 'sse'; url: string }
  | { kind: 'poll'; url: string; init?: RequestInit };

export interface FeedContext {
  /** ISO 8601 of when this payload arrived. */
  receivedAt: string;
  /** The transport that actually delivered it. */
  transport: TransportKind;
}

/**
 * What a handler made of a payload.
 *
 * Richer than a plain count because a successful HTTP round-trip does not mean
 * the source has data. Three cases have to be distinguishable in the feed strip:
 * the endpoint answered with records, the endpoint answered to say it has
 * nothing configured behind it, and the endpoint answered with fixtures. Reading
 * all three as LIVE is precisely the failure the data-state contract exists to
 * prevent.
 */
export interface FeedOutcome {
  /** Records handed to the store. Null when the handler did not say. */
  count: number | null;
  /**
   * Set when the transport worked but the source reported it has no data — an
   * unconfigured SCADA gateway, a rate-limited upstream, an empty result the
   * endpoint itself labels UNAVAILABLE. The feed is not LIVE in that case.
   */
  unavailable?: DataError;
  /**
   * State to record instead of LIVE, for a payload the source labels as
   * something else — most often `SIMULATED` from a demo-mode endpoint. The
   * transport is genuinely connected; what it carries is not an observation.
   */
  state?: DataState;
}

/**
 * Handles a decoded payload.
 *
 * Returning a bare number is shorthand for `{ count: n }`, which is the common
 * case. Return a `FeedOutcome` when the payload's own classification has to
 * reach the feed status — see `FeedOutcome`.
 */
export type FeedHandler = (payload: any, ctx: FeedContext) => number | void | FeedOutcome;

function normaliseOutcome(value: number | void | FeedOutcome): FeedOutcome {
  if (typeof value === 'number') return { count: value };
  if (value && typeof value === 'object') return value;
  return { count: null };
}

export interface FeedDefinition {
  id: string;
  /** Operator-facing name, e.g. 'IMD weather observations'. */
  label: string;
  source: SourceMeta;
  /** Preferred transports, most preferred first. */
  transports: TransportSpec[];
  /** Seconds between polls. Ignored by push transports. */
  cadenceSeconds: number;
  handler: FeedHandler;
  /**
   * Called when the feed cannot deliver, so the owning module can clear whatever
   * it was showing rather than leave stale records on screen.
   */
  onUnavailable?: (error: DataError) => void;
  /** Skip the first immediate attempt and wait one full cadence. Rarely wanted. */
  deferFirstAttempt?: boolean;
}

/** How long a socket or SSE stream gets to open before we move down the ladder. */
const HANDSHAKE_TIMEOUT_MS = 6_000;

/** Ceiling on a single HTTP attempt. Past this the endpoint is treated as down. */
const REQUEST_TIMEOUT_MS = 12_000;

/** Backoff ladder, in multiples of the feed's cadence. */
const BACKOFF_STEPS = [1, 2, 4, 8, 12];

function errorFrom(cause: unknown): DataError {
  if (cause instanceof DOMException && cause.name === 'AbortError') {
    return { code: 'TIMEOUT', message: `No response within ${REQUEST_TIMEOUT_MS / 1000}s.` };
  }
  if (cause instanceof Error) return { code: 'FETCH_FAILED', message: cause.message };
  return { code: 'FETCH_FAILED', message: 'Request failed for an unknown reason.' };
}

/**
 * Runs one feed: resolves a transport, delivers payloads, keeps the store's feed
 * status accurate, and backs off when the source is down.
 */
class FeedRunner {
  private readonly definition: FeedDefinition;

  private timer: ReturnType<typeof setTimeout> | null = null;
  private socket: WebSocket | null = null;
  private eventSource: EventSource | null = null;
  private inFlight: AbortController | null = null;

  /** Index into `definition.transports` currently being used or attempted. */
  private specIndex = 0;
  private consecutiveFailures = 0;
  private running = false;
  /** Cadence override from operator settings; falls back to the definition. */
  private cadenceOverride: number | null = null;

  constructor(definition: FeedDefinition) {
    this.definition = definition;
    const first = definition.transports[0];
    arkaStore.registerFeed({
      id: definition.id,
      label: definition.label,
      // Registered as UNAVAILABLE: nothing has succeeded yet, so claiming any
      // other state here would be an assertion the code cannot back up.
      state: 'UNAVAILABLE',
      transport: first?.kind ?? 'local',
      source: definition.source,
      error: first
        ? { code: 'NOT_STARTED', message: 'Feed registered; no attempt made yet.' }
        : { code: 'NO_TRANSPORT', message: 'No transport configured for this feed.' },
      cadenceSeconds: definition.cadenceSeconds,
    });
  }

  get id(): string {
    return this.definition.id;
  }

  private get cadenceSeconds(): number {
    return this.cadenceOverride ?? this.definition.cadenceSeconds;
  }

  setCadence(seconds: number | null): void {
    this.cadenceOverride = seconds && seconds > 0 ? seconds : null;
    arkaStore.updateFeed(this.id, { cadenceSeconds: this.cadenceSeconds });
    if (this.running && this.currentSpec()?.kind === 'poll') {
      this.schedule(0);
    }
  }

  private currentSpec(): TransportSpec | undefined {
    return this.definition.transports[this.specIndex];
  }

  start(): void {
    if (this.running) return;
    this.running = true;
    this.specIndex = 0;
    this.consecutiveFailures = 0;
    this.connect(this.definition.deferFirstAttempt === true);
  }

  stop(): void {
    this.running = false;
    this.teardown();
  }

  /** Immediate re-attempt, for a manual refresh control. */
  refresh(): void {
    if (!this.running) {
      this.start();
      return;
    }
    const spec = this.currentSpec();
    if (spec?.kind === 'poll') {
      this.schedule(0);
      return;
    }
    // Push transports have nothing to poll; a refresh means reconnect.
    this.teardown();
    this.connect(false);
  }

  private teardown(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    if (this.inFlight) {
      this.inFlight.abort();
      this.inFlight = null;
    }
    if (this.socket) {
      // Handlers detached first so the close does not look like a drop and start
      // a reconnect for a feed we are deliberately shutting down.
      this.socket.onopen = null;
      this.socket.onmessage = null;
      this.socket.onerror = null;
      this.socket.onclose = null;
      try {
        this.socket.close();
      } catch {
        /* already closing */
      }
      this.socket = null;
    }
    if (this.eventSource) {
      this.eventSource.onopen = null;
      this.eventSource.onmessage = null;
      this.eventSource.onerror = null;
      this.eventSource.close();
      this.eventSource = null;
    }
  }

  private connect(defer: boolean): void {
    const spec = this.currentSpec();
    if (!spec) {
      this.reportUnavailable({
        code: 'NO_TRANSPORT',
        message: 'Every configured transport for this feed failed to connect.',
      });
      return;
    }

    arkaStore.updateFeed(this.id, { transport: spec.kind });

    switch (spec.kind) {
      case 'websocket':
        this.openSocket(spec.url);
        return;
      case 'sse':
        this.openEventSource(spec.url);
        return;
      case 'poll':
        this.schedule(defer ? this.cadenceSeconds * 1000 : 0);
        return;
    }
  }

  /** Moves to the next transport in the ladder, or gives up if exhausted. */
  private fallBack(reason: DataError): void {
    this.teardown();
    if (!this.running) return;

    if (this.specIndex + 1 < this.definition.transports.length) {
      this.specIndex += 1;
      this.connect(false);
      return;
    }
    this.reportUnavailable(reason);
    this.schedule(this.backoffMs());
  }

  // --- WebSocket ------------------------------------------------------------

  private openSocket(url: string): void {
    let opened = false;
    let socket: WebSocket;
    try {
      socket = new WebSocket(url);
    } catch (cause) {
      this.fallBack(errorFrom(cause));
      return;
    }
    this.socket = socket;
    arkaStore.updateFeed(this.id, { lastAttemptAt: new Date().toISOString() });

    const handshake = setTimeout(() => {
      if (!opened) {
        this.fallBack({
          code: 'HANDSHAKE_TIMEOUT',
          message: `WebSocket did not open within ${HANDSHAKE_TIMEOUT_MS / 1000}s.`,
        });
      }
    }, HANDSHAKE_TIMEOUT_MS);

    socket.onopen = () => {
      opened = true;
      clearTimeout(handshake);
      this.consecutiveFailures = 0;
    };

    socket.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(typeof event.data === 'string' ? event.data : '');
      } catch {
        // A malformed frame is not a reason to drop a working socket, but it is
        // a reason not to pretend the feed is healthy.
        this.reportUnavailable({ code: 'BAD_PAYLOAD', message: 'Received a frame that was not valid JSON.' });
        return;
      }
      this.deliver(payload, 'websocket', null);
    };

    socket.onerror = () => {
      if (!opened) return; // onclose will follow and drive the fallback.
      this.reportUnavailable({ code: 'SOCKET_ERROR', message: 'WebSocket reported an error.' });
    };

    socket.onclose = () => {
      clearTimeout(handshake);
      if (!this.running) return;
      this.consecutiveFailures += 1;
      if (!opened) {
        this.fallBack({ code: 'SOCKET_REFUSED', message: 'WebSocket closed before opening.' });
        return;
      }
      // It worked once, so retry the same transport rather than falling back.
      this.reportUnavailable({ code: 'SOCKET_CLOSED', message: 'WebSocket connection dropped.' });
      this.socket = null;
      this.timer = setTimeout(() => this.connect(false), this.backoffMs());
    };
  }

  // --- Server-Sent Events ---------------------------------------------------

  private openEventSource(url: string): void {
    let opened = false;
    let source: EventSource;
    try {
      source = new EventSource(url);
    } catch (cause) {
      this.fallBack(errorFrom(cause));
      return;
    }
    this.eventSource = source;
    arkaStore.updateFeed(this.id, { lastAttemptAt: new Date().toISOString() });

    const handshake = setTimeout(() => {
      if (!opened) {
        this.fallBack({
          code: 'HANDSHAKE_TIMEOUT',
          message: `Event stream did not open within ${HANDSHAKE_TIMEOUT_MS / 1000}s.`,
        });
      }
    }, HANDSHAKE_TIMEOUT_MS);

    source.onopen = () => {
      opened = true;
      clearTimeout(handshake);
      this.consecutiveFailures = 0;
    };

    source.onmessage = (event) => {
      let payload: unknown;
      try {
        payload = JSON.parse(event.data);
      } catch {
        this.reportUnavailable({ code: 'BAD_PAYLOAD', message: 'Received an event that was not valid JSON.' });
        return;
      }
      this.deliver(payload, 'sse', null);
    };

    source.onerror = () => {
      clearTimeout(handshake);
      if (!this.running) return;
      this.consecutiveFailures += 1;
      if (!opened) {
        this.fallBack({ code: 'STREAM_REFUSED', message: 'Event stream could not be established.' });
        return;
      }
      // EventSource reconnects on its own, so report the gap and let it work.
      this.reportUnavailable({ code: 'STREAM_INTERRUPTED', message: 'Event stream interrupted; reconnecting.' });
    };
  }

  // --- Polling --------------------------------------------------------------

  private schedule(delayMs: number): void {
    if (!this.running) return;
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.poll();
    }, delayMs);
  }

  private async poll(): Promise<void> {
    const spec = this.currentSpec();
    if (!this.running || !spec || spec.kind !== 'poll') return;

    const controller = new AbortController();
    this.inFlight = controller;
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    const startedAt = performance.now();
    arkaStore.updateFeed(this.id, { lastAttemptAt: new Date().toISOString() });

    try {
      const response = await fetch(spec.url, { ...spec.init, signal: controller.signal });
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText || 'request rejected'}`);
      }
      const payload = await response.json();
      if (!this.running) return;
      this.consecutiveFailures = 0;
      this.deliver(payload, 'poll', Math.round(performance.now() - startedAt));
    } catch (cause) {
      if (!this.running) return;
      this.consecutiveFailures += 1;
      const error = errorFrom(cause);
      // A working transport that starts failing stays selected — falling back to
      // a lower-preference transport for a transient 502 would be worse.
      this.reportUnavailable(error);
    } finally {
      clearTimeout(timeout);
      if (this.inFlight === controller) this.inFlight = null;
      this.schedule(this.backoffMs());
    }
  }

  private backoffMs(): number {
    const step = BACKOFF_STEPS[Math.min(this.consecutiveFailures, BACKOFF_STEPS.length - 1)];
    return this.cadenceSeconds * 1000 * step;
  }

  // --- Delivery -------------------------------------------------------------

  private deliver(payload: unknown, transport: TransportKind, latencyMs: number | null): void {
    const receivedAt = new Date().toISOString();
    let outcome: FeedOutcome;
    try {
      outcome = normaliseOutcome(this.definition.handler(payload, { receivedAt, transport }));
    } catch (cause) {
      // A handler that throws is a bug in the mapping, not a source failure —
      // but the operator still must not be shown a healthy-looking feed.
      this.reportUnavailable({
        code: 'MAPPING_FAILED',
        message: cause instanceof Error ? cause.message : 'Failed to interpret the payload.',
      });
      return;
    }

    if (outcome.unavailable) {
      // The transport worked and the source answered — to say it has nothing.
      // `lastSuccessAt` and `latencyMs` are left alone on purpose: they document
      // the last time this feed actually delivered data, and a reply of "no data"
      // is not that.
      arkaStore.updateFeed(this.id, {
        state: 'UNAVAILABLE',
        transport,
        error: outcome.unavailable,
        recordCount: outcome.count,
      });
      this.definition.onUnavailable?.(outcome.unavailable);
      return;
    }

    arkaStore.updateFeed(this.id, {
      state: outcome.state ?? 'LIVE',
      transport,
      lastSuccessAt: receivedAt,
      latencyMs,
      error: null,
      recordCount: outcome.count,
    });
  }

  private reportUnavailable(error: DataError): void {
    arkaStore.updateFeed(this.id, { state: 'UNAVAILABLE', error, recordCount: null });
    this.definition.onUnavailable?.(error);
  }
}

/**
 * Owns every feed runner.
 *
 * A single manager rather than per-module intervals means the operator can see
 * every source in one place, the settings page can retune cadence globally, and
 * demo mode can stop the live feeds outright instead of racing them.
 */
class TransportManager {
  private readonly runners = new Map<string, FeedRunner>();
  private started = false;

  /** Registers a feed. Starts it immediately if the manager is already running. */
  register(definition: FeedDefinition): void {
    if (this.runners.has(definition.id)) return;
    const runner = new FeedRunner(definition);
    this.runners.set(definition.id, runner);
    if (this.started) runner.start();
  }

  startAll(): void {
    this.started = true;
    for (const runner of this.runners.values()) runner.start();
  }

  stopAll(): void {
    this.started = false;
    for (const runner of this.runners.values()) runner.stop();
  }

  refresh(id?: string): void {
    if (id) {
      this.runners.get(id)?.refresh();
      return;
    }
    for (const runner of this.runners.values()) runner.refresh();
  }

  /** Applies an operator cadence preference. Null restores each feed's default. */
  setCadence(seconds: number | null, id?: string): void {
    if (id) {
      this.runners.get(id)?.setCadence(seconds);
      return;
    }
    for (const runner of this.runners.values()) runner.setCadence(seconds);
  }

  has(id: string): boolean {
    return this.runners.has(id);
  }

  get isRunning(): boolean {
    return this.started;
  }
}

export const transportManager = new TransportManager();
