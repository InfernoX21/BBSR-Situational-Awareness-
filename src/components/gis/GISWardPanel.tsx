/**
 * Ward intelligence.
 *
 * Select a ward, and ARKA zooms to the real polygon from the city's ward boundary
 * dataset, outlines it on the main map, and lists the attributes that dataset
 * actually publishes for it.
 *
 * Two behaviours matter more than the layout:
 *
 *  - a ward the source has no record for shows the fixed unavailable line. It
 *    does not show an empty attribute table, a zero population or a plausible
 *    estimate;
 *  - every number here comes straight from the dataset. Nothing is interpolated
 *    from neighbouring wards, scaled from a citywide total, or filled in.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Crosshair, Loader2, MapPin, Search, X } from 'lucide-react';
import type { CityGISProvider, GISAttributeRow, GISWardRecord } from '../../services/gis/types';
import type { GISMapActions } from './gisMapActions';
import type { WardDirectory } from './useWardDirectory';

/** Exact wording required when the source publishes nothing for a ward. */
const NO_WARD_DATA = 'No verified data available for this ward.';

/** Exact wording required when no ward dataset is connected at all. */
const NO_WARD_DATASET = 'No verified ward dataset is connected for this city.';

interface GISWardPanelProps {
  provider: CityGISProvider;
  actions: GISMapActions;
  directory: WardDirectory;
  /**
   * Ward code handed over from the spatial query engine. Selecting a ward there
   * routes to this module rather than reimplementing the highlight, so a query
   * result and a hand-picked ward behave identically.
   */
  requestedWard?: string | null;
  /** Called once a requested ward has been picked up, so it does not re-fire. */
  onRequestHandled?: () => void;
}

/**
 * Turn a ward record into display rows, skipping everything the source left
 * empty.
 *
 * A ward with no published councillor gets no councillor row — not "—", not
 * "Unknown", and not a name carried over from anywhere else.
 */
function wardAttributes(ward: GISWardRecord): GISAttributeRow[] {
  const rows: GISAttributeRow[] = [{ label: 'Ward number', value: ward.wardNo }];

  const push = (label: string, value: string | number | null) => {
    if (value === null || value === undefined) return;
    if (typeof value === 'number') {
      if (!Number.isFinite(value)) return;
      rows.push({ label, value: value.toLocaleString('en-IN') });
      return;
    }
    const trimmed = value.trim();
    if (trimmed) rows.push({ label, value: trimmed });
  };

  push('Municipal zone', ward.zone);
  push('Councillor', ward.councillor);
  push('Ward officer', ward.wardOfficer);
  if (ward.areaHectares !== null && Number.isFinite(ward.areaHectares)) {
    rows.push({
      label: 'Area',
      value: `${ward.areaHectares.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ha`,
    });
  }
  push('Households', ward.households);
  push('Population', ward.population);
  push('Population — male', ward.populationMale);
  push('Population — female', ward.populationFemale);
  push('Population — SC', ward.populationSC);
  push('Population — ST', ward.populationST);

  return rows;
}

