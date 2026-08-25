import React, { useState, useEffect, useRef } from 'react';
import type { LucideIcon } from 'lucide-react';
import {
  MapLayersState,
  LayerId,
  BasemapStyle,
  CameraNode,
  HospitalNode,
  PoliceNode,
  FireNode,
  UtilityNode,
} from '../types';
import { CentralLayerManager } from '../services/LayerManager';
import {
  GISLayerDef,
  GISLayerRuntime,
  CityGISProvider,
} from '../services/gis/types';
import type { GISMapActions } from './gis/gisMapActions';
import { LegendSwatch } from './gis/GISLegend';
import { MapIntelligencePanel } from './gis/MapIntelligencePanel';
import {
  Car,
  AlertTriangle,
  CloudRain,
  Zap,
  Video,
  Navigation,
  HeartPulse,
  Shield,
  Flame,
  Box,
  Globe,
  Sliders,
  RefreshCw,
  Layers,
  X,
  Check,
  ChevronDown,
} from 'lucide-react';

interface LayerControlToolbarProps {
  layersState: MapLayersState;
  setLayersState: React.Dispatch<React.SetStateAction<MapLayersState>>;
  onOpenCameraModal?: (camera: CameraNode) => void;
  onOpenHospitalModal?: (hospital: HospitalNode) => void;
  onOpenPoliceModal?: (police: PoliceNode) => void;
  onOpenFireModal?: (fire: FireNode) => void;
  onOpenUtilityModal?: (utility: UtilityNode) => void;
  gisPanelOpen?: boolean;
  onToggleGisPanel?: () => void;
  gisLegendVisible?: boolean;
  onToggleGisLegend?: () => void;
  gisProvider?: CityGISProvider;
  gisLayers?: GISLayerDef[];
  gisRuntime?: Record<string, GISLayerRuntime>;
  gisActions?: GISMapActions;
}

interface LayerConfig {
  label: string;
  icon: LucideIcon;
  /** Seeded catalogue metadata — shown in the layer detail panel, not as a live counter. */
  meta: string;
  subtext: string;
}

/** Grouped so operators scan by purpose instead of hunting through 11 tiles. */
const LAYER_GROUPS: { title: string; ids: LayerId[] }[] = [
  { title: 'Situation', ids: ['incidents', 'traffic', 'weather'] },
  { title: 'Emergency services', ids: ['police', 'fire', 'hospitals'] },
  { title: 'Sensors', ids: ['cameras', 'drones'] },
  { title: 'Infrastructure', ids: ['utilities', 'buildings3D'] },
];

const BASEMAPS: { style: BasemapStyle; label: string }[] = [
  { style: 'street', label: 'Street (default)' },
  { style: 'satellite', label: 'Satellite imagery' },
  { style: 'hybrid', label: 'Satellite hybrid' },
  { style: 'terrain', label: 'Terrain' },
  { style: 'dark', label: 'Dark' },
  { style: 'night', label: 'Night (low light)' },
];

const PRESETS: { value: string; label: string }[] = [
  { value: 'EMERGENCY', label: 'Emergency response' },
  { value: 'TRAFFIC', label: 'Traffic command' },
  { value: 'INFRASTRUCTURE', label: 'Grid & utilities' },
  { value: 'ALL', label: 'All layers on' },
  { value: 'CLEAR', label: 'Clear all layers' },
];

