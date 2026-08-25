/**
 * Resolves whether demo data may be shown, and whether it currently is.
 *
 * Three separate questions, deliberately kept apart:
 *
 * 1. **Is demo data permitted?** Decided by the environment, never by the UI.
 *    `VITE_USE_DEMO_DATA` governs fixtures the client generates;
 *    `USE_DEMO_DATA` governs fixtures the server returns, reported by
 *    `/api/health`. Neither defaults to true.
 * 2. **Does the operator prefer it?** `settings.dataMode`, which is only a
 *    preference among what the environment already allows.
 * 3. **Is it in effect?** Both of the above. A settings toggle can never conjure
 *    demo data in a build that forbids it — that is the whole point of splitting
 *    the question in three.
 *
 * Anything admitted through this path is labelled `SEED` or `SIMULATED` at every
 * point of display. The flag permits demo data; it never disguises it.
 */

import type { DataState, SourceMeta } from '../shared/dataState';
import { arkaStore } from './ArkaStore';
import type { DataMode } from './settings';

export interface DemoModeStatus {
  /** This client build permits locally-generated fixtures. */
  clientPermitted: boolean;
  /**
   * The server is configured to return fixtures. Null until `/api/health`
   * answers — unknown is reported as unknown, not assumed to be false.
   */
  serverActive: boolean | null;
  /** The operator's preference from settings. */
  preference: DataMode;
  /** Demo fixtures are actually being presented somewhere in the platform. */
  active: boolean;
  /** One line for the badge tooltip, explaining exactly why. */
  reason: string;
}

/**
 * Provenance carried by every locally-generated fixture.
 *
 * `kind: 'reference'` rather than `'observation'`: a fixture is illustrative
 * structure, not a measurement of anything in Bhubaneswar.
 */
export const DEMO_SOURCE: SourceMeta = {
  provider: 'ARKA demo fixture',
  kind: 'reference',
  note: 'Locally generated for demonstration. Not an observation of the city and not fit for operational use.',
};

/** The state every locally-generated fixture must carry. */
export const DEMO_DATA_STATE: DataState = 'SIMULATED';

const clientPermitted = import.meta.env.VITE_USE_DEMO_DATA === 'true';

let serverActive: boolean | null = null;
let cached: DemoModeStatus = compute();

const listeners = new Set<() => void>();

function describe(permitted: boolean, preference: DataMode, active: boolean): string {
  if (active) {
    return 'Demo mode. Fixture records are labelled SEED or SIMULATED and are not observations of the city.';
  }
  if (!permitted) {
    return serverActive === null
      ? 'Live sources only. Demo fixtures are disabled in this build; the server has not yet reported its setting.'
      : 'Live sources only. Demo fixtures are disabled in both this build and the server configuration.';
  }
  return preference === 'live'
    ? 'Live sources only, by operator selection. Demo fixtures are available in this environment but not shown.'
    : 'Live sources only.';
}

function compute(): DemoModeStatus {
  const preference = arkaStore.getSettings().dataMode;
  const permitted = clientPermitted || serverActive === true;
  // Server-side demo data is a fact about the responses arriving, not a
  // preference — if the server is serving fixtures, demo data is in effect
  // whatever the operator selected, and the badge must say so.
  const active = serverActive === true || (permitted && preference === 'demo');
  return {
    clientPermitted,
    serverActive,
    preference,
    active,
    reason: describe(permitted, preference, active),
  };
}

function refreshCache(): void {
  const next = compute();
  const changed =
    next.clientPermitted !== cached.clientPermitted ||
    next.serverActive !== cached.serverActive ||
    next.preference !== cached.preference ||
    next.active !== cached.active;
  if (!changed) return;
  cached = next;
  for (const listener of Array.from(listeners)) listener();
}

// A preference change is a demo-status change, so track the settings channel
// rather than making every caller remember to re-probe after a settings write.
arkaStore.subscribe('settings', refreshCache);

/** Referentially stable between changes, so it is safe for `useSyncExternalStore`. */
export function getDemoStatus(): DemoModeStatus {
  return cached;
}

export function subscribeDemoStatus(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Asks the server how it is configured.
 *
 * A failure leaves `serverActive` as null rather than assuming false: "the server
 * did not answer" and "the server said no" are different facts, and only one of
 * them justifies telling the operator that demo data is off everywhere.
 */
export async function probeServerDemoMode(): Promise<DemoModeStatus> {
  try {
    const response = await fetch('/api/health');
    if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
    const payload = (await response.json()) as { useDemoData?: unknown };
    serverActive = typeof payload.useDemoData === 'boolean' ? payload.useDemoData : null;
  } catch {
    serverActive = null;
  }
  refreshCache();
  return cached;
}

/** True when a fixture may be produced. Guard every fixture generator with this. */
export function demoFixturesAllowed(): boolean {
  return cached.active;
}
