import React, { useState, useEffect } from 'react';
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
  CheckCircle2,
  RefreshCw,
  Layers,
  Sparkles,
  Info,
  X,
  Eye,
  Activity,
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
}

export const LayerControlToolbar: React.FC<LayerControlToolbarProps> = ({
  layersState,
  setLayersState,
  onOpenCameraModal,
  onOpenHospitalModal,
  onOpenPoliceModal,
  onOpenFireModal,
  onOpenUtilityModal,
}) => {
  const layerManager = CentralLayerManager.getInstance();
  const [activeSettingsLayer, setActiveSettingsLayer] = useState<LayerId | null>(null);
  const [showBasemapDropdown, setShowBasemapDropdown] = useState(false);
  const [loadingMap, setLoadingMap] = useState<Record<string, boolean>>({});

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
    setShowBasemapDropdown(false);
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

  const LAYER_CONFIGS: Record<
    LayerId,
    {
      label: string;
      shortLabel: string;
      icon: React.ReactNode;
      color: string;
      activeGlow: string;
      badgeText: string;
      subtext: string;
    }
  > = {
    traffic: {
      label: 'Traffic Corridors',
      shortLabel: 'TRAFFIC',
      icon: <Car className="w-3.5 h-3.5 text-emerald-400" />,
      color: '#10B981',
      activeGlow: 'shadow-[0_0_12px_rgba(16,185,129,0.35)] border-[#10B981]',
      badgeText: '14 Sensors',
      subtext: 'Flow, Speed Radars & Heatmaps',
    },
    incidents: {
      label: 'Live Incidents',
      shortLabel: 'INCIDENTS',
      icon: <AlertTriangle className="w-3.5 h-3.5 text-red-400" />,
      color: '#EF4444',
      activeGlow: 'shadow-[0_0_12px_rgba(239,68,68,0.35)] border-[#EF4444]',
      badgeText: '5 Active',
      subtext: 'Fire, Flood, Crash & Utility Alerts',
    },
    weather: {
      label: 'Weather Radar',
      shortLabel: 'WEATHER',
      icon: <CloudRain className="w-3.5 h-3.5 text-cyan-400" />,
      color: '#06B6D4',
      activeGlow: 'shadow-[0_0_12px_rgba(6,182,212,0.35)] border-[#06B6D4]',
      badgeText: 'IMD Doppler',
      subtext: 'Rainfall, Lightning & Inundation',
    },
    utilities: {
      label: 'Utilities Grid',
      shortLabel: 'UTILITIES',
      icon: <Zap className="w-3.5 h-3.5 text-yellow-400" />,
      color: '#EAB308',
      activeGlow: 'shadow-[0_0_12px_rgba(234,179,8,0.35)] border-[#EAB308]',
      badgeText: '132kV TPCODL',
      subtext: 'Substations, Valves & Smart Meters',
    },
    cameras: {
      label: 'CCTV Radar',
      shortLabel: 'CAMERAS',
      icon: <Video className="w-3.5 h-3.5 text-indigo-400" />,
      color: '#6366F1',
      activeGlow: 'shadow-[0_0_12px_rgba(99,102,241,0.35)] border-[#6366F1]',
      badgeText: 'YOLOv9 ANPR',
      subtext: '8 CCTV Nodes & Traffic Feeds',
    },
    drones: {
      label: 'UAV Drones',
      shortLabel: 'DRONES',
      icon: <Navigation className="w-3.5 h-3.5 text-teal-400" />,
      color: '#14B8A6',
      activeGlow: 'shadow-[0_0_12px_rgba(20,184,166,0.35)] border-[#14B8A6]',
      badgeText: '4 Air Patrols',
      subtext: 'GARUDA Fleet Telemetry & Thermal',
    },
    hospitals: {
      label: 'Trauma Centers',
      shortLabel: 'HOSPITALS',
      icon: <HeartPulse className="w-3.5 h-3.5 text-rose-400" />,
      color: '#F43F5E',
      activeGlow: 'shadow-[0_0_12px_rgba(244,63,94,0.35)] border-[#F43F5E]',
      badgeText: '6 Apex Centers',
      subtext: 'ICU Beds & Emergency Routing',
    },
    police: {
      label: 'Police PCR',
      shortLabel: 'POLICE',
      icon: <Shield className="w-3.5 h-3.5 text-blue-400" />,
      color: '#3B82F6',
      activeGlow: 'shadow-[0_0_12px_rgba(59,130,246,0.35)] border-[#3B82F6]',
      badgeText: '8 Patrol Units',
      subtext: 'HQ & VICTOR Van Routing',
    },
    fire: {
      label: 'Fire Services',
      shortLabel: 'FIRE',
      icon: <Flame className="w-3.5 h-3.5 text-orange-400" />,
      color: '#F97316',
      activeGlow: 'shadow-[0_0_12px_rgba(249,115,22,0.35)] border-[#F97316]',
      badgeText: '5 Stations',
      subtext: 'Tenders, Foam & Hydrant Network',
    },
    buildings3D: {
      label: '3D Extrusions',
      shortLabel: '3D TILES',
      icon: <Box className="w-3.5 h-3.5 text-amber-300" />,
      color: '#FCD34D',
      activeGlow: 'shadow-[0_0_12px_rgba(252,211,77,0.35)] border-[#FCD34D]',
      badgeText: 'LOD Mesh',
      subtext: '3D Building Extrusions & Terrain',
    },
    satellite: {
      label: 'Satellite Imagery',
      shortLabel: 'BASEMAP',
      icon: <Globe className="w-3.5 h-3.5 text-purple-400" />,
      color: '#A855F7',
      activeGlow: 'shadow-[0_0_12px_rgba(168,85,247,0.35)] border-[#A855F7]',
      badgeText: layersState.basemapStyle ? layersState.basemapStyle.toUpperCase() : 'DARK',
      subtext: 'Satellite, Street & Night Basemaps',
    },
  };

  return (
    <div className="w-full bg-[#080808]/95 backdrop-blur-md border-b border-white/10 px-3 py-2 font-mono text-xs select-none">
      {/* Top Header Bar: Title, Presets & Layer Manager Status */}
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2 pb-1.5 border-b border-white/5">
        <div className="flex items-center space-x-2">
          <Layers className="w-4 h-4 text-[#06B6D4] animate-pulse" />
          <span className="font-bold uppercase tracking-wider text-white text-[11px]">
            GIS Layer Control Console
          </span>
          <span className="px-1.5 py-0.5 rounded bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30 text-[9px] font-bold">
            CENTRAL LAYER MANAGER
          </span>
        </div>

        {/* Operational Presets */}
        <div className="flex items-center space-x-1 overflow-x-auto text-[9px]">
          <span className="text-white/40 uppercase mr-1">Presets:</span>
          <button
            onClick={() => applyPreset('EMERGENCY')}
            className="px-2 py-0.5 rounded bg-red-950/40 text-red-300 border border-red-500/40 hover:bg-red-900/60 font-bold transition-colors"
          >
            🚨 Emergency Response
          </button>
          <button
            onClick={() => applyPreset('TRAFFIC')}
            className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-900/60 font-bold transition-colors"
          >
            🚦 Traffic Command
          </button>
          <button
            onClick={() => applyPreset('INFRASTRUCTURE')}
            className="px-2 py-0.5 rounded bg-yellow-950/40 text-yellow-300 border border-yellow-500/40 hover:bg-yellow-900/60 font-bold transition-colors"
          >
            ⚡ Grid Utilities
          </button>
          <button
            onClick={() => applyPreset('ALL')}
            className="px-2 py-0.5 rounded bg-cyan-950/40 text-cyan-300 border border-cyan-500/40 hover:bg-cyan-900/60 font-bold transition-colors"
          >
            🌐 Enable All
          </button>
          <button
            onClick={() => applyPreset('CLEAR')}
            className="px-2 py-0.5 rounded bg-white/5 text-white/50 border border-white/10 hover:bg-white/10 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* 11 Primary Operational Layer Buttons Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-11 gap-1.5">
        {(Object.keys(LAYER_CONFIGS) as LayerId[]).map((id) => {
          const config = LAYER_CONFIGS[id];
          const active = !!layersState[id];
          const isLoading = !!loadingMap[id];

          return (
            <div key={id} className="relative group">
              <button
                onClick={() => {
                  if (id === 'satellite') {
                    setShowBasemapDropdown(!showBasemapDropdown);
                  } else {
                    handleToggleLayer(id);
                  }
                }}
                className={`w-full p-2 rounded text-left transition-all duration-200 border flex flex-col justify-between min-h-[58px] ${
                  active
                    ? `bg-[#0A0A0A] ${config.activeGlow} text-white`
                    : 'bg-[#050505] border-white/10 text-white/40 hover:border-white/20 hover:text-white/70'
                }`}
              >
                {/* Top Row: Icon + Short Label + Active Indicator */}
                <div className="flex items-center justify-between space-x-1">
                  <div className="flex items-center space-x-1">
                    {isLoading ? (
                      <RefreshCw className="w-3.5 h-3.5 text-[#06B6D4] animate-spin" />
                    ) : (
                      config.icon
                    )}
                    <span className="font-bold text-[10px] tracking-tight truncate">
                      {config.shortLabel}
                    </span>
                  </div>
                  <span
                    className={`w-2 h-2 rounded-full transition-all ${
                      active
                        ? 'animate-ping'
                        : 'bg-white/10'
                    }`}
                    style={{ backgroundColor: active ? config.color : undefined }}
                  />
                </div>

                {/* Bottom Row: Badge / Counter + Gear */}
                <div className="flex items-center justify-between text-[8px] mt-1 pt-1 border-t border-white/5">
                  <span className={`px-1 py-0.5 rounded font-mono ${active ? 'bg-white/10 text-white font-bold' : 'text-white/30'}`}>
                    {config.badgeText}
                  </span>

                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      setActiveSettingsLayer(id);
                    }}
                    className="p-1 rounded hover:bg-white/10 text-white/40 hover:text-[#06B6D4] transition-colors"
                    title={`Configure ${config.label} settings`}
                  >
                    <Sliders className="w-2.5 h-2.5" />
                  </div>
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {/* Basemap Selection Popup Dropdown */}
      {showBasemapDropdown && (
        <div className="absolute top-24 right-4 z-50 bg-[#0A0A0A] border border-[#06B6D4]/50 rounded-lg p-3 shadow-2xl w-64 space-y-2 text-xs font-mono">
          <div className="flex items-center justify-between border-b border-white/10 pb-2">
            <span className="font-bold text-white uppercase flex items-center space-x-1.5">
              <Globe className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Basemap Engine Selector</span>
            </span>
            <button onClick={() => setShowBasemapDropdown(false)} className="text-white/40 hover:text-white">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-1.5 text-[10px]">
            {[
              { style: 'dark' as BasemapStyle, label: 'Dark Matter (Carto)' },
              { style: 'satellite' as BasemapStyle, label: 'ArcGIS Satellite' },
              { style: 'street' as BasemapStyle, label: 'Voyager Street' },
              { style: 'terrain' as BasemapStyle, label: 'World Terrain' },
              { style: 'night' as BasemapStyle, label: 'Neon Night Mode' },
              { style: 'hybrid' as BasemapStyle, label: 'Satellite Hybrid' },
            ].map((b) => (
              <button
                key={b.style}
                onClick={() => handleSelectBasemap(b.style)}
                className={`p-2 rounded border text-left transition-all ${
                  layersState.basemapStyle === b.style || (b.style === 'satellite' && layersState.satellite)
                    ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4] font-bold'
                    : 'bg-white/[0.02] border-white/10 text-white/50 hover:bg-white/5 hover:text-white'
                }`}
              >
                {b.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Layer Config / Drawer Settings Modal */}
      {activeSettingsLayer && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0A0A0A] border border-white/20 rounded-lg max-w-lg w-full p-4 font-mono text-xs space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center space-x-2">
                <Sliders className="w-4 h-4 text-[#06B6D4]" />
                <span className="font-bold text-white uppercase">
                  {LAYER_CONFIGS[activeSettingsLayer].label} Config & AI Pipeline
                </span>
              </div>
              <button onClick={() => setActiveSettingsLayer(null)} className="text-white/40 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded space-y-1">
                <div className="text-white/40 text-[10px]">DESCRIPTION</div>
                <div className="text-white font-bold">{LAYER_CONFIGS[activeSettingsLayer].subtext}</div>
              </div>

              <div className="p-2.5 bg-white/[0.02] border border-white/5 rounded space-y-1.5">
                <div className="text-white/40 text-[10px] font-bold uppercase">Active Machine Learning Models</div>
                <div className="flex flex-wrap gap-1.5">
                  {layerManager.getLayerMetadata(activeSettingsLayer)?.algorithms.map((alg) => (
                    <span
                      key={alg}
                      className="px-2 py-0.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] text-[10px] font-bold"
                    >
                      ⚡ {alg}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div className="p-2 bg-white/[0.02] border border-white/5 rounded">
                  <div className="text-white/40">WEBSOCKET CHANNEL</div>
                  <div className="text-[#10B981] font-bold truncate">
                    {layerManager.getLayerMetadata(activeSettingsLayer)?.wsChannel}
                  </div>
                </div>
                <div className="p-2 bg-white/[0.02] border border-white/5 rounded">
                  <div className="text-white/40">TELEMETRY REFRESH</div>
                  <div className="text-yellow-400 font-bold">
                    {layerManager.getLayerMetadata(activeSettingsLayer)?.updateIntervalSec}s Loop
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-white/10 flex justify-between items-center">
                <button
                  onClick={() => {
                    handleToggleLayer(activeSettingsLayer);
                    setActiveSettingsLayer(null);
                  }}
                  className={`px-4 py-2 rounded font-bold uppercase transition-colors ${
                    layersState[activeSettingsLayer]
                      ? 'bg-red-500/20 text-red-400 border border-red-500/40 hover:bg-red-500/30'
                      : 'bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40 hover:bg-[#06B6D4]/30'
                  }`}
                >
                  {layersState[activeSettingsLayer] ? 'Disable Layer' : 'Enable Layer'}
                </button>

                <button
                  onClick={() => setActiveSettingsLayer(null)}
                  className="px-4 py-2 rounded bg-white/10 hover:bg-white/20 text-white font-bold"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