export const GISWardPanel: React.FC<GISWardPanelProps> = ({
  provider,
  actions,
  directory,
  requestedWard,
  onRequestHandled,
}) => {
  const { wards, totals, loading: listLoading, error: listError, available } = directory;

  const [filter, setFilter] = useState('');
  const [selectedCode, setSelectedCode] = useState('');
  const [ward, setWard] = useState<GISWardRecord | null>(null);
  const [wardMissing, setWardMissing] = useState(false);
  const [wardError, setWardError] = useState<string | null>(null);
  const [wardLoading, setWardLoading] = useState(false);

  const wardRequest = useRef<AbortController | null>(null);

  const visibleWards = useMemo(() => {
    if (!wards) return [];
    const needle = filter.trim().toLowerCase();
    if (!needle) return wards;
    return wards.filter((w) =>
      [w.wardNo, w.zone ?? '', w.councillor ?? ''].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [wards, filter]);

  const selectWard = useCallback(
    async (code: string, options: { openCard?: boolean } = {}) => {
      setSelectedCode(code);
      setWard(null);
      setWardMissing(false);
      setWardError(null);
      actions.clearHighlight();

      if (!code) return;

      wardRequest.current?.abort();
      const abort = new AbortController();
      wardRequest.current = abort;
      setWardLoading(true);

      // Ward outlines give the selected polygon somewhere to sit. Shown without
      // a camera move, because the fit below is the one that matters.
      const contextLayer = provider.wardLayerId;
      if (contextLayer) void actions.ensureLayer(contextLayer);

      try {
        const record = await provider.getWard(code, { signal: abort.signal });
        if (abort.signal.aborted) return;

        if (!record) {
          setWardMissing(true);
          return;
        }

        setWard(record);

        if (record.geometry) {
          actions.highlight([{ geometry: record.geometry, label: `Ward ${record.wardNo}` }], { fit: true });
        } else if (record.bounds) {
          // No polygon published, but a usable box — fit to it so the selection
          // still moves the map rather than silently doing nothing.
          actions.fitBounds(record.bounds);
        }

        if (options.openCard) {
          actions.select({
            layerId: provider.wardLayerId,
            layerLabel: totals?.datasetLabel ?? 'City ward boundary dataset',
            themeLabel: 'Administrative boundaries',
            title: `Ward ${record.wardNo}`,
            attributes: wardAttributes(record),
            properties: {},
            geometry: record.geometry,
            origin: 'query',
          });
        }
      } catch (cause: unknown) {
        if (abort.signal.aborted) return;
        setWardError(cause instanceof Error ? cause.message : String(cause));
      } finally {
        if (!abort.signal.aborted) setWardLoading(false);
      }
    },
    [actions, provider, totals],
  );

  // A ward handed over from the query engine selects itself and opens its card,
  // so a query result lands on the map without a second click.
  useEffect(() => {
    if (!requestedWard) return;
    void selectWard(requestedWard, { openCard: true });
    onRequestHandled?.();
  }, [requestedWard, selectWard, onRequestHandled]);

  useEffect(() => () => wardRequest.current?.abort(), []);

  const attributes = ward ? wardAttributes(ward) : [];

  if (!available) {
    return (
      <div className="p-3">
        <p className="flex items-start gap-2 text-[12px] text-ink-muted leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 text-caution mt-px" />
          {NO_WARD_DATASET}
        </p>
      </div>
    );
  }

  return (
    <div className="gov-scroll-thin overflow-y-auto min-h-0 p-3 space-y-3">
      {/* Citywide context, straight from the ward dataset. */}
      {totals && (
        <div className="gov-inset p-2.5">
          <div className="grid grid-cols-3 gap-2">
            <div>
              <span className="gov-label">Wards</span>
              <span className="gov-metric-sm block">{totals.wardCount.toLocaleString('en-IN')}</span>
            </div>
            <div>
              <span className="gov-label">Population</span>
              <span className="gov-metric-sm block">
                {totals.population === null ? 'Not published' : totals.population.toLocaleString('en-IN')}
              </span>
            </div>
            <div>
              <span className="gov-label">Households</span>
              <span className="gov-metric-sm block">
                {totals.households === null ? 'Not published' : totals.households.toLocaleString('en-IN')}
              </span>
            </div>
          </div>
          <p className="mt-2 text-[10px] text-ink-subtle leading-relaxed">
            Summed by the source service across {totals.datasetLabel}. Reference data, not a live count.
          </p>
        </div>
      )}

      {/* Ward selector: filter, then pick. */}
      <div className="space-y-1.5">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter by ward, zone or councillor"
            aria-label="Filter wards"
            className="gov-input pl-7 pr-7 py-1 text-[12px]"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
              aria-label="Clear ward filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <label className="block">
          <span className="sr-only">Select a ward</span>
          <select
            value={selectedCode}
            onChange={(event) => void selectWard(event.target.value)}
            disabled={listLoading || !wards}
            className="gov-select text-[12px]"
          >
            <option value="">
              {listLoading ? 'Loading wards…' : `Select a ward (${visibleWards.length})`}
            </option>
            {visibleWards.map((w) => (
              <option key={w.wardNo} value={w.wardNo}>
                {w.wardNo}
                {w.zone ? ` · ${w.zone}` : ''}
                {w.councillor ? ` · ${w.councillor}` : ''}
              </option>
            ))}
          </select>
        </label>

        {listLoading && (
          <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
            <Loader2 className="w-3 h-3 animate-spin text-accent" />
            Reading the ward boundary dataset…
          </p>
        )}

        {listError && (
          <p className="text-[11px] text-critical leading-relaxed break-words">{listError}</p>
        )}
      </div>

      {/* Selected ward. */}
      {wardLoading && (
        <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
          <Loader2 className="w-3 h-3 animate-spin text-accent" />
          Fetching ward {selectedCode}…
        </p>
      )}

      {wardError && (
        <p className="text-[11px] text-critical leading-relaxed break-words">{wardError}</p>
      )}

      {wardMissing && (
        <p className="flex items-start gap-2 text-[12px] text-ink-muted leading-relaxed">
          <AlertTriangle className="w-4 h-4 shrink-0 text-caution mt-px" />
          {NO_WARD_DATA}
        </p>
      )}

      {ward && !wardLoading && (
        <div className="gov-panel-flat p-0 overflow-hidden">
          <div className="gov-panel-head">
            <span className="gov-title">Ward {ward.wardNo}</span>
            <span className="gov-tag">Reference</span>
          </div>

          <div className="p-2.5 space-y-2.5">
            {attributes.length > 1 ? (
              <dl className="space-y-0">
                {attributes.map((row) => (
                  <div key={row.label} className="flex gap-2 py-1 border-b border-line last:border-0">
                    <dt className="shrink-0 w-[118px] gov-label">{row.label}</dt>
                    <dd className="min-w-0 flex-1 text-[12px] text-ink break-words">{row.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="text-[12px] text-ink-muted leading-relaxed">{NO_WARD_DATA}</p>
            )}

            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                disabled={!ward.geometry && !ward.bounds}
                onClick={() => {
                  if (ward.geometry) {
                    actions.highlight([{ geometry: ward.geometry, label: `Ward ${ward.wardNo}` }], { fit: true });
                  } else if (ward.bounds) {
                    actions.fitBounds(ward.bounds);
                  }
                }}
                className="gov-btn gov-btn-secondary gov-btn-sm"
              >
                <Crosshair className="w-3.5 h-3.5" />
                Zoom to ward
              </button>

              <button
                type="button"
                onClick={() =>
                  actions.select({
                    layerId: provider.wardLayerId,
                    layerLabel: totals?.datasetLabel ?? 'City ward boundary dataset',
                    themeLabel: 'Administrative boundaries',
                    title: `Ward ${ward.wardNo}`,
                    attributes,
                    properties: {},
                    geometry: ward.geometry,
                    origin: 'ward',
                  })
                }
                className="gov-btn gov-btn-quiet gov-btn-sm"
              >
                <MapPin className="w-3.5 h-3.5" />
                Open info card
              </button>
            </div>

            <p className="text-[10px] text-ink-subtle leading-relaxed">
              Attributes are shown exactly as published by the city ward boundary dataset. Fields the
              source leaves empty are omitted rather than filled in.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
