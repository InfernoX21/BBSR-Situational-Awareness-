/**
 * The themes / layers tree.
 *
 * This is the surface section 14 is about: every row here is a click that puts
 * geography on the main map. A theme header displays its whole group, a layer row
 * displays one layer, and both fit the view to the data that arrives. Nothing in
 * this file opens a second map, a separate page or a static image.
 *
 * Two rules keep it honest:
 *
 *  - the state badge on each row reports the layer's real position in ARKA's
 *    source-state vocabulary, so `Connected` only ever appears after a request
 *    actually returned;
 *  - a theme with no backing dataset renders the fixed unavailable line rather
 *    than an empty expandable box that looks like it is still loading.
 */

import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ChevronRight,
  Crosshair,
  Eye,
  EyeOff,
  Layers as LayersIcon,
  Loader2,
  Search,
  X,
} from 'lucide-react';
import {
  GIS_CATEGORY_LABEL,
  GIS_CATEGORY_ORDER,
  GIS_SOURCE_STATE_LABEL,
  GIS_SOURCE_STATE_TONE,
} from '../../services/gis/types';
import type { GISCategory, GISLayerDef, GISLayerRuntime } from '../../services/gis/types';
import type { GISMapActions } from './gisMapActions';

/** Shown for a theme group that exists in the architecture but has no dataset yet. */
const NO_DATASET_MESSAGE = 'No dataset currently connected.';

interface GISLayerTreeProps {
  layers: GISLayerDef[];
  runtime: Record<string, GISLayerRuntime>;
  actions: GISMapActions;
  /**
   * Restrict the tree to these themes. The boundaries tab passes the two
   * boundary groups; the themes tab passes everything else.
   */
  categories?: GISCategory[];
  /**
   * Drop these themes from the tree. Complements `categories` so the two tabs can
   * be defined from one list — boundaries include them, themes exclude them —
   * rather than from two lists that have to be kept in step.
   */
  excludeCategories?: GISCategory[];
  /** Themes expanded when the panel first opens. */
  initiallyExpanded?: GISCategory[];
}

