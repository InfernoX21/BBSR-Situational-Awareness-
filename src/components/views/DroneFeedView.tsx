import React, { useState } from 'react';
import { DroneUnit } from '../../types';
import {
  Video,
  Battery,
  Navigation,
  Eye,
  Sliders,
  ShieldAlert,
  Play,
  Maximize2,
  Crosshair,
  Compass,
  Radio,
} from 'lucide-react';

interface DroneFeedViewProps {
  drones: DroneUnit[];
  onSelectDrone: (drone: DroneUnit) => void;
  onJumpToMap?: () => void;
}

export const DroneFeedView: React.FC<DroneFeedViewProps> = ({
  drones,
  onSelectDrone,
  onJumpToMap,
}) => {
  const [activeDroneId, setActiveDroneId] = useState<string>(drones[0]?.id || 'DRONE-01');
  const [thermalMode, setThermalMode] = useState<boolean>(false);
  const [nightVisionMode, setNightVisionMode] = useState<boolean>(false);

  const selectedDrone = drones.find((d) => d.id === activeDroneId) || drones[0];

  const getStatusBadge = (status: DroneUnit['status']) => {
    switch (status) {
      case 'DISPATCHED':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#EF4444] text-white animate-pulse">DISPATCHED</span>;
      case 'PATROLLING':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/40">PATROLLING</span>;
      case 'HOVERING':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B] text-black">HOVERING</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/60">CHARGING</span>;
    }
  };

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#06B6D4]">
            <Video className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Autonomous UAV Reconnaissance & Drone Grid
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            ORB-SLAM Visual Odometry, Real-Time H.264 Video Telemetry & Aerial Mission Control
          </p>
        </div>

        {onJumpToMap && (
          <button
            onClick={onJumpToMap}
            className="px-3 py-1.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase flex items-center space-x-2 transition-all"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Map Drone Trajectories</span>
          </button>
        )}
      </div>

      {/* Main Grid: Video Stream HUD + Fleet List */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Main Active Video Feed Viewport */}
        <div className="lg:col-span-2 p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-4">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div className="flex items-center space-x-2">
              <Crosshair className="w-4 h-4 text-[#06B6D4] animate-spin" />
              <span className="font-bold text-white text-xs uppercase">{selectedDrone.callsign} - RECON STREAM</span>
            </div>
            {getStatusBadge(selectedDrone.status)}
          </div>

          {/* Video Canvas Container */}
          <div className="relative w-full aspect-video bg-black rounded border border-white/10 overflow-hidden group">
            {/* Live Drone Surveillance Video Stream */}
            <video
              src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4"
              autoPlay
              loop
              muted
              playsInline
              className={`absolute inset-0 w-full h-full object-cover transition-all duration-300 ${
                thermalMode
                  ? 'invert hue-rotate-180 contrast-200 brightness-90'
                  : nightVisionMode
                  ? 'hue-rotate-90 saturate-200 contrast-200 brightness-110 sepia-[.8]'
                  : ''
              }`}
            />

            {/* HUD Overlay Container */}
            <div className="relative z-10 w-full h-full flex flex-col justify-between p-4 pointer-events-none">
              {/* HUD Top Bar Overlay */}
              <div className="flex items-center justify-between text-[10px] font-mono bg-black/80 p-2 rounded backdrop-blur-md border border-white/10">
                <div className="flex items-center space-x-3">
                  <span className="text-[#06B6D4] font-bold">RECON CAM-01 [1080p 60FPS]</span>
                  <span>ALT: <strong>{selectedDrone.altMeters}m</strong></span>
                  <span>SPEED: <strong>{selectedDrone.speedKmh} km/h</strong></span>
                </div>

                <div className="flex items-center space-x-3">
                  <span className="text-emerald-400 flex items-center space-x-1">
                    <Battery className="w-3.5 h-3.5" />
                    <span>{selectedDrone.battery}%</span>
                  </span>
                  <span className="text-rose-400 font-bold animate-pulse">● RTSP LIVE STREAM</span>
                </div>
              </div>

              {/* HUD Center Crosshairs & Target Bounding Box */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-32 h-32 border border-white/30 rounded-full flex items-center justify-center relative">
                  <div className="w-2 h-2 bg-[#06B6D4] rounded-full animate-ping" />
                  <div className="absolute top-0 w-0.5 h-4 bg-white/40" />
                  <div className="absolute bottom-0 w-0.5 h-4 bg-white/40" />
                  <div className="absolute left-0 h-0.5 w-4 bg-white/40" />
                  <div className="absolute right-0 h-0.5 w-4 bg-white/40" />
                </div>

                {/* AI Target Box */}
                <div className="absolute top-1/4 right-1/3 w-28 h-16 border-2 border-emerald-400/90 rounded bg-emerald-500/10 p-1 flex flex-col justify-between">
                  <span className="bg-emerald-950 text-emerald-300 text-[8px] font-mono font-bold px-1 rounded">
                    YOLOv9 TARGET LOCK
                  </span>
                  <span className="text-emerald-400 text-[7px] font-mono font-bold">
                    CONF: 99.4%
                  </span>
                </div>
              </div>

              {/* HUD Bottom Telemetry Overlay */}
              <div className="flex items-center justify-between text-[9px] font-mono bg-black/80 p-2 rounded backdrop-blur-md border border-white/10">
                <span>TARGET ZONE: <strong className="text-white">{selectedDrone.targetArea}</strong></span>
                <span>GPS COORD: {selectedDrone.lat.toFixed(4)}°N, {selectedDrone.lng.toFixed(4)}°E</span>
                <span>TELEMETRY LINK: <strong className="text-emerald-400">99.8% (5.8 GHz)</strong></span>
              </div>
            </div>

            {/* Floating Camera Mode Toggles */}
            <div className="absolute top-16 right-4 flex flex-col space-y-2">
              <button
                onClick={() => {
                  setThermalMode(!thermalMode);
                  if (!thermalMode) setNightVisionMode(false);
                }}
                className={`p-2 rounded border text-[10px] font-bold uppercase transition-all shadow-xl ${
                  thermalMode
                    ? 'bg-rose-600 text-white border-rose-400'
                    : 'bg-black/80 text-white/70 border-white/20 hover:text-white'
                }`}
              >
                FLIR Thermal
              </button>

              <button
                onClick={() => {
                  setNightVisionMode(!nightVisionMode);
                  if (!nightVisionMode) setThermalMode(false);
                }}
                className={`p-2 rounded border text-[10px] font-bold uppercase transition-all shadow-xl ${
                  nightVisionMode
                    ? 'bg-emerald-600 text-white border-emerald-400'
                    : 'bg-black/80 text-white/70 border-white/20 hover:text-white'
                }`}
              >
                Night Vision
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Fleet Roster Selection */}
        <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex items-center justify-between">
            <span>UAV Recon Roster ({drones.length})</span>
            <Radio className="w-4 h-4 text-[#06B6D4]" />
          </div>

          <div className="space-y-2">
            {drones.map((d) => {
              const isSelected = d.id === activeDroneId;
              return (
                <div
                  key={d.id}
                  onClick={() => {
                    setActiveDroneId(d.id);
                    onSelectDrone(d);
                  }}
                  className={`p-3 rounded border transition-all cursor-pointer space-y-2 ${
                    isSelected
                      ? 'bg-white/10 border-[#06B6D4]'
                      : 'bg-white/[0.02] border-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-bold text-white">{d.callsign}</span>
                    {getStatusBadge(d.status)}
                  </div>

                  <div className="text-[#06B6D4] text-[10px]">{d.targetArea}</div>

                  <div className="flex justify-between text-[9px] text-white/40 pt-1 border-t border-white/5">
                    <span>ALT: {d.altMeters}m</span>
                    <span>SPEED: {d.speedKmh} km/h</span>
                    <span>BATT: {d.battery}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
