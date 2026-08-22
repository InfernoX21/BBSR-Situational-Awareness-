/**
 * Outbound HTTP for provider calls.
 *
 * Every external request goes through here so that timeouts, response-size
 * caps, JSON-parse guards and credential redaction are applied uniformly.
 * Provider payloads are untrusted input: nothing here assumes a shape.
 */

import type { DataError } from '../../src/shared/dataState';

/** Hard ceiling on a provider response we are willing to buffer. */
const DEFAULT_MAX_BYTES = 4 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8000;

export interface FetchOptions {
  timeoutMs?: number;
  maxBytes?: number;
  headers?: Record<string, string>;
  method?: string;
  body?: string;
}

/**
 * Strip anything credential-shaped out of a URL before it reaches a log line
 * or an error message returned to the browser.
 */
export function redactUrl(url: string): string {
  try {
    const u = new URL(url);
    const secretish = /^(api[-_]?key|apikey|key|token|access_token|secret|password)$/i;
    for (const name of [...u.searchParams.keys()]) {
      if (secretish.test(name)) u.searchParams.set(name, 'REDACTED');
    }
    return u.toString();
  } catch {
    return 'invalid-url';
  }
}

export class ProviderError extends Error {
  readonly detail: DataError;
  constructor(detail: DataError) {
    super(detail.message);
    this.name = 'ProviderError';
    this.detail = detail;
  }
}

function timeoutError(url: string, ms: number): ProviderError {
  return new ProviderError({
    code: 'TIMEOUT',
    message: `No response from ${hostOf(url)} within ${ms} ms.`,
  });
}

export function hostOf(url: string): string {
  try {
    return new URL(url).host;
  } catch {
    return 'unknown host';
  }
}

/** Fetch text with a timeout and a size cap. Throws ProviderError. */
export async function fetchText(url: string, options: FetchOptions = {}): Promise<string> {
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let response: Response;
  try {
    response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: options.headers,
      body: options.body,
      signal: AbortSignal.timeout(timeoutMs),
      redirect: 'follow',
    });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      throw timeoutError(url, timeoutMs);
    }
    throw new ProviderError({
      code: `NETWORK_${err?.cause?.code || err?.code || 'ERROR'}`,
      message: `Could not reach ${hostOf(url)} (${err?.cause?.code || err?.message || 'network error'}).`,
    });
  }

  if (!response.ok) {
    const retryAfter = Number(response.headers.get('retry-after'));
    throw new ProviderError({
      code: `HTTP_${response.status}`,
      message: `${hostOf(url)} returned HTTP ${response.status} ${response.statusText || ''}`.trim(),
      retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined,
    });
  }

  const declared = Number(response.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new ProviderError({
      code: 'TOO_LARGE',
      message: `${hostOf(url)} response is ${declared} bytes, over the ${maxBytes}-byte cap.`,
    });
  }

  const text = await response.text();
  if (text.length > maxBytes) {
    throw new ProviderError({
      code: 'TOO_LARGE',
      message: `${hostOf(url)} response exceeded the ${maxBytes}-byte cap.`,
    });
  }
  return text;
}

/** Fetch and parse JSON. Malformed bodies raise MALFORMED, never leak the body. */
export async function fetchJson<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
  const text = await fetchText(url, {
    ...options,
    headers: { Accept: 'application/json', ...(options.headers || {}) },
  });
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new ProviderError({
      code: 'MALFORMED',
      message: `${hostOf(url)} did not return valid JSON.`,
    });
  }
}

/* ----------------------------------------------------------- validation --- */

/**
 * Provider payload accessors. Each returns null rather than a substitute
 * value, so a missing upstream field surfaces as "no data" instead of a
 * plausible-looking default.
 */

export function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

/** A finite number inside an inclusive range, else null. */
export function numInRange(value: unknown, min: number, max: number): number | null {
  const n = num(value);
  if (n == null) return null;
  return n >= min && n <= max ? n : null;
}

export function str(value: unknown, maxLength = 2000): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length > maxLength ? trimmed.slice(0, maxLength) : trimmed;
}

export function arr(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

export function obj(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}