export const LayerControlToolbar: React.FC<LayerControlToolbarProps> = ({
  layersState,
  setLayersState,
  gisPanelOpen,
  onToggleGisPanel,
  gisLegendVisible,
  onToggleGisLegend,
  gisProvider,
  gisLayers,
  gisRuntime,
  gisActions,
}) => {
  const layerManager = CentralLayerManager.getInstance();
  const [activeSettingsLayer, setActiveSettingsLayer] = useState<LayerId | null>(null);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});
  const [expanded, setExpanded] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [mapIntelOpen, setMapIntelOpen] = useState(false);
  const legendRef = useRef<HTMLDivElement>(null);
  const mapIntelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (legendRef.current && !legendRef.current.contains(target)) {
        setLegendOpen(false);
      }
      if (mapIntelRef.current && !mapIntelRef.current.contains(target)) {
        if (gisPanelOpen && onToggleGisPanel) {
          onToggleGisPanel();
        } else {
          setMapIntelOpen(false);
        }
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [gisPanelOpen, onToggleGisPanel]);

  useEffect(() => {
    const unsubscribe = layerManager.subscribe((layerId, active, metadata) => {
      if (metadata?.loading) {
        setLoadingMap((prev) => ({ ...prev, [layerId]: true }));
      } else {
        setLoadingMap((prev) => ({ ...prev, [layerId]: false }));
      }
      setLayersState(layerManager.getLayersState());
    });
    return () => unsubscribe();
  }, [layerManager, setLayersState]);

  const handleToggleLayer = (layerId: LayerId) => {
    layerManager.toggleLayer(layerId);
    setLayersState(layerManager.getLayersState());
  };

  const handleSelectBasemap = (style: BasemapStyle) => {
    layerManager.setBasemapStyle(style);
    setLayersState(layerManager.getLayersState());
  };

  const applyPreset = (preset: 'EMERGENCY' | 'TRAFFIC' | 'INFRASTRUCTURE' | 'ALL' | 'CLEAR') => {
    if (preset === 'EMERGENCY') {
      const emergencyState: LayerId[] = ['incidents', 'police', 'fire', 'hospitals', 'drones', 'traffic'];
      (Object.keys(LAYER_CONFIGS) as LayerId[]).forEach((id) => {
        layerManager.setLayerState(id, emergencyState.includes(id));
      });
    } else if (preset === 'TRAFFIC') {
      const trafficState: LayerId[] = ['traffic', 'incidents', 'cameras', 'drones', 'weather'];
      (Object.keys(LAYER_CONFIGS) as LayerId[]).forEach((id) => {
        layerManager.setLayerState(id, trafficState.includes(id));
      });
    } else if (preset === 'INFRASTRUCTURE') {
      const infraState: LayerId[] = ['utilities', 'buildings3D', 'hospitals', 'cameras', 'weather'];
      (Object.keys(LAYER_CONFIGS) as LayerId[]).forEach((id) => {
        layerManager.setLayerState(id, infraState.includes(id));
      });
    } else if (preset === 'ALL') {
      (Object.keys(LAYER_CONFIGS) as LayerId[]).forEach((id) => {
        layerManager.setLayerState(id, true);
      });
    } else if (preset === 'CLEAR') {
      (Object.keys(LAYER_CONFIGS) as LayerId[]).forEach((id) => {
        if (id !== 'satellite') layerManager.setLayerState(id, false);
      });
    }
  };

  const LAYER_CONFIGS: Record<LayerId, LayerConfig> = {
    traffic: {
      label: 'Traffic corridors',
      icon: Car,
      meta: '14 speed sensors',
      subtext: 'Corridor flow, speed radars and congestion heatmaps',
    },
    incidents: {
      label: 'Live incidents',
      icon: AlertTriangle,
      meta: '5 seeded incidents',
      subtext: 'Fire, flood, crash and utility alerts',
    },
    weather: {
      label: 'Weather radar',
      icon: CloudRain,
      meta: 'IMD Doppler',
      subtext: 'Rainfall, lightning and inundation risk',
    },
    utilities: {
      label: 'Utilities grid',
      icon: Zap,
      meta: '132 kV TPCODL',
      subtext: 'Substations, valves and smart meters',
    },
    cameras: {
      label: 'CCTV nodes',
      icon: Video,
      meta: '8 junction cameras',
      subtext: 'Junction CCTV feeds with ANPR counts',
    },
    drones: {
      label: 'UAV patrols',
      icon: Navigation,
      meta: '4 air patrols',
      subtext: 'GARUDA fleet telemetry and thermal imaging',
    },
    hospitals: {
      label: 'Trauma centres',
      icon: HeartPulse,
      meta: '6 apex centres',
      subtext: 'ICU bed availability and casualty routing',
    },
    police: {
      label: 'Police & PCR',
      icon: Shield,
      meta: '8 patrol units',
      subtext: 'Stations, HQ and patrol van routing',
    },
    fire: {
      label: 'Fire services',
      icon: Flame,
      meta: '5 stations',
      subtext: 'Tenders, foam capacity and hydrant network',
    },
    buildings3D: {
      label: 'Building footprints',
      icon: Box,
      meta: 'LOD mesh',
      subtext: 'Building extrusions and terrain relief',
    },
    satellite: {
      label: 'Satellite imagery',
      icon: Globe,
      meta: layersState.basemapStyle ? layersState.basemapStyle : 'street',
      subtext: 'Satellite, street, terrain and night basemaps',
    },
  };

  const toggleableIds = LAYER_GROUPS.flatMap((g) => g.ids);
  const activeCount = toggleableIds.filter((id) => !!layersState[id]).length;
  
  const activeGisLayers = (gisLayers || [])
    .filter((layer) => gisRuntime?.[layer.id]?.visible)
    .sort((a, b) => b.order - a.order);

  const activeGisCount = activeGisLayers.length;

  const settingsConfig = activeSettingsLayer ? LAYER_CONFIGS[activeSettingsLayer] : null;
  const settingsMetadata = activeSettingsLayer
    ? layerManager.getLayerMetadata(activeSettingsLayer)
    : null;

  return (
    <section aria-label="Map layers and basemap" className="bg-[#05070A] border-b border-white/10 select-none">
      {/* --- Toolbar row --- */}
      <div className="flex flex-wrap items-center gap-2.5 sm:gap-3 px-3 py-1.5 min-h-[40px]">
        {/* Box 1: Map Layers button */}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          aria-controls="layer-toggle-panel"
          className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0D131B] hover:bg-[#141C28] border border-cyan-500/30 hover:border-cyan-400/60 text-white text-[11.5px] font-mono font-medium transition-all shadow-sm group cursor-pointer h-8"
        >
          <Layers className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300 transition-colors" aria-hidden="true" />
          <span>Map layers</span>
          <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 text-[10px] font-mono font-bold uppercase tracking-wide">
            {activeCount} OF {toggleableIds.length} ON
          </span>
          <ChevronDown
            className={`w-3 h-3 text-white/50 transition-transform ${expanded ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>

        <div className="hidden sm:block h-4 w-px bg-white/15 mx-0.5" aria-hidden="true" />

        {/* Box 2: Preset selector */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="layer-preset" className="text-[10px] font-mono font-bold text-cyan-400/80 tracking-wider uppercase">
            PRESET
          </label>
          <select
            id="layer-preset"
            defaultValue=""
            onChange={(e) => {
              const val = e.target.value;
              if (val) applyPreset(val as 'EMERGENCY' | 'TRAFFIC' | 'INFRASTRUCTURE' | 'ALL' | 'CLEAR');
              e.target.value = '';
            }}
            className="bg-[#0D131B] hover:bg-[#141C28] border border-cyan-500/30 hover:border-cyan-400/60 text-white text-[11.5px] font-mono rounded-md px-2 py-1 h-8 focus:outline-none transition-all cursor-pointer shadow-sm"
          >
            <option value="">Select…</option>
            {PRESETS.map((p) => (
              <option key={p.value} value={p.value} className="bg-[#0A0D14] text-white">
                {p.label}
              </option>
            ))}
          </select>
        </div>

        {/* Box 3: Basemap selector */}
        <div className="flex items-center gap-1.5">
          <label htmlFor="basemap-style" className="text-[10px] font-mono font-bold text-amber-400/80 tracking-wider uppercase">
            BASEMAP
          </label>
          <select
            id="basemap-style"
            value={layersState.basemapStyle || 'street'}
            onChange={(e) => handleSelectBasemap(e.target.value as BasemapStyle)}
            className="bg-[#0D131B] hover:bg-[#141C28] border border-amber-500/30 hover:border-amber-400/60 text-white text-[11.5px] font-mono rounded-md px-2 py-1 h-8 focus:outline-none transition-all cursor-pointer shadow-sm"
          >
            {BASEMAPS.map((b) => (
              <option key={b.style} value={b.style} className="bg-[#0A0D14] text-white">
                {b.label}
              </option>
            ))}
          </select>
        </div>

        <div className="ml-auto flex items-center gap-2.5">
          {/* Box 4: Map intelligence dropdown button & panel */}
          <div className="relative" ref={mapIntelRef}>
            <button
              type="button"
              onClick={() => {
                if (onToggleGisPanel) {
                  onToggleGisPanel();
                } else {
                  setMapIntelOpen((prev) => !prev);
                }
              }}
              aria-expanded={gisPanelOpen ?? mapIntelOpen}
              title="Toggle Map Intelligence panel"
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0D131B] hover:bg-[#141C28] border border-cyan-500/30 hover:border-cyan-400/60 text-white text-[11.5px] font-mono font-medium transition-all shadow-sm group cursor-pointer h-8"
            >
              <Sliders className="w-3.5 h-3.5 text-cyan-400 group-hover:text-cyan-300 transition-colors" />
              <span>Map intelligence</span>
              <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 font-mono text-[10px] font-bold border border-cyan-500/40">
                {activeGisCount > 0 ? activeGisCount : activeCount}
              </span>
            </button>

            {(gisPanelOpen ?? mapIntelOpen) && gisProvider && gisLayers && (
              <div className="absolute right-0 top-full mt-1.5 z-50 animate-in fade-in duration-150">
                <MapIntelligencePanel
                  provider={gisProvider}
                  layers={gisLayers}
                  runtime={gisRuntime || {}}
                  actions={gisActions!}
                  basemapStyle={layersState.basemapStyle ?? (layersState.satellite ? 'satellite' : 'dark')}
                  onBasemapChange={(style) => setLayersState((prev) => ({ ...prev, basemapStyle: style }))}
                  legendVisible={gisLegendVisible ?? true}
                  onToggleLegend={() => onToggleGisLegend?.()}
                  open={true}
                  onToggleOpen={() => {
                    if (onToggleGisPanel) {
                      onToggleGisPanel();
                    } else {
                      setMapIntelOpen(false);
                    }
                  }}
                />
              </div>
            )}
          </div>

          {/* Box 5: Legends dropdown button & menu */}
          <div className="relative" ref={legendRef}>
            <button
              type="button"
              onClick={() => setLegendOpen((prev) => !prev)}
              aria-expanded={legendOpen}
              title="Toggle Map Legends dropdown"
              className="flex items-center gap-2 px-2.5 py-1 rounded-md bg-[#0D131B] hover:bg-[#141C28] border border-indigo-500/30 hover:border-indigo-400/60 text-white text-[11.5px] font-mono font-bold uppercase transition-all shadow-sm cursor-pointer h-8"
            >
              <span>LEGEND</span>
              <div className="flex items-center gap-1">
                <span className="px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono text-[10px] font-bold border border-indigo-500/40">
                  {activeGisCount > 0 ? activeGisCount : activeCount}
                </span>
                <ChevronDown
                  className={`w-3 h-3 text-white/60 transition-transform ${legendOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </button>

            {legendOpen && (
              <div className="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-lg bg-[#0F172A] border border-[#1E293B] shadow-2xl p-2.5 text-white animate-in fade-in duration-150">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1E293B]">
                  <span className="text-[10px] font-bold tracking-wider text-white/50 uppercase">
                    Active Layers Legend
                  </span>
                  <span className="text-[10px] font-mono text-cyan-400">
                    {activeGisCount > 0 ? activeGisCount : activeCount} Active
                  </span>
                </div>

                <div className="space-y-1 max-h-60 overflow-y-auto gov-scroll-thin pr-1">
                  {activeGisLayers.length > 0 ? (
                    activeGisLayers.map((layer) => (
                      <div
                        key={layer.id}
                        onClick={() => gisActions?.zoomToLayer(layer.id)}
                        className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 cursor-pointer text-[12px] transition-colors"
                      >
                        <LegendSwatch layer={layer} />
                        <span className="truncate text-white/80 font-medium">{layer.label}</span>
                      </div>
                    ))
                  ) : (
                    toggleableIds
                      .filter((id) => !!layersState[id])
                      .map((id) => {
                        const config = LAYER_CONFIGS[id];
                        const Icon = config.icon;
                        return (
                          <div
                            key={id}
                            className="flex items-center gap-2 px-2 py-1 rounded hover:bg-white/5 text-[12px] transition-colors"
                          >
                            <Icon className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                            <span className="truncate text-white/80 font-medium">{config.label}</span>
                          </div>
                        );
                      })
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* --- Grouped layer toggles --- */}
      {expanded && (
        <div
          id="layer-toggle-panel"
          className="px-3 pb-3 pt-2.5 border-t border-line grid gap-x-6 gap-y-3 sm:grid-cols-2 xl:grid-cols-4"
        >
          {LAYER_GROUPS.map((group) => (
            <fieldset key={group.title} className="min-w-0">
              <legend className="gov-label mb-1.5">{group.title}</legend>
              <ul className="flex flex-wrap gap-1.5">
                {group.ids.map((id) => {
                  const config = LAYER_CONFIGS[id];
                  const Icon = config.icon;
                  const active = !!layersState[id];
                  const isLoading = !!loadingMap[id];

                  return (
                    <li key={id} className="flex items-stretch">
                      <button
                        type="button"
                        onClick={() => handleToggleLayer(id)}
                        aria-pressed={active}
                        title={config.subtext}
                        className="gov-chip rounded-r-none"
                      >
                        {isLoading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin text-accent" aria-hidden="true" />
                        ) : active ? (
                          <Check className="w-3.5 h-3.5" aria-hidden="true" />
                        ) : (
                          <Icon className="w-3.5 h-3.5" aria-hidden="true" />
                        )}
                        <span>{config.label}</span>
                        <span className="sr-only">{active ? '(shown)' : '(hidden)'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveSettingsLayer(id)}
                        aria-label={`${config.label} layer details`}
                        title={`${config.label} details and data pipeline`}
                        className="gov-chip rounded-l-none border-l-0 px-1.5"
                      >
                        <Sliders className="w-3.5 h-3.5" aria-hidden="true" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </fieldset>
          ))}
        </div>
      )}

      {/* --- Layer detail / pipeline panel --- */}
      {activeSettingsLayer && settingsConfig && (
        <div
          className="fixed inset-0 z-50 bg-navy/50 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setActiveSettingsLayer(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={`${settingsConfig.label} layer details`}
            onClick={(e) => e.stopPropagation()}
            className="gov-panel shadow-lg max-w-lg w-full"
          >
            <div className="gov-panel-head">
              <div className="flex items-center gap-2 min-w-0">
                <Sliders className="w-4 h-4 text-accent shrink-0" aria-hidden="true" />
                <h3 className="text-[14px] font-semibold text-ink truncate">
                  {settingsConfig.label}
                </h3>
                <span className={`gov-badge ${layersState[activeSettingsLayer] ? 'is-low' : 'is-neutral'}`}>
                  {layersState[activeSettingsLayer] ? 'Shown' : 'Hidden'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveSettingsLayer(null)}
                aria-label="Close layer details"
                className="gov-btn gov-btn-quiet gov-btn-sm"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 space-y-3">
              <p className="text-[13px] text-ink">{settingsConfig.subtext}</p>

              <div className="gov-inset p-3">
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="gov-label">Catalogue metadata</span>
                  <span className="gov-tag is-sample">Seeded</span>
                </div>
                <p className="text-[13px] text-ink font-medium">{settingsConfig.meta}</p>
              </div>

              {settingsMetadata?.algorithms?.length ? (
                <div className="gov-inset p-3">
                  <span className="gov-label">Analysis models applied</span>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {settingsMetadata.algorithms.map((alg) => (
                      <span key={alg} className="gov-badge is-info">
                        {alg}
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-2 gap-2">
                <div className="gov-inset p-3">
                  <span className="gov-label">Stream channel</span>
                  <p className="gov-mono text-[12px] text-ink mt-1 truncate">
                    {settingsMetadata?.wsChannel || '—'}
                  </p>
                </div>
                <div className="gov-inset p-3">
                  <span className="gov-label">Refresh interval</span>
                  <p className="gov-mono text-[12px] text-ink mt-1">
                    {settingsMetadata?.updateIntervalSec != null
                      ? `${settingsMetadata.updateIntervalSec} s`
                      : '—'}
                  </p>
                </div>
              </div>
            </div>

            <div className="px-4 py-3 border-t border-line flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => {
                  handleToggleLayer(activeSettingsLayer);
                  setActiveSettingsLayer(null);
                }}
                className={`gov-btn ${
                  layersState[activeSettingsLayer] ? 'gov-btn-secondary' : 'gov-btn-primary'
                }`}
              >
                {layersState[activeSettingsLayer] ? 'Hide layer' : 'Show layer'}
              </button>
              <button
                type="button"
                onClick={() => setActiveSettingsLayer(null)}
                className="gov-btn gov-btn-quiet"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
