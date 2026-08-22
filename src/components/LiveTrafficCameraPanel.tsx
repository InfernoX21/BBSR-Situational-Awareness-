import React, { useState } from 'react';
import { Video, ChevronDown, AlertTriangle } from 'lucide-react';
import { CameraNode } from '../types';
import { MOCK_CAMERAS } from '../data/layerData';

interface LiveTrafficCameraPanelProps {
  className?: string;
  cameras?: CameraNode[];
}

export const LiveTrafficCameraPanel: React.FC<LiveTrafficCameraPanelProps> = ({
  className = '',
  cameras = MOCK_CAMERAS,
}) => {
  const cameraList = cameras && cameras.length > 0 ? cameras : MOCK_CAMERAS;
  const [selectedCamId, setSelectedCamId] = useState<string>(cameraList[0]?.id || 'CAM-BBSR-01');

  const activeCam = cameraList.find((c) => c.id === selectedCamId) || cameraList[0];

  const handleSelectCam = (id: string) => {
    setSelectedCamId(id);
  };

  const sampleVideos = [
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
  ];

  // Map camera index to a sample video URL or use streamUrl if present
  const getCamStreamUrl = (cam: CameraNode) => {
    if (cam.streamUrl) return cam.streamUrl;
    const idx = cameraList.findIndex((c) => c.id === cam.id);
    return sampleVideos[idx % sampleVideos.length];
  };

  return (
    <div className={`border border-white/10 bg-white/[0.02] rounded p-2 flex flex-col justify-between overflow-hidden ${className}`}>
      {/* Header & Camera Selector Bar */}
      <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[9px] font-bold uppercase tracking-widest gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <Video className="w-3 h-3 text-[#10B981] animate-pulse shrink-0" />
          <span className="text-white/90 font-bold truncate">LIVE TRAFFIC CAMERAS</span>
        </div>

        {/* Tactical Camera Dropdown Selector */}
        <div className="relative shrink-0 flex items-center">
          <select
            value={selectedCamId}
            onChange={(e) => handleSelectCam(e.target.value)}
            className="bg-black/90 text-[#10B981] border border-[#10B981]/50 hover:border-[#10B981] rounded px-2 py-0.5 text-[9px] font-mono font-bold cursor-pointer outline-none transition-all shadow-[0_0_10px_rgba(16,185,129,0.25)] appearance-none pr-5 text-right"
          >
            {cameraList.map((cam) => (
              <option key={cam.id} value={cam.id} className="bg-zinc-950 text-zinc-200 py-1">
                {cam.locationName || cam.name}
              </option>
            ))}
          </select>
          <ChevronDown className="w-3 h-3 text-[#10B981] absolute right-1.5 pointer-events-none opacity-80" />
        </div>
      </div>

      {/* Embedded Live Video Player Area */}
      <div className="relative w-full flex-1 rounded overflow-hidden bg-black border border-white/10 mt-1 flex flex-col justify-between min-h-0">
        {activeCam ? (
          <div className="relative w-full h-full bg-black overflow-hidden group">
            <video
              key={activeCam.id}
              src={getCamStreamUrl(activeCam)}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
            />

            {/* Tactical AI Bounding Box Overlay Simulation */}
            <div className="absolute inset-0 pointer-events-none p-2">
              <div className="absolute top-1/3 left-1/4 w-14 h-9 border border-amber-400/80 rounded bg-amber-400/10 flex items-start p-0.5">
                <span className="bg-amber-400 text-black text-[6px] font-mono font-bold px-0.5 rounded">
                  YOLO#104
                </span>
              </div>
              <div className="absolute bottom-1/4 right-1/3 w-12 h-7 border border-[#06B6D4]/80 rounded bg-[#06B6D4]/10 flex items-start p-0.5">
                <span className="bg-[#06B6D4] text-black text-[6px] font-mono font-bold px-0.5 rounded">
                  ANPR
                </span>
              </div>
            </div>

            {/* Tactical Live Cam Badge Overlay */}
            <div className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-red-600/90 text-white font-mono text-[8px] font-bold flex items-center gap-1 shadow pointer-events-none z-10">
              <span className="w-1 h-1 rounded-full bg-white animate-ping" />
              <span>{activeCam.id} · {activeCam.locationName?.toUpperCase()}</span>
            </div>

            {/* Tactical Signal Status & Model Overlay */}
            <div className="absolute top-1 right-1 bg-black/80 px-1.5 py-0.5 rounded text-[7px] text-[#10B981] font-mono border border-white/10 flex items-center gap-1 pointer-events-none z-10">
              <span className="w-1 h-1 rounded-full bg-[#10B981] animate-pulse" />
              <span>{activeCam.model || 'YOLOv9'} · 60 FPS</span>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-black/90 p-3 flex flex-col items-center justify-center text-center space-y-1.5">
            <AlertTriangle className="w-5 h-5 text-amber-400 animate-pulse" />
            <div className="text-[10px] font-bold text-zinc-200 uppercase font-mono">
              TRAFFIC CAMERA STREAM UNAVAILABLE
            </div>
          </div>
        )}

        {/* Bottom Ticker Bar inside Video Panel */}
        <div className="px-2 py-1 bg-[#050505] text-[8px] font-mono text-white/70 flex justify-between items-center border-t border-white/10 shrink-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="font-bold text-[#10B981] truncate">{activeCam?.name || 'BSCL CCTV Node'}</span>
            <span className="text-white/30">|</span>
            <span className="text-white/50 truncate">{activeCam?.clusterGroup?.replace('_', ' ') || 'SMART CITY CCTV'}</span>
          </div>
          <span className="text-amber-400 font-semibold text-[7px] bg-amber-950/40 px-1 py-0.5 rounded border border-amber-800/40 shrink-0 ml-1">
            SIMULATED MEDIA
          </span>
        </div>
      </div>
    </div>
  );
};
