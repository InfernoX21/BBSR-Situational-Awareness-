/**
 * Compact information card for a selected feature.
 *
 * Opens over the map when the operator clicks a feature, a query result or a
 * ward, and shows only what the connected dataset published for it. There is no
 * "unknown", no "—" and no inferred value: a field the source left empty is not
 * a row. A feature the source carries no attributes for says exactly that.
 *
 * The action row is the part worth being careful about. Every button here does
 * real work against real data:
 *
 *  Zoom to          fits the map to the feature's own geometry
 *  View attributes  reveals the remaining published fields, nothing more
 *  Search nearby    a genuine bounded query against the datasets on the map
 *  Add to analysis  collects features and reports measured facts about the set
 *                   — how many, from which datasets, over what extent. It does
 *                   not score, rank, rate or assess anything.
 *  Clear            drops the selection and its outline
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronDown,
  Crosshair,
  Layers,
  List,
  Loader2,
  Radar,
  Sigma,
  X,
} from 'lucide-react';
import type { CityGISProvider, GISQueryResult } from '../../services/gis/types';
import { GIS_CATEGORY_LABEL } from '../../services/gis/types';
import type { GISHighlightTarget } from '../../services/gis/leafletGISAdapter';
import {
  boundsAround,
  geometryBounds,
  geometryCentroid,
  type GISMapActions,
  type GISSelection,
} from './gisMapActions';

/** Radius of a nearby search, in metres. Stated in the UI, never implied. */
const NEARBY_RADIUS_M = 800;

/** Datasets a single nearby search will query, to bound the request count. */
const NEARBY_MAX_LAYERS = 8;

/** Features taken from each dataset in a nearby search. */
const NEARBY_PER_LAYER = 20;

/** Attribute rows shown before the operator asks for the rest. */
const COLLAPSED_ROWS = 5;

const METRES_PER_DEGREE_LAT = 110_574;
const METRES_PER_DEGREE_LNG = 111_320;

/**
 * Ground distance between two coordinates, to the nearest metre.
 *
 * Equirectangular rather than haversine: over the few hundred metres a nearby
 * search covers the difference is well under a metre, and the result is only
 * ever used to order a list and label it in round numbers.
 */
function metresBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const dLat = (b.lat - a.lat) * METRES_PER_DEGREE_LAT;
  const cos = Math.cos(((a.lat + b.lat) / 2) * (Math.PI / 180));
  const dLng = (b.lng - a.lng) * METRES_PER_DEGREE_LNG * cos;
  return Math.round(Math.hypot(dLat, dLng));
}

/** Span of a box in metres, for reporting an analysis extent. */
function boundsSpanMetres(bounds: { west: number; south: number; east: number; north: number }): {
  width: number;
  height: number;
} {
  const midLat = (bounds.north + bounds.south) / 2;
  const cos = Math.max(0.1, Math.cos(midLat * (Math.PI / 180)));
  return {
    width: Math.round((bounds.east - bounds.west) * METRES_PER_DEGREE_LNG * cos),
    height: Math.round((bounds.north - bounds.south) * METRES_PER_DEGREE_LAT),
  };
}

/** Metres as a short readable string. */
function formatDistance(metres: number): string {
  if (metres < 1000) return `${metres} m`;
  return `${(metres / 1000).toLocaleString('en-IN', { maximumFractionDigits: 1 })} km`;
}

interface NearbyHit extends GISQueryResult {
  distanceM: number;
}

interface GISFeatureCardProps {
  selection: GISSelection;
  provider: CityGISProvider;
  actions: GISMapActions;
  /**
   * Layers currently on the map that can be queried. A nearby search is scoped to
   * what the operator has displayed rather than to an arbitrary internal list, so
   * the answer is always explainable from the screen.
   */
  nearbyScope: { layerId: string; label: string }[];
  basket: GISSelection[];
  onAddToAnalysis: (selection: GISSelection) => void;
  onClearAnalysis: () => void;
  onClose: () => void;
}

const ORIGIN_LABEL: Record<GISSelection['origin'], string> = {
  map: 'Selected on map',
  ward: 'Ward module',
  query: 'Query result',
};

