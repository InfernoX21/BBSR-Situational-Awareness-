/**
 * Coercion helpers for payloads arriving over the network.
 *
 * Every value that reaches the ingestion layer is untrusted input. Not because
 * the endpoints are hostile, but because a schema change upstream, a partial
 * response or a null field must degrade to "not known" rather than put `NaN`,
 * `undefined` or a plausible-looking default into a store that the whole
 * platform reads.
 *
 * Two habits these helpers enforce:
 *
 * **A missing value becomes null, not zero.** `optNum` exists so that an absent
 * reading renders as an em dash rather than as a confident `0` — which on a
 * speed gauge or a load percentage is a statement, not an absence.
 *
 * **A string outside its union is rejected.** `oneOf` narrows to the declared
 * literal set, so a new status word upstream cannot slip through into a switch
 * that has no case for it.
 */

import type { DataState } from '../../shared/dataState';
import type { EntityPosition } from '../entities';

export function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

export function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' && value.trim() !== '' ? value : fallback;
}

export function optStr(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value : null;
}

export function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

/** Null when absent or unusable. Use wherever zero would be a claim. */
export function optNum(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export function bool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

export function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

export function optOneOf<T extends string>(value: unknown, allowed: readonly T[]): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

const DATA_STATES: readonly DataState[] = [
  'LIVE',
  'CACHED',
  'SEED',
  'SIMULATED',
  'FALLBACK',
  'UNAVAILABLE',
];

/**
 * Reads a server-declared classification.
 *
 * The fallback is deliberately the caller's most pessimistic reading: an
 * unrecognised classification must never be promoted to LIVE.
 */
export function dataStateOf(value: unknown, fallback: DataState): DataState {
  return oneOf(value, DATA_STATES, fallback);
}

/**
 * A position, or null.
 *
 * `0, 0` is rejected: it is in the Gulf of Guinea, roughly 8,000 km from
 * Bhubaneswar, and in practice always means the upstream field was missing and
 * something defaulted it.
 */
export function coords(source: Record<string, unknown>, latKey = 'lat', lngKey = 'lng'): EntityPosition | null {
  const lat = optNum(source[latKey]);
  const lng = optNum(source[lngKey]);
  if (lat == null || lng == null) return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat, lng };
}

/** Coordinate pairs for corridor anchors. Malformed entries are dropped, not repaired. */
export function latLngPairs(value: unknown): [number, number][] {
  const out: [number, number][] = [];
  for (const entry of asArray(value)) {
    if (!Array.isArray(entry) || entry.length < 2) continue;
    const lat = optNum(entry[0]);
    const lng = optNum(entry[1]);
    if (lat == null || lng == null) continue;
    if (Math.abs(lat) > 90 || Math.abs(lng) > 180) continue;
    out.push([lat, lng]);
  }
  return out;
}

/** An ISO 8601 timestamp, or the fallback when the value is absent or unparseable. */
export function isoOr(value: unknown, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? fallback : new Date(parsed).toISOString();
}

/**
 * djb2 over a seed string, base-36.
 *
 * Used where an upstream id is unstable across polls — the news endpoint stamps
 * `Date.now()` into every id, so the same article arrives with a new id every
 * five minutes. Hashing something genuinely stable about the record (its URL)
 * gives an identity that survives the tick, which is what makes de-duplication
 * and cross-module linking work at all.
 */
export function stableId(prefix: string, seed: string): string {
  let hash = 5381;
  for (let i = 0; i < seed.length; i += 1) {
    hash = ((hash << 5) + hash + seed.charCodeAt(i)) | 0;
  }
  return `${prefix}-${(hash >>> 0).toString(36)}`;
}