export const GISLayerTree: React.FC<GISLayerTreeProps> = ({
  layers,
  runtime,
  actions,
  categories,
  excludeCategories,
  initiallyExpanded = [],
}) => {
  const [expanded, setExpanded] = useState<Set<GISCategory>>(() => new Set(initiallyExpanded));
  const [filter, setFilter] = useState('');
  const [busyCategory, setBusyCategory] = useState<GISCategory | null>(null);

  const shown = useMemo<GISCategory[]>(
    () =>
      GIS_CATEGORY_ORDER.filter(
        (c) => (!categories || categories.includes(c)) && !excludeCategories?.includes(c),
      ),
    [categories, excludeCategories],
  );

  const needle = filter.trim().toLowerCase();

  const byCategory = useMemo(() => {
    const map = new Map<GISCategory, GISLayerDef[]>();
    for (const category of shown) map.set(category, []);
    for (const layer of layers) {
      const bucket = map.get(layer.category);
      if (!bucket) continue;
      if (needle && !layer.label.toLowerCase().includes(needle) && !layer.description.toLowerCase().includes(needle)) {
        continue;
      }
      bucket.push(layer);
    }
    return map;
  }, [layers, shown, needle]);

  const toggleExpanded = (category: GISCategory) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  };

  const displayCategory = async (category: GISCategory, visible: boolean) => {
    setBusyCategory(category);
    try {
      await actions.setCategoryVisible(category, visible);
    } finally {
      setBusyCategory(null);
    }
    if (visible) setExpanded((prev) => new Set(prev).add(category));
  };

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Search within layers — section 6's "search within layer". */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-ink-subtle pointer-events-none" />
          <input
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter layers"
            aria-label="Filter GIS layers by name"
            className="gov-input pl-7 pr-7 py-1 text-[12px]"
          />
          {filter && (
            <button
              type="button"
              onClick={() => setFilter('')}
              className="absolute right-1.5 top-1/2 -translate-y-1/2 text-ink-subtle hover:text-ink"
              aria-label="Clear layer filter"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="gov-scroll-thin overflow-y-auto min-h-0 px-2 pb-2">
        {shown.map((category) => {
          const groupLayers = byCategory.get(category) ?? [];
          const isExpanded = expanded.has(category) || (needle.length > 0 && groupLayers.length > 0);
          const activeCount = groupLayers.filter((l) => runtime[l.id]?.visible).length;
          const anyLoading = groupLayers.some((l) => runtime[l.id]?.sourceState === 'loading');

          // A theme filtered down to nothing is hidden entirely; a theme that is
          // genuinely empty gets the fixed message instead.
          if (needle && !groupLayers.length) return null;

          return (
            <section key={category} className="mb-1">
              <div className="flex items-stretch gap-1">
                <button
                  type="button"
                  onClick={() => toggleExpanded(category)}
                  aria-expanded={isExpanded}
                  className="flex-1 min-w-0 flex items-center gap-1.5 px-2 py-1.5 rounded-sm text-left hover:bg-sunken transition-colors"
                >
                  <ChevronRight
                    className={`w-3.5 h-3.5 shrink-0 text-ink-subtle transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                  />
                  <span className="gov-label truncate">{GIS_CATEGORY_LABEL[category]}</span>
                  <span className="gov-mono text-[10px] text-ink-subtle shrink-0">{groupLayers.length}</span>
                  {activeCount > 0 && (
                    <span className="gov-badge is-info shrink-0">{activeCount} on</span>
                  )}
                  {anyLoading && <Loader2 className="w-3 h-3 shrink-0 text-accent animate-spin" />}
                </button>

                {groupLayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => displayCategory(category, activeCount === 0)}
                    disabled={busyCategory === category}
                    className="gov-btn gov-btn-quiet gov-btn-sm shrink-0"
                    title={
                      activeCount === 0
                        ? `Display every ${GIS_CATEGORY_LABEL[category].toLowerCase()} layer on the map`
                        : `Hide every ${GIS_CATEGORY_LABEL[category].toLowerCase()} layer`
                    }
                  >
                    {busyCategory === category ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : activeCount === 0 ? (
                      <Eye className="w-3.5 h-3.5" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5" />
                    )}
                    <span className="sr-only">
                      {activeCount === 0 ? 'Display all in theme' : 'Hide all in theme'}
                    </span>
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="pl-3 pr-1 pb-1">
                  {groupLayers.length === 0 ? (
                    <p className="px-2 py-1.5 text-[11px] text-ink-muted">{NO_DATASET_MESSAGE}</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {groupLayers.map((layer) => (
                        <GISLayerRow
                          key={layer.id}
                          layer={layer}
                          runtime={runtime[layer.id]}
                          actions={actions}
                        />
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </section>
          );
        })}
      </div>
    </div>
  );
};

interface GISLayerRowProps {
  layer: GISLayerDef;
  runtime: GISLayerRuntime | undefined;
  actions: GISMapActions;
}

/**
 * One layer.
 *
 * The row carries everything section 6 asks of a layer: visibility, loading and
 * error state, zoom-to-extent and opacity. The count shown alongside a visible
 * layer is the runtime count from the last real response; the catalogue's
 * verified count is only shown when nothing has been requested yet, and is
 * labelled as a verified dataset size rather than as a live figure.
 */
const GISLayerRow: React.FC<GISLayerRowProps> = ({ layer, runtime, actions }) => {
  const [showControls, setShowControls] = useState(false);

  const visible = runtime?.visible ?? false;
  const state = runtime?.sourceState ?? 'available-dataset';
  const loading = state === 'loading';
  const failed = state === 'unavailable';

  return (
    <li>
      <div className={`gov-row ${visible ? 'is-selected' : ''} !py-1 !px-1.5 gap-1.5`}>
        <button
          type="button"
          onClick={() => void actions.toggleLayer(layer.id)}
          className="flex-1 min-w-0 flex items-center gap-2 text-left"
          aria-pressed={visible}
          title={layer.description}
        >
          <span
            aria-hidden="true"
            className="shrink-0 w-3 h-3 rounded-full border"
            style={{
              borderColor: layer.style?.color ?? 'var(--color-line-strong)',
              background: visible
                ? (layer.style?.fillColor ?? layer.style?.color ?? 'var(--color-accent)')
                : 'transparent',
            }}
          />
          <span className={`truncate text-[12px] ${visible ? 'text-ink' : 'text-ink-muted'}`}>
            {layer.label}
          </span>
          {loading && <Loader2 className="w-3 h-3 shrink-0 text-accent animate-spin" />}
          {failed && <AlertTriangle className="w-3 h-3 shrink-0 text-critical" />}
          <span className="sr-only">{visible ? '(shown on map)' : '(hidden)'}</span>
        </button>

        <span className={`gov-badge ${GIS_SOURCE_STATE_TONE[state]} shrink-0`}>
          {GIS_SOURCE_STATE_LABEL[state]}
        </span>

        <button
          type="button"
          onClick={() => setShowControls((prev) => !prev)}
          className="gov-btn gov-btn-quiet gov-btn-sm shrink-0 !px-1"
          aria-expanded={showControls}
          title="Layer detail and controls"
        >
          <LayersIcon className="w-3.5 h-3.5" />
          <span className="sr-only">Layer detail</span>
        </button>
      </div>

      {showControls && (
        <div className="gov-inset mt-1 mb-1.5 ml-4 mr-1 p-2 space-y-2">
          <p className="text-[11px] text-ink-muted leading-relaxed">{layer.description}</p>

          {layer.caveat && (
            <p className="text-[11px] text-caution leading-relaxed">{layer.caveat}</p>
          )}

          {runtime?.error && (
            <p className="text-[11px] text-critical leading-relaxed break-words">{runtime.error}</p>
          )}

          {runtime?.truncated && (
            <p className="text-[11px] text-caution leading-relaxed">
              The source capped this response, so the map is showing a subset. Zoom in to see the rest.
            </p>
          )}

          <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            {visible && runtime?.featureCount != null && (
              <>
                <dt className="text-ink-subtle">In view</dt>
                <dd className="gov-mono text-ink">{runtime.featureCount.toLocaleString('en-IN')}</dd>
              </>
            )}
            {!visible && layer.verifiedFeatureCount != null && (
              <>
                <dt className="text-ink-subtle">Verified size</dt>
                <dd className="gov-mono text-ink">
                  {layer.verifiedFeatureCount.toLocaleString('en-IN')}
                </dd>
              </>
            )}
            <dt className="text-ink-subtle">Rendering</dt>
            <dd className="text-ink">{layer.kind === 'vector' ? 'Client features' : 'Server image'}</dd>
          </dl>

          {layer.kind === 'vector' && (
            <label className="block">
              <span className="gov-label">Opacity</span>
              <input
                type="range"
                min={10}
                max={100}
                step={5}
                value={Math.round((runtime?.opacity ?? layer.defaultOpacity) * 100)}
                onChange={(event) => actions.setOpacity(layer.id, Number(event.target.value) / 100)}
                className="gov-range mt-1"
                aria-label={`Opacity for ${layer.label}`}
              />
            </label>
          )}

          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => void actions.zoomToLayer(layer.id)}
              className="gov-btn gov-btn-secondary gov-btn-sm"
            >
              <Crosshair className="w-3.5 h-3.5" />
              Zoom to extent
            </button>
            <button
              type="button"
              onClick={() => void actions.toggleLayer(layer.id)}
              className={`gov-btn gov-btn-sm ${visible ? 'gov-btn-quiet' : 'gov-btn-primary'}`}
            >
              {visible ? 'Hide layer' : 'Display on map'}
            </button>
          </div>
        </div>
      )}
    </li>
  );
};