export const GISFeatureCard: React.FC<GISFeatureCardProps> = ({
  selection,
  provider,
  actions,
  nearbyScope,
  basket,
  onAddToAnalysis,
  onClearAnalysis,
  onClose,
}) => {
  const [showAll, setShowAll] = useState(false);
  const [nearbyOpen, setNearbyOpen] = useState(false);
  const [nearby, setNearby] = useState<NearbyHit[] | null>(null);
  const [nearbyLoading, setNearbyLoading] = useState(false);
  const [nearbyError, setNearbyError] = useState<string | null>(null);
  const [nearbySearched, setNearbySearched] = useState(0);
  const [analysisOpen, setAnalysisOpen] = useState(false);

  const nearbyRequest = useRef<AbortController | null>(null);

  const centre = useMemo(() => geometryCentroid(selection.geometry), [selection.geometry]);

  // A new selection invalidates everything derived from the old one.
  useEffect(() => {
    setShowAll(false);
    setNearbyOpen(false);
    setNearby(null);
    setNearbyError(null);
    setNearbySearched(0);
    nearbyRequest.current?.abort();
  }, [selection]);

  useEffect(() => () => nearbyRequest.current?.abort(), []);

  const runNearby = useCallback(async () => {
    if (!centre) return;

    const scope = nearbyScope.slice(0, NEARBY_MAX_LAYERS);
    if (scope.length === 0) {
      setNearbyOpen(true);
      setNearby([]);
      setNearbySearched(0);
      return;
    }

    nearbyRequest.current?.abort();
    const abort = new AbortController();
    nearbyRequest.current = abort;

    setNearbyOpen(true);
    setNearbyLoading(true);
    setNearbyError(null);
    setNearby(null);

    const bounds = boundsAround(centre.lat, centre.lng, NEARBY_RADIUS_M);

    const settled = await Promise.allSettled(
      scope.map((entry) =>
        provider.queryLayer(entry.layerId, '', {
          signal: abort.signal,
          limit: NEARBY_PER_LAYER,
          bounds,
        }),
      ),
    );

    if (abort.signal.aborted) return;

    const hits: NearbyHit[] = [];
    let failures = 0;

    for (const outcome of settled) {
      if (outcome.status === 'rejected') {
        failures += 1;
        continue;
      }
      for (const row of outcome.value) {
        const distanceM = metresBetween(centre, { lat: row.lat, lng: row.lng });
        // Drop the selected feature itself, which sits at zero distance under its
        // own name and is not a useful "nearby" result.
        if (distanceM <= 1 && row.label === selection.title) continue;
        if (distanceM > NEARBY_RADIUS_M) continue;
        hits.push({ ...row, distanceM });
      }
    }

    hits.sort((a, b) => a.distanceM - b.distanceM);

    setNearby(hits);
    setNearbySearched(scope.length - failures);
    setNearbyLoading(false);
    if (failures > 0) {
      setNearbyError(
        `${failures} of ${scope.length} datasets did not answer. Results below cover the rest.`,
      );
    }
  }, [centre, nearbyScope, provider, selection.title]);

  const zoomToFeature = useCallback(() => {
    if (selection.geometry) {
      actions.highlight([{ geometry: selection.geometry, label: selection.title }], {
        fit: true,
        maxZoom: 17,
      });
    } else if (centre) {
      actions.flyTo(centre.lat, centre.lng, 17);
    }
  }, [actions, centre, selection.geometry, selection.title]);

  const clearSelection = useCallback(() => {
    actions.clearHighlight();
    onClose();
  }, [actions, onClose]);

  const rows = selection.attributes;
  const visibleRows = showAll ? rows : rows.slice(0, COLLAPSED_ROWS);
  const hiddenCount = Math.max(0, rows.length - visibleRows.length);

  // Analysis facts, derived from the collected features and nothing else.
  const analysis = useMemo(() => {
    if (basket.length === 0) return null;
    const datasets = new Set<string>(basket.map((entry: GISSelection) => entry.layerLabel));
    const bounds = geometryBounds(basket.map((entry: GISSelection) => entry.geometry));
    const withGeometry = basket.filter((entry: GISSelection) => entry.geometry !== null).length;
    return {
      count: basket.length,
      datasets: [...datasets].sort((a, b) => a.localeCompare(b, 'en')),
      bounds,
      span: bounds ? boundsSpanMetres(bounds) : null,
      withGeometry,
    };
  }, [basket]);

  const inBasket = basket.some(
    (entry: GISSelection) => entry.title === selection.title && entry.layerLabel === selection.layerLabel,
  );

  return (
    <div className="gov-panel w-[302px] max-w-[calc(100vw-2rem)] flex flex-col max-h-[74vh] shadow-lg">
      <div className="gov-panel-head">
        <div className="min-w-0 flex-1">
          <span className="gov-title block truncate" title={selection.title}>
            {selection.title}
          </span>
          <span className="gov-label block truncate" title={selection.layerLabel}>
            {selection.layerLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={clearSelection}
          aria-label="Clear selection"
          className="shrink-0 text-ink-subtle hover:text-ink"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="gov-scroll-thin overflow-y-auto min-h-0 p-2.5 space-y-2.5">
        <div className="flex flex-wrap items-center gap-1">
          {selection.themeLabel && <span className="gov-badge is-neutral">{selection.themeLabel}</span>}
          <span className="gov-tag">Reference</span>
          <span className="gov-tag">{ORIGIN_LABEL[selection.origin]}</span>
        </div>

        {selection.caveat && (
          <p className="text-[11px] text-caution leading-relaxed">{selection.caveat}</p>
        )}

        {/* Published attributes only. */}
        {rows.length === 0 ? (
          <p className="text-[12px] text-ink-muted leading-relaxed">
            The connected dataset publishes no attributes for this feature beyond its geometry.
          </p>
        ) : (
          <>
            <dl className="space-y-0">
              {visibleRows.map((row) => (
                <div key={row.label} className="flex gap-2 py-1 border-b border-line last:border-0">
                  <dt className="shrink-0 w-[104px] gov-label">{row.label}</dt>
                  <dd className="min-w-0 flex-1 text-[12px] text-ink break-words">{row.value}</dd>
                </div>
              ))}
            </dl>
            {hiddenCount > 0 && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="gov-btn gov-btn-quiet gov-btn-sm w-full"
              >
                <List className="w-3.5 h-3.5" />
                View attributes ({hiddenCount} more)
              </button>
            )}
          </>
        )}

        {/* Actions. */}
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={zoomToFeature}
            disabled={!selection.geometry && !centre}
            className="gov-btn gov-btn-secondary gov-btn-sm"
          >
            <Crosshair className="w-3.5 h-3.5" />
            Zoom to
          </button>

          <button
            type="button"
            onClick={() => void runNearby()}
            disabled={!centre || nearbyLoading}
            className="gov-btn gov-btn-secondary gov-btn-sm"
            title={centre ? undefined : 'This feature carries no readable geometry to search around.'}
          >
            {nearbyLoading ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Radar className="w-3.5 h-3.5" />
            )}
            Search nearby
          </button>

          <button
            type="button"
            onClick={() => {
              onAddToAnalysis(selection);
              setAnalysisOpen(true);
            }}
            disabled={inBasket}
            className="gov-btn gov-btn-secondary gov-btn-sm"
          >
            <Sigma className="w-3.5 h-3.5" />
            {inBasket ? 'In analysis' : 'Add to analysis'}
          </button>

          <button type="button" onClick={clearSelection} className="gov-btn gov-btn-quiet gov-btn-sm">
            <X className="w-3.5 h-3.5" />
            Clear
          </button>
        </div>

        {/* Nearby results. */}
        {nearbyOpen && (
          <div className="gov-inset p-2 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <Radar className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="gov-label flex-1">Within {NEARBY_RADIUS_M} m</span>
              <button
                type="button"
                onClick={() => setNearbyOpen(false)}
                aria-label="Close nearby results"
                className="text-ink-subtle hover:text-ink"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {nearbyLoading && (
              <p className="flex items-center gap-1.5 text-[11px] text-ink-subtle">
                <Loader2 className="w-3 h-3 animate-spin text-accent" />
                Querying {Math.min(nearbyScope.length, NEARBY_MAX_LAYERS)} displayed datasets…
              </p>
            )}

            {nearbyError && (
              <p className="text-[10px] text-caution leading-relaxed">{nearbyError}</p>
            )}

            {nearby && !nearbyLoading && (
              <>
                {nearbyScope.length === 0 ? (
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    A nearby search covers the datasets currently displayed on the map. Switch on at
                    least one queryable layer to run it.
                  </p>
                ) : nearby.length === 0 ? (
                  <p className="text-[11px] text-ink-muted leading-relaxed">
                    No features within {NEARBY_RADIUS_M} m in the {nearbySearched} dataset
                    {nearbySearched === 1 ? '' : 's'} searched.
                  </p>
                ) : (
                  <>
                    <div className="space-y-0.5 max-h-[168px] overflow-y-auto gov-scroll-thin">
                      {nearby.slice(0, 30).map((hit, index) => (
                        <button
                          key={`${hit.layerId}:${index}`}
                          type="button"
                          onClick={() => {
                            const target: GISHighlightTarget[] = hit.geometry
                              ? [{ geometry: hit.geometry, label: hit.label }]
                              : [];
                            if (target.length) actions.highlight(target, { fit: true, maxZoom: 17 });
                            else actions.flyTo(hit.lat, hit.lng, 17);

                            const layer = provider.getLayer(hit.layerId);
                            actions.select({
                              layerId: hit.layerId,
                              layerLabel: hit.layerLabel,
                              themeLabel: layer ? GIS_CATEGORY_LABEL[layer.category] : '',
                              title: hit.label,
                              attributes: hit.attributes,
                              properties: {},
                              geometry: hit.geometry,
                              origin: 'query',
                              caveat: layer?.caveat ?? null,
                            });
                          }}
                          className="flex items-center gap-2 w-full py-1 text-left group border-b border-line last:border-0"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="block text-[11px] text-ink group-hover:text-accent truncate">
                              {hit.label}
                            </span>
                            <span className="block text-[10px] text-ink-subtle truncate">
                              {hit.layerLabel}
                            </span>
                          </span>
                          <span className="gov-mono text-[10px] shrink-0 text-ink-muted">
                            {formatDistance(hit.distanceM)}
                          </span>
                        </button>
                      ))}
                    </div>

                    <p className="text-[10px] text-ink-subtle leading-relaxed">
                      {nearby.length} feature{nearby.length === 1 ? '' : 's'} from {nearbySearched}{' '}
                      displayed dataset{nearbySearched === 1 ? '' : 's'}. Distances are straight-line,
                      measured between published coordinates — not travel distance.
                    </p>
                  </>
                )}

                {nearbyScope.length > NEARBY_MAX_LAYERS && (
                  <p className="text-[10px] text-caution leading-relaxed">
                    {nearbyScope.length} queryable layers are displayed; the search covered the first{' '}
                    {NEARBY_MAX_LAYERS}.
                  </p>
                )}
              </>
            )}
          </div>
        )}

        {/* Analysis set: measured facts about the collected features. */}
        {analysis && (
          <div className="gov-inset p-2 space-y-1.5">
            <button
              type="button"
              onClick={() => setAnalysisOpen((open) => !open)}
              aria-expanded={analysisOpen}
              className="flex items-center gap-1.5 w-full text-left"
            >
              <Sigma className="w-3.5 h-3.5 text-accent shrink-0" />
              <span className="gov-label flex-1">Analysis set</span>
              <span className="gov-mono text-[10px] text-ink-subtle">{analysis.count}</span>
              <ChevronDown
                className={`w-3.5 h-3.5 text-ink-subtle transition-transform ${
                  analysisOpen ? '' : '-rotate-90'
                }`}
              />
            </button>

            {analysisOpen && (
              <>
                <dl className="space-y-0">
                  <div className="flex gap-2 py-1 border-b border-line">
                    <dt className="shrink-0 w-[104px] gov-label">Features</dt>
                    <dd className="min-w-0 flex-1 text-[12px] text-ink">{analysis.count}</dd>
                  </div>
                  <div className="flex gap-2 py-1 border-b border-line">
                    <dt className="shrink-0 w-[104px] gov-label">Datasets</dt>
                    <dd className="min-w-0 flex-1 text-[12px] text-ink break-words">
                      {analysis.datasets.join(', ')}
                    </dd>
                  </div>
                  <div className="flex gap-2 py-1 border-b border-line last:border-0">
                    <dt className="shrink-0 w-[104px] gov-label">Extent</dt>
                    <dd className="min-w-0 flex-1 text-[12px] text-ink">
                      {analysis.span
                        ? `${formatDistance(analysis.span.width)} × ${formatDistance(analysis.span.height)}`
                        : 'No readable geometry'}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={!analysis.bounds}
                    onClick={() => {
                      const targets: GISHighlightTarget[] = basket
                        .filter((entry) => entry.geometry !== null)
                        .map((entry) => ({
                          geometry: entry.geometry as GeoJSON.Geometry,
                          label: entry.title,
                        }));
                      if (targets.length) actions.highlight(targets, { fit: true, maxZoom: 17 });
                    }}
                    className="gov-btn gov-btn-secondary gov-btn-sm"
                  >
                    <Layers className="w-3.5 h-3.5" />
                    Outline set
                  </button>
                  <button
                    type="button"
                    onClick={onClearAnalysis}
                    className="gov-btn gov-btn-quiet gov-btn-sm"
                  >
                    <X className="w-3.5 h-3.5" />
                    Empty set
                  </button>
                </div>

                <p className="text-[10px] text-ink-subtle leading-relaxed">
                  {analysis.withGeometry} of {analysis.count} carry geometry. These are counts and
                  measurements over the features you selected — ARKA does not score or rate them.
                </p>
              </>
            )}
          </div>
        )}
      </div>

      <div className="border-t border-line px-2.5 py-1.5">
        <p className="text-[10px] text-ink-subtle leading-relaxed">{provider.attribution}</p>
      </div>
    </div>
  );
};
