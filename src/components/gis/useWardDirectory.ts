/**
 * The city's ward directory, loaded once and shared.
 *
 * Both the ward module and the spatial query engine work off the same list of
 * wards, so it is fetched here rather than in each panel — one request instead of
 * two, and no chance of the two panels disagreeing about which wards exist.
 *
 * The request deliberately asks for attributes without geometry. That keeps it
 * small enough to run the moment the panel opens, and means the population
 * figures the query engine filters on are the real published ones rather than
 * something derived from a sample.
 */

import { useEffect, useMemo, useState } from 'react';
import type { CityGISProvider, GISWardRecord, GISWardTotals } from '../../services/gis/types';

export interface WardDirectory {
  /** Null until the first response arrives. Empty array means the source returned none. */
  wards: GISWardRecord[] | null;
  totals: GISWardTotals | null;
  loading: boolean;
  /** Provider message, shown verbatim. Never replaced with "no data". */
  error: string | null;
  /** False when this provider publishes no ward dataset at all. */
  available: boolean;
}

/**
 * Sort ward codes the way an operator reads them.
 *
 * `W2` must come before `W10`, which a plain string sort gets wrong. Codes with
 * no numeric part fall back to a straight comparison rather than being dropped.
 */
export function compareWardCode(a: string, b: string): number {
  const numA = Number.parseInt(a.replace(/\D+/g, ''), 10);
  const numB = Number.parseInt(b.replace(/\D+/g, ''), 10);
  if (Number.isFinite(numA) && Number.isFinite(numB) && numA !== numB) return numA - numB;
  return a.localeCompare(b, 'en');
}

/**
 * Load the ward directory.
 *
 * `enabled` defers the request until something actually needs it, so opening the
 * dashboard does not hit the city GIS server for a panel the operator may never
 * open.
 */
export function useWardDirectory(provider: CityGISProvider, enabled: boolean): WardDirectory {
  const available = provider.hasWardDataset();

  const [wards, setWards] = useState<GISWardRecord[] | null>(null);
  const [totals, setTotals] = useState<GISWardTotals | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled || !available || wards !== null) return;

    const abort = new AbortController();
    setLoading(true);
    setError(null);

    provider
      .listWards({ signal: abort.signal })
      .then((rows) => {
        if (abort.signal.aborted) return;
        setWards([...rows].sort((a, b) => compareWardCode(a.wardNo, b.wardNo)));
      })
      .catch((cause: unknown) => {
        if (abort.signal.aborted) return;
        setError(cause instanceof Error ? cause.message : String(cause));
      })
      .finally(() => {
        if (!abort.signal.aborted) setLoading(false);
      });

    // Totals are supporting context. A failure here leaves them absent rather
    // than taking the ward selector down with it.
    provider
      .getWardTotals({ signal: abort.signal })
      .then((value) => {
        if (!abort.signal.aborted) setTotals(value);
      })
      .catch(() => undefined);

    return () => abort.abort();
  }, [provider, enabled, available, wards]);

  return useMemo(
    () => ({ wards, totals, loading, error, available }),
    [wards, totals, loading, error, available],
  );
}
