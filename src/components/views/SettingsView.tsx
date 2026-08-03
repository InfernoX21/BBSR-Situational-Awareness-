import React, { useState } from 'react';
import { MapLayersState } from '../../types';
import {
  Settings,
  Shield,
  Key,
  Radio,
  Sliders,
  CheckCircle,
  Database,
  Cpu,
  Layers,
  Sparkles,
} from 'lucide-react';

interface SettingsViewProps {
  layersState: MapLayersState;
  setLayersState: React.Dispatch<React.SetStateAction<MapLayersState>>;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  layersState,
  setLayersState,
}) => {
  const [aiConfidenceThreshold, setAiConfidenceThreshold] = useState<number>(75);
  const [autoFuseInterval, setAutoFuseInterval] = useState<number>(30);

  const toggleLayer = (layerKey: keyof MapLayersState) => {
    setLayersState((prev) => ({
      ...prev,
      [layerKey]: !prev[layerKey],
    }));
  };

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex items-center space-x-2 text-[#06B6D4] border-b border-white/10 pb-4">
        <Settings className="w-5 h-5 animate-spin" />
        <div>
          <h1 className="text-lg font-bold uppercase tracking-wider text-white">
            ARKA OS System Settings & Platform Controls
          </h1>
          <p className="text-white/40 text-[11px] mt-0.5">
            Geospatial Layer Defaults, AI Fusion Model Thresholds & Event Bus Telemetry
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Box 1: AI Fusion Engine Parameters */}
        <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-4">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex items-center space-x-2">
            <Sparkles className="w-4 h-4 text-[#06B6D4]" />
            <span>AI Fusion & Gemini 3.6 Model Config</span>
          </div>

          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-white/70 text-[11px]">
                <span>Bayesian Confidence Threshold</span>
                <span className="font-bold text-[#06B6D4]">{aiConfidenceThreshold}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="95"
                value={aiConfidenceThreshold}
                onChange={(e) => setAiConfidenceThreshold(Number(e.target.value))}
                className="w-full mt-1 accent-[#06B6D4]"
              />
              <div className="text-white/30 text-[9px] mt-0.5">
                Incidents with confidence below threshold are flagged for manual review.
              </div>
            </div>

            <div className="pt-2 border-t border-white/5">
              <div className="flex justify-between text-white/70 text-[11px]">
                <span>Automated Ingestion Refresh Loop</span>
                <span className="font-bold text-[#10B981]">{autoFuseInterval} Seconds</span>
              </div>
              <input
                type="range"
                min="10"
                max="120"
                step="5"
                value={autoFuseInterval}
                onChange={(e) => setAutoFuseInterval(Number(e.target.value))}
                className="w-full mt-1 accent-[#10B981]"
              />
            </div>
          </div>
        </div>

        {/* Box 2: WebSocket & Event Bus Telemetry */}
        <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-4">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex items-center space-x-2">
            <Radio className="w-4 h-4 text-[#10B981]" />
            <span>Event Bus & Kafka Telemetry</span>
          </div>

          <div className="space-y-2 text-[10px]">
            <div className="flex justify-between p-2 bg-white/[0.02] border border-white/5 rounded">
              <span className="text-white/40">WEBSOCKET STATUS</span>
              <span className="font-bold text-[#10B981] flex items-center space-x-1">
                <CheckCircle className="w-3 h-3" />
                <span>CONNECTED (Port 3000)</span>
              </span>
            </div>

            <div className="flex justify-between p-2 bg-white/[0.02] border border-white/5 rounded">
              <span className="text-white/40">LATENCY</span>
              <span className="font-bold text-[#06B6D4]">14 ms</span>
            </div>

            <div className="flex justify-between p-2 bg-white/[0.02] border border-white/5 rounded">
              <span className="text-white/40">INGESTION RATE</span>
              <span className="font-bold text-yellow-400">14.2 msg / sec</span>
            </div>
          </div>
        </div>

        {/* Box 3: Digital Twin Map Layer Defaults */}
        <div className="md:col-span-2 p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-4">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex items-center space-x-2">
            <Layers className="w-4 h-4 text-[#06B6D4]" />
            <span>Default Digital Twin GIS Layers</span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              { key: 'traffic', label: 'Traffic Corridors' },
              { key: 'weather', label: 'Weather Radar' },
              { key: 'drones', label: 'Drone Telemetry' },
              { key: 'buildings3D', label: '3D Buildings' },
              { key: 'utilities', label: 'Power & Water Grid' },
              { key: 'cameras', label: 'CCTV Radar Nodes' },
              { key: 'floodZones', label: 'Flood Inundation' },
              { key: 'heatmaps', label: 'Congestion Heatmap' },
            ].map(({ key, label }) => {
              const active = layersState[key as keyof MapLayersState];
              return (
                <button
                  key={key}
                  onClick={() => toggleLayer(key as keyof MapLayersState)}
                  className={`p-2.5 rounded border text-left text-[10px] font-bold uppercase transition-all flex items-center justify-between ${
                    active
                      ? 'bg-[#06B6D4]/10 border-[#06B6D4] text-[#06B6D4]'
                      : 'bg-white/[0.02] border-white/10 text-white/40 hover:text-white'
                  }`}
                >
                  <span>{label}</span>
                  <span className={`w-2 h-2 rounded-full ${active ? 'bg-[#06B6D4]' : 'bg-white/20'}`} />
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
