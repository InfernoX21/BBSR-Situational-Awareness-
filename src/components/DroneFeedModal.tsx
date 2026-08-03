import React, { useState } from 'react';
import { DroneUnit } from '../types';
import { X, Video, Battery, Compass, Shield, Eye, Radio, Sparkles } from 'lucide-react';

interface DroneFeedModalProps {
  drone: DroneUnit | null;
  onClose: () => void;
}

export const DroneFeedModal: React.FC<DroneFeedModalProps> = ({ drone, onClose }) => {
  if (!drone) return null;

  const [isIRMode, setIsIRMode] = useState(false);

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200 select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-3.5 border-b border-slate-800 bg-slate-950 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center space-x-3">
            <Video className="w-4 h-4 text-cyan-400 animate-pulse" />
            <span className="text-cyan-400 font-bold">{drone.callsign}</span>
            <span className="text-slate-500">[{drone.targetArea}]</span>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={() => setIsIRMode(!isIRMode)}
              className={`px-2.5 py-1 rounded border text-[10px] transition-all ${
                isIRMode ? 'bg-red-950 text-red-300 border-red-500/60 font-bold shadow-[0_0_10px_#ef4444]' : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              {isIRMode ? 'THERMAL IR ACTIVE' : 'VISIBLE OPTIC'}
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Video Canvas Container with HUD overlay */}
        <div className="relative aspect-video bg-black overflow-hidden flex items-center justify-center">
          {/* Real Live Drone Video Feed */}
          <video
            src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4"
            autoPlay
            loop
            muted
            playsInline
            className={`w-full h-full object-cover transition-all duration-300 ${
              isIRMode ? 'invert hue-rotate-180 contrast-200 brightness-90' : ''
            }`}
          />

          {/* HUD Bounding Boxes & Crosshair overlay */}
          <div className="absolute inset-0 pointer-events-none p-6 flex flex-col justify-between font-mono text-[11px] text-cyan-400">
            {/* HUD Top Bar */}
            <div className="flex justify-between items-start bg-slate-950/60 backdrop-blur-sm p-2 rounded border border-cyan-500/30">
              <div>
                REC ● 4K UHD 60FPS | LAT: {drone.lat.toFixed(4)}° N | LNG: {drone.lng.toFixed(4)}° E
              </div>
              <div className="flex items-center space-x-3 text-emerald-400">
                <span className="flex items-center space-x-1">
                  <Battery className="w-3.5 h-3.5" />
                  <span>BAT {drone.battery}%</span>
                </span>
                <span>ALT {drone.altMeters}m</span>
                <span>SPD {drone.speedKmh} km/h</span>
              </div>
            </div>

            {/* Tactical Crosshair */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-24 h-24 border border-cyan-400/50 rounded-full flex items-center justify-center relative">
                <div className="w-2 h-2 rounded-full bg-cyan-400" />
                <div className="w-full h-[1px] bg-cyan-400/30 absolute" />
                <div className="h-full w-[1px] bg-cyan-400/30 absolute" />
              </div>
            </div>

            {/* Object Detection Box */}
            <div className="absolute top-1/3 left-1/3 w-32 h-20 border-2 border-emerald-400/80 rounded bg-emerald-500/10 p-1">
              <span className="bg-emerald-950 text-emerald-300 text-[9px] px-1 font-bold">
                TARGET DETECTED [VEHICLE #802]
              </span>
            </div>

            {/* HUD Bottom Bar */}
            <div className="flex justify-between items-end bg-slate-950/60 backdrop-blur-sm p-2 rounded border border-cyan-500/30">
              <span>BHUBANESWAR C2 LINK: ENCRYPTED 256-BIT</span>
              <span className="text-emerald-400 font-bold">AI OBJECT TRACKER: ACTIVE</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 border-t border-slate-800 bg-slate-950 flex items-center justify-between font-mono text-xs">
          <div className="flex items-center space-x-2 text-slate-400">
            <Radio className="w-3.5 h-3.5 text-emerald-400" />
            <span>Targeting Sector: {drone.targetArea}</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
          >
            DISCONNECT FEED
          </button>
        </div>
      </div>
    </div>
  );
};
