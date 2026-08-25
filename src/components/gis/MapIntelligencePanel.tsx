/**
 * Map intelligence panel.
 *
 * The single collapsible shell for ARKA's base GIS tier: themes, base maps,
 * boundaries, ward intelligence and spatial query, behind one compact toolbar.
 * It sits over the map rather than beside it, and collapses to a single button,
 * because the map is the primary surface and this is an instrument on it.
 *
 * Two design rules are load-bearing rather than cosmetic:
 *
 *  - the base-map picker writes the same `layersState.basemapStyle` the existing
 *    ARKA layer toolbar already owns. There is one basemap setting in the app,
 *    not a GIS copy of it that can drift;
 *  - base GIS layers are labelled as such throughout. ARKA's live telemetry and
 *    its derived intelligence are separate tiers with separate controls, and
 *    nothing in this panel is allowed to imply otherwise.
 */

import React, { useState } from 'react';
import {
  Building2,
  ChevronDown,
  Layers,
  List,
  Map as MapIcon,
  Search,
  Shapes,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import type { BasemapStyle } from '../../types';
import type {
  CityGISProvider,
  GISCategory,
  GISLayerDef,
  GISLayerRuntime,
} from '../../services/gis/types';
import type { GISMapActions } from './gisMapActions';
import { GISLayerTree } from './GISLayerTree';
import { GISWardPanel } from './GISWardPanel';
import { GISQueryPanel } from './GISQueryPanel';
import { useWardDirectory } from './useWardDirectory';

type PanelTab = 'themes' | 'basemaps' | 'boundaries' | 'ward' | 'query';

const TABS: { id: PanelTab; label: string; icon: typeof Layers; title: string }[] = [
  { id: 'themes', label: 'Layers', icon: Layers, title: 'Thematic GIS layers' },
  { id: 'basemaps', label: 'Base maps', icon: MapIcon, title: 'Base map style' },
  { id: 'boundaries', label: 'Boundaries', icon: Shapes, title: 'Administrative and statutory boundaries' },
  { id: 'ward', label: 'Ward', icon: Building2, title: 'Ward intelligence' },
  { id: 'query', label: 'Query', icon: Search, title: 'Spatial query engine' },
];

/** Boundary themes, which get their own tab so they are never buried in the list. */
const BOUNDARY_CATEGORIES: GISCategory[] = ['admin-boundaries', 'statutory-boundaries'];

/**
 * Base map choices, mapped onto ARKA's existing `BasemapStyle` union.
 *
 * The four the GIS brief asks for — imagery, streets, topographic and a light
 * tactical view — plus the ARKA modes that already existed. Nothing is added to
 * the union here; this is a presentation of what the app already supports.
 */
const BASEMAPS: { id: BasemapStyle; label: string; hint: string }[] = [
  { id: 'dark', label: 'Tactical', hint: 'ARKA dark command view' },
  { id: 'satellite', label: 'Satellite', hint: 'Esri World Imagery' },
  { id: 'hybrid', label: 'Hybrid', hint: 'Imagery with labels' },
  { id: 'street', label: 'Streets', hint: 'Carto Voyager' },
  { id: 'terrain', label: 'Topographic', hint: 'Esri World Terrain' },
  { id: 'night', label: 'Night', hint: 'Low-light dark view' },
];

interface MapIntelligencePanelProps {
  provider: CityGISProvider;
  layers: GISLayerDef[];
  runtime: Record<string, GISLayerRuntime>;
  actions: GISMapActions;
  basemapStyle: BasemapStyle;
  onBasemapChange: (style: BasemapStyle) => void;
  legendVisible: boolean;
  onToggleLegend: () => void;
  open: boolean;
  onToggleOpen: () => void;
}

export const MapIntelligencePanel: React.FC<MapIntelligencePanelProps> = ({
  provider,
  layers,
  runtime,
  actions,
  basemapStyle,
  onBasemapChange,
  legendVisible,
  onToggleLegend,
  open,
  onToggleOpen,
}) => {
  const [tab, setTab] = useState<PanelTab>('themes');
  const [requestedWard, setRequestedWard] = useState<string | null>(null);

  // Wards load on first open, shared by the ward module and the query engine.
  const directory = useWardDirectory(provider, open);

  const activeCount = layers.filter((layer) => runtime[layer.id]?.visible).length;

  if (!open) {
    return (
      <button
        type="button"
        onClick={onToggleOpen}
        className="gov-map-btn-solo"
        title={`${provider.cityName} GIS — map intelligence`}
      >
        <SlidersHorizontal className="w-4 h-4" />
        <span className="hidden sm:inline">Map intelligence</span>
        {activeCount > 0 && <span className="gov-badge is-info">{activeCount}</span>}
      </button>
    );
  }

  return (
    <div className="gov-panel w-[322px] max-w-[calc(100vw-2rem)] flex flex-col max-h-[74vh] shadow-lg">
      <div className="gov-panel-head">
        <div className="min-w-0 flex-1">
          <span className="gov-title block">Map intelligence</span>
          <span className="gov-label block truncate">
            {provider.cityName} base GIS · {layers.length} layers
          </span>
        </div>
        {activeCount > 0 && <span className="gov-badge is-info shrink-0">{activeCount} on</span>}
        <button
          type="button"
          onClick={onToggleOpen}
          aria-label="Collapse map intelligence panel"
          className="shrink-0 text-ink-subtle hover:text-ink"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Compact toolbar. */}
      <div className="border-b border-line px-2 py-1.5 space-y-1.5">
        <div className="gov-map-group is-row flex-wrap" role="tablist" aria-label="Map intelligence tools">
          {TABS.map((entry) => {
            const Icon = entry.icon;
            return (
              <button
                key={entry.id}
                type="button"
                role="tab"
                aria-selected={tab === entry.id}
                title={entry.title}
                onClick={() => setTab(entry.id)}
                className={`gov-map-btn ${tab === entry.id ? 'is-active' : ''}`}
              >
                <Icon className="w-3.5 h-3.5" />
                {entry.label}
              </button>
            );
          })}
          <button
            type="button"
            aria-pressed={legendVisible}
            title="Show or hide the map legend"
            onClick={onToggleLegend}
            className={`gov-map-btn ${legendVisible ? 'is-active' : ''}`}
          >
            <List className="w-3.5 h-3.5" />
            Legend
          </button>
        </div>

        {activeCount > 0 && (
          <button
            type="button"
            onClick={() => actions.hideAll()}
            className="gov-btn gov-btn-quiet gov-btn-sm w-full"
          >
            <X className="w-3.5 h-3.5" />
            Clear all base GIS layers
          </button>
        )}
      </div>

      {/* Tab content. */}
      <div className="flex-1 min-h-0 flex flex-col">
        {tab === 'themes' && (
          <GISLayerTree
            layers={layers}
            runtime={runtime}
            actions={actions}
            excludeCategories={BOUNDARY_CATEGORIES}
          />
        )}

        {tab === 'boundaries' && (
          <GISLayerTree
            layers={layers}
            runtime={runtime}
            actions={actions}
            categories={BOUNDARY_CATEGORIES}
            initiallyExpanded={BOUNDARY_CATEGORIES}
          />
        )}

        {tab === 'basemaps' && (
          <div className="gov-scroll-thin overflow-y-auto min-h-0 p-3 space-y-2">
            <p className="gov-label">Base map</p>
            <div className="grid grid-cols-2 gap-1.5">
              {BASEMAPS.map((entry) => (
                <button
                  key={entry.id}
                  type="button"
                  aria-pressed={basemapStyle === entry.id}
                  onClick={() => onBasemapChange(entry.id)}
                  className={`gov-chip flex-col items-start text-left ${
                    basemapStyle === entry.id ? 'is-active' : ''
                  }`}
                >
                  <span className="text-[12px]">{entry.label}</span>
                  <span className="text-[10px] text-ink-subtle">{entry.hint}</span>
                </button>
              ))}
            </div>
            <p className="text-[10px] text-ink-subtle leading-relaxed">
              The base map is the backdrop only. City GIS layers, ARKA live telemetry and derived
              intelligence draw above it and are controlled separately.
            </p>
          </div>
        )}

        {tab === 'ward' && (
          <GISWardPanel
            provider={provider}
            actions={actions}
            directory={directory}
            requestedWard={requestedWard}
            onRequestHandled={() => setRequestedWard(null)}
          />
        )}

        {tab === 'query' && (
          <GISQueryPanel
            provider={provider}
            actions={actions}
            directory={directory}
            onOpenWard={(wardNo) => {
              setRequestedWard(wardNo);
              setTab('ward');
            }}
          />
        )}
      </div>

      <div className="border-t border-line px-2.5 py-1.5 space-y-0.5">
        <p className="text-[10px] text-ink-subtle leading-relaxed">{provider.attribution}</p>
        <a
          href={provider.portalUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[10px] text-accent hover:text-accent-hover inline-flex items-center gap-1"
        >
          Source portal
          <ChevronDown className="w-3 h-3 -rotate-90" />
        </a>
      </div>
    </div>
  );
};
