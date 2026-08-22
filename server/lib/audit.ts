/**
 * Audit trail.
 *
 * Keeps provider events and operator actions in one ordered log but never
 * conflates them: `origin` says whether something happened upstream, was done
 * by a person in this application, or was produced by the server itself.
 *
 * In-memory and bounded. This is a session log, not a system of record — the
 * API says so explicitly so nobody mistakes it for a legal audit archive.
 */

export type AuditOrigin =
  /** Reported by an external data provider (fetch succeeded/failed). */
  | 'provider'
  /** An action a human took in this application. */
  | 'operator'
  /** Something this server did on its own (startup, cache eviction). */
  | 'system';

export interface AuditEntry {
  id: string;
  at: string;
  origin: AuditOrigin;
  /** Short machine-readable event name, e.g. `feed.failed`, `incident.transition`. */
  event: string;
  /** Who: a provider id, an operator label, or 'server'. */
  actor: string;
  message: string;
  /** Structured extras. Must never contain credentials. */
  detail?: Record<string, unknown>;
  /**
   * True when this entry records a change that was persisted somewhere durable.
   * Everything in this in-memory log is false, which keeps the UI honest about
   * what has actually been sent or stored.
   */
  persisted: boolean;
}

const MAX_ENTRIES = 500;
const entries: AuditEntry[] = [];
let counter = 0;

export function record(
  origin: AuditOrigin,
  event: string,
  actor: string,
  message: string,
  detail?: Record<string, unknown>
): AuditEntry {
  counter += 1;
  const entry: AuditEntry = {
    id: `a-${counter}`,
    at: new Date().toISOString(),
    origin,
    event,
    actor,
    message,
    detail,
    persisted: false,
  };
  entries.unshift(entry);
  if (entries.length > MAX_ENTRIES) entries.length = MAX_ENTRIES;
  return entry;
}

export function list(limit = 100, origin?: AuditOrigin): AuditEntry[] {
  const filtered = origin ? entries.filter((e) => e.origin === origin) : entries;
  return filtered.slice(0, Math.max(1, Math.min(limit, MAX_ENTRIES)));
}

export function counts(): Record<AuditOrigin, number> {
  return entries.reduce(
    (acc, e) => {
      acc[e.origin] += 1;
      return acc;
    },
    { provider: 0, operator: 0, system: 0 } as Record<AuditOrigin, number>
  );
}
