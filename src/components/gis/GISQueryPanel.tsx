/**
 * ARKA spatial query engine.
 *
 * Three kinds of question, each backed by a dataset ARKA has actually verified:
 *
 *  Administrative  find a ward by code, zone or councillor
 *  Population      filter wards by published population figures
 *  Facilities      find features in any queryable catalogue layer
 *
 * A mode with no dataset behind it is disabled and says so in fixed wording. It
 * is never left enabled to return nothing, and never populated with example
 * locations — an empty result here means the city's own service returned no
 * match, which is information an operator can act on.
 *
 * Results are geography, not a list: running a query draws the matching features
 * on the main ARKA map and fits the view to them. Selecting a row narrows the
 * highlight to one feature and opens its information card.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Crosshair, Layers, Loader2, Play, Search, Users, X } from 'lucide-react';
import {
  GIS_CATEGORY_LABEL,
  GIS_CATEGORY_ORDER,
  type CityGISProvider,
  type GISCategory,
  type GISQueryResult,
  type GISWardRecord,
} from '../../services/gis/types';
import type { GISHighlightTarget } from '../../services/gis/leafletGISAdapter';
import type { GISMapActions } from './gisMapActions';
import type { WardDirectory } from './useWardDirectory';

/** Exact wording required when no population dataset is connected. */
const NO_POPULATION_DATASET = 'Population dataset not connected.';

/** Exact wording required when a theme group has no dataset behind it. */
const NO_QUERYABLE_LAYERS = 'No dataset currently connected.';

/** Cap ARKA applies to a facility query, on top of the provider's own limit. */
const FACILITY_LIMIT = 100;

type QueryMode = 'administrative' | 'population' | 'facilities';

const MODES: { id: QueryMode; label: string; icon: typeof Search }[] = [
  { id: 'administrative', label: 'Administrative', icon: Layers },
  { id: 'population', label: 'Population', icon: Users },
  { id: 'facilities', label: 'Facilities', icon: Search },
];

type PopulationComparison = 'at-least' | 'at-most';

interface GISQueryPanelProps {
  provider: CityGISProvider;
  actions: GISMapActions;
  directory: WardDirectory;
  /**
   * Hand a ward over to the ward intelligence module, which owns the highlight
   * and the attribute card. Two panels resolving a ward two different ways would
   * be two chances to disagree about what the dataset says.
   */
  onOpenWard: (wardNo: string) => void;
}

export const GISQueryPanel: React.FC<GISQueryPanelProps> = ({
  provider,
  actions,
  directory,
  onOpenWard,
}) => {
  const [mode, setMode] = useState<QueryMode>('administrative');

  const hasPopulation = provider.hasPopulationDataset();
  const queryableLayers = useMemo(() => provider.listQueryableLayers(), [provider]);

  // Group the queryable layers by theme so the selector reads like the layer
  // tree rather than like a flat dump of 68 service names.
  const layerGroups = useMemo(() => {
    const byCategory = new Map<GISCategory, typeof queryableLayers>();
    for (const layer of queryableLayers) {
      const bucket = byCategory.get(layer.category);
      if (bucket) bucket.push(layer);
      else byCategory.set(layer.category, [layer]);
    }
    return GIS_CATEGORY_ORDER.filter((category) => byCategory.has(category)).map((category) => ({
      category,
      layers: (byCategory.get(category) ?? []).slice().sort((a, b) => a.label.localeCompare(b.label, 'en')),
    }));
  }, [queryableLayers]);

  // --- Administrative ----------------------------------------------------

  const [wardTerm, setWardTerm] = useState('');

  const wardMatches = useMemo(() => {
    const needle = wardTerm.trim().toLowerCase();
    if (!directory.wards || !needle) return [];
    return directory.wards.filter((w) =>
      [w.wardNo, w.zone ?? '', w.councillor ?? '', w.wardOfficer ?? ''].some((field) =>
        field.toLowerCase().includes(needle),
      ),
    );
  }, [directory.wards, wardTerm]);

  // --- Population --------------------------------------------------------

  const [comparison, setComparison] = useState<PopulationComparison>('at-least');
  const [threshold, setThreshold] = useState('15000');
  const [populationRun, setPopulationRun] = useState<{
    matches: GISWardRecord[];
    unpublished: number;
    comparison: PopulationComparison;
    threshold: number;
  } | null>(null);

  const runPopulationQuery = useCallback(() => {
    const wards = directory.wards ?? [];
    const limit = Number.parseFloat(threshold);
    if (!Number.isFinite(limit)) return;

    // Wards the source leaves blank cannot be compared against a threshold, so
    // they are counted out loud rather than silently treated as zero.
    const comparable = wards.filter((w) => w.population !== null && Number.isFinite(w.population));
    const matches = comparable
      .filter((w) => (comparison === 'at-least' ? (w.population as number) >= limit : (w.population as number) <= limit))
      .sort((a, b) => (b.population as number) - (a.population as number));

    setPopulationRun({
      matches,
      unpublished: wards.length - comparable.length,
      comparison,
      threshold: limit,
    });
  }, [comparison, directory.wards, threshold]);

  // --- Facilities --------------------------------------------------------

  const [facilityLayerId, setFacilityLayerId] = useState('');
  const [facilityTerm, setFacilityTerm] = useState('');
  const [scopeToView, setScopeToView] = useState(true);
  const [facilityResults, setFacilityResults] = useState<GISQueryResult[] | null>(null);
  const [facilityLoading, setFacilityLoading] = useState(false);
  const [facilityError, setFacilityError] = useState<string | null>(null);
  const [selectedRow, setSelectedRow] = useState<string | null>(null);

  const facilityRequest = useRef<AbortController | null>(null);
  useEffect(() => () => facilityRequest.current?.abort(), []);

  const runFacilityQuery = useCallback(async () => {
    if (!facilityLayerId) return;

    facilityRequest.current?.abort();
    const abort = new AbortController();
    facilityRequest.current = abort;

    setFacilityLoading(true);
    setFacilityError(null);
    setFacilityResults(null);
    setSelectedRow(null);

    const bounds = scopeToView ? actions.currentBounds() : null;

    try {
      const rows = await provider.queryLayer(facilityLayerId, facilityTerm, {
        signal: abort.signal,
        limit: FACILITY_LIMIT,
        bounds: bounds ?? undefined,
      });
      if (abort.signal.aborted) return;

      setFacilityResults(rows);

      // Draw the layer itself for context, then outline the matches on top and
      // fit to them. This is the click-to-display path for a query.
      void actions.ensureLayer(facilityLayerId);

      const targets: GISHighlightTarget[] = rows
        .filter((row) => row.geometry !== null)
        .map((row) => ({ geometry: row.geometry as GeoJSON.Geometry, label: row.label }));

      if (targets.length) actions.highlight(targets, { fit: true, maxZoom: 17 });
      else actions.clearHighlight();
    } catch (cause: unknown) {
      if (abort.signal.aborted) return;
      setFacilityError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      if (!abort.signal.aborted) setFacilityLoading(false);
    }
  }, [actions, facilityLayerId, facilityTerm, provider, scopeToView]);

  const openResult = useCallback(
    (row: GISQueryResult, index: number) => {
      setSelectedRow(`${row.layerId}:${index}`);
      const layer = provider.getLayer(row.layerId);

      if (row.geometry) {
        actions.highlight([{ geometry: row.geometry, label: row.label }], { fit: true, maxZoom: 17 });
      } else {
        actions.flyTo(row.lat, row.lng, 17);
      }

      actions.select({
        layerId: row.layerId,
        layerLabel: row.layerLabel,
        themeLabel: layer ? GIS_CATEGORY_LABEL[layer.category] : '',
        title: row.label,
        attributes: row.attributes,
        properties: {},
        geometry: row.geometry,
        origin: 'query',
        caveat: layer?.caveat ?? null,
      });
    },
    [actions, provider],
  );

  const selectedLayer = queryableLayers.find((layer) => layer.layerId === facilityLayerId) ?? null;

  return (
    <div className="gov-scroll-thin overflow-y-auto min-h-0 p-3 space-y-3">
      {/* Mode selector. */}
      <div className="gov-map-group is-row" role="group" aria-label="Query type">
        {MODES.map((entry) => {
          const Icon = entry.icon;
          const disabled = entry.id === 'population' && !hasPopulation;
          return (
            <button
              key={entry.id}
              type="button"
              disabled={disabled}
              aria-pressed={mode === entry.id}
              onClick={() => setMode(entry.id)}
              className={`gov-map-btn ${mode === entry.id ? 'is-active' : ''}`}
              title={disabled ? NO_POPULATION_DATASET : undefined}
            >
              <Icon className="w-3.5 h-3.5" />
              {entry.label}
            </button>
          );
        })}
      </div>

      {/* Administrative: find a ward. */}
      {mode === 'administrative' && (
        <div className="space-y-2">
          {!directory.available ? (
            <p className="flex items-start gap-2 text-[12px] text-ink-muted leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-caution mt-px" />
              No verified ward dataset is connected for this city.
            </p>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" />
                <input
                  type="search"
                  value={wardTerm}
                  onChange={(event) => setWardTerm(event.target.value)}
                  placeholder="Ward code, zone or councillor"
                  aria-label="Find a ward"
                  className="gov-input pl-7 pr-7 py-1 text-[12px]"
                />
                {wardTerm && (
                  <button
                    type="button"
                    onClick={() => setWardTerm('')}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
                    aria-label="Clear query"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {directory.loading && (
                <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  Reading the ward boundary dataset…
                </p>
              )}

              {directory.error && (
                <p className="text-[11px] text-critical leading-relaxed break-words">{directory.error}</p>
              )}

              {wardTerm.trim() && !directory.loading && (
                <p className="gov-label">
                  {wardMatches.length} of {directory.wards?.length ?? 0} wards match
                </p>
              )}

              <div className="space-y-1">
                {wardMatches.slice(0, 40).map((ward) => (
                  <button
                    key={ward.wardNo}
                    type="button"
                    onClick={() => onOpenWard(ward.wardNo)}
                    className="gov-row w-full text-left"
                  >
                    <span className="gov-mono text-[12px] shrink-0">{ward.wardNo}</span>
                    <span className="min-w-0 flex-1 text-[12px] text-ink-muted truncate">
                      {[ward.zone, ward.councillor].filter(Boolean).join(' · ')}
                    </span>
                    <Crosshair className="w-3.5 h-3.5 shrink-0 text-ink-subtle" />
                  </button>
                ))}
              </div>

              {wardMatches.length > 40 && (
                <p className="text-[10px] text-ink-subtle">
                  Showing the first 40 of {wardMatches.length} matches. Narrow the search to see the rest.
                </p>
              )}

              <p className="text-[10px] text-ink-subtle leading-relaxed">
                Wards can also be selected by clicking a ward polygon on the map once ward boundaries
                are displayed.
              </p>
            </>
          )}
        </div>
      )}

      {/* Population: filter wards by published figures. */}
      {mode === 'population' && (
        <div className="space-y-2">
          {!hasPopulation ? (
            <p className="flex items-start gap-2 text-[12px] text-ink-muted leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-caution mt-px" />
              {NO_POPULATION_DATASET}
            </p>
          ) : (
            <>
              <div className="flex items-end gap-1.5">
                <label className="flex-1 min-w-0">
                  <span className="gov-label">Ward population</span>
                  <select
                    value={comparison}
                    onChange={(event) => setComparison(event.target.value as PopulationComparison)}
                    className="gov-select text-[12px]"
                  >
                    <option value="at-least">At least</option>
                    <option value="at-most">At most</option>
                  </select>
                </label>
                <label className="w-[110px] shrink-0">
                  <span className="gov-label">People</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    step={500}
                    value={threshold}
                    onChange={(event) => setThreshold(event.target.value)}
                    className="gov-input py-1 text-[12px]"
                  />
                </label>
                <button
                  type="button"
                  onClick={runPopulationQuery}
                  disabled={directory.loading || !directory.wards}
                  className="gov-btn gov-btn-primary gov-btn-sm shrink-0"
                >
                  <Play className="w-3.5 h-3.5" />
                  Run
                </button>
              </div>

              {directory.loading && (
                <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  Reading the ward boundary dataset…
                </p>
              )}

              {directory.error && (
                <p className="text-[11px] text-critical leading-relaxed break-words">{directory.error}</p>
              )}

              {populationRun && (
                <>
                  <p className="gov-label">
                    {populationRun.matches.length} ward{populationRun.matches.length === 1 ? '' : 's'}{' '}
                    {populationRun.comparison === 'at-least' ? '≥' : '≤'}{' '}
                    {populationRun.threshold.toLocaleString('en-IN')}
                  </p>

                  <div className="space-y-1">
                    {populationRun.matches.map((ward) => (
                      <button
                        key={ward.wardNo}
                        type="button"
                        onClick={() => onOpenWard(ward.wardNo)}
                        className="gov-row w-full text-left"
                      >
                        <span className="gov-mono text-[12px] shrink-0">{ward.wardNo}</span>
                        <span className="min-w-0 flex-1 text-[12px] text-ink-muted truncate">
                          {ward.zone ?? ''}
                        </span>
                        <span className="gov-mono text-[12px] shrink-0 text-ink">
                          {(ward.population as number).toLocaleString('en-IN')}
                        </span>
                      </button>
                    ))}
                  </div>

                  {populationRun.unpublished > 0 && (
                    <p className="text-[10px] text-caution leading-relaxed">
                      {populationRun.unpublished} ward
                      {populationRun.unpublished === 1 ? '' : 's'} excluded: the source publishes no
                      population figure for {populationRun.unpublished === 1 ? 'it' : 'them'}.
                    </p>
                  )}

                  <p className="text-[10px] text-ink-subtle leading-relaxed">
                    Figures are the published ward totals from{' '}
                    {directory.totals?.datasetLabel ?? 'the city ward boundary dataset'}. Reference
                    data, not a live count.
                  </p>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Facilities: query any catalogued layer. */}
      {mode === 'facilities' && (
        <div className="space-y-2">
          {layerGroups.length === 0 ? (
            <p className="flex items-start gap-2 text-[12px] text-ink-muted leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 text-caution mt-px" />
              {NO_QUERYABLE_LAYERS}
            </p>
          ) : (
            <>
              <label className="block">
                <span className="gov-label">Dataset</span>
                <select
                  value={facilityLayerId}
                  onChange={(event) => setFacilityLayerId(event.target.value)}
                  className="gov-select text-[12px]"
                >
                  <option value="">Select a dataset ({queryableLayers.length} connected)</option>
                  {layerGroups.map((group) => (
                    <optgroup key={group.category} label={GIS_CATEGORY_LABEL[group.category]}>
                      {group.layers.map((layer) => (
                        <option key={layer.layerId} value={layer.layerId}>
                          {layer.label}
                          {layer.verifiedFeatureCount !== null
                            ? ` (${layer.verifiedFeatureCount.toLocaleString('en-IN')})`
                            : ''}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="gov-label">Name contains (optional)</span>
                <input
                  type="search"
                  value={facilityTerm}
                  onChange={(event) => setFacilityTerm(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void runFacilityQuery();
                  }}
                  placeholder="Leave blank to list all"
                  className="gov-input py-1 text-[12px]"
                />
              </label>

              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 text-[11px] text-ink-muted">
                  <input
                    type="checkbox"
                    checked={scopeToView}
                    onChange={(event) => setScopeToView(event.target.checked)}
                    className="accent-accent"
                  />
                  Current map view only
                </label>
                <button
                  type="button"
                  onClick={() => void runFacilityQuery()}
                  disabled={!facilityLayerId || facilityLoading}
                  className="gov-btn gov-btn-primary gov-btn-sm"
                >
                  {facilityLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Play className="w-3.5 h-3.5" />
                  )}
                  Run query
                </button>
              </div>

              {facilityLoading && (
                <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                  <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  Querying {selectedLayer?.label ?? 'dataset'}…
                </p>
              )}

              {facilityError && (
                <p className="text-[11px] text-critical leading-relaxed break-words">{facilityError}</p>
              )}

              {facilityResults && !facilityLoading && (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <p className="gov-label">
                      {facilityResults.length} feature{facilityResults.length === 1 ? '' : 's'} found
                    </p>
                    {facilityResults.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const targets: GISHighlightTarget[] = facilityResults
                            .filter((row) => row.geometry !== null)
                            .map((row) => ({ geometry: row.geometry as GeoJSON.Geometry, label: row.label }));
                          if (targets.length) actions.highlight(targets, { fit: true, maxZoom: 17 });
                        }}
                        className="gov-btn gov-btn-quiet gov-btn-sm"
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        Fit to all
                      </button>
                    )}
                  </div>

                  {facilityResults.length === 0 && (
                    <p className="text-[12px] text-ink-muted leading-relaxed">
                      The dataset returned no matching features
                      {scopeToView ? ' in the current map view' : ''}
                      {facilityTerm.trim() ? ` for “${facilityTerm.trim()}”` : ''}.
                    </p>
                  )}

                  <div className="space-y-1">
                    {facilityResults.map((row, index) => (
                      <button
                        key={`${row.layerId}:${index}`}
                        type="button"
                        onClick={() => openResult(row, index)}
                        className={`gov-row w-full text-left ${
                          selectedRow === `${row.layerId}:${index}` ? 'is-selected' : ''
                        }`}
                      >
                        <span className="min-w-0 flex-1 text-[12px] text-ink truncate">{row.label}</span>
                        <span className="gov-mono text-[10px] shrink-0 text-ink-subtle">
                          {row.lat.toFixed(4)}, {row.lng.toFixed(4)}
                        </span>
                      </button>
                    ))}
                  </div>

                  {facilityResults.length >= FACILITY_LIMIT && (
                    <p className="text-[10px] text-caution leading-relaxed">
                      Capped at {FACILITY_LIMIT} features. Narrow the search or zoom in to see the rest —
                      more matches exist than are shown.
                    </p>
                  )}
                </>
              )}

              <p className="text-[10px] text-ink-subtle leading-relaxed">
                Results come from a live request to {provider.cityName}'s GIS service. Attributes are
                shown exactly as published; fields the source leaves empty are omitted.
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
};
