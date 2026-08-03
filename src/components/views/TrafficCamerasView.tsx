import React, { useState, useMemo } from 'react';
import { TrafficCameraFeed, Incident, LandmarkNode } from '../../types';
import { INITIAL_TRAFFIC_CAMERAS } from '../../data/bhubaneswarData';
import {
  Video,
  Search,
  Filter,
  Maximize2,
  Camera as CameraIcon,
  Navigation,
  Activity,
  ShieldAlert,
  Car,
  Users,
  Clock,
  Radio,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Bookmark,
  Layers,
  Sparkles,
  Compass,
  Grid,
} from 'lucide-react';

interface TrafficCamerasViewProps {
  incidents?: Incident[];
  landmarks?: LandmarkNode[];
  onSelectCameraOnMap?: (cam: TrafficCameraFeed) => void;
  onJumpToMap?: () => void;
}

export const TrafficCamerasView: React.FC<TrafficCamerasViewProps> = ({
  incidents = [],
  landmarks = [],
  onSelectCameraOnMap,
  onJumpToMap,
}) => {
  const [cameras, setCameras] = useState<TrafficCameraFeed[]>(INITIAL_TRAFFIC_CAMERAS);
  const [selectedCameraId, setSelectedCameraId] = useState<string>(INITIAL_TRAFFIC_CAMERAS[0].id);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'ONLINE' | 'WARNING' | 'SEVERE'>('ALL');
  const [gridCount, setGridCount] = useState<number>(4);
  const [favorites, setFavorites] = useState<string[]>(['CAM-JV-01', 'CAM-PAT-02']);
  const [isPlayingRecording, setIsPlayingRecording] = useState(false);
  const [playbackTime, setPlaybackTime] = useState('17:45:00');
  const [fullscreenCam, setFullscreenCam] = useState<TrafficCameraFeed | null>(null);
  const [showAiOverlay, setShowAiOverlay] = useState(true);

  const selectedCamera = useMemo(
    () => cameras.find((c) => c.id === selectedCameraId) || cameras[0],
    [cameras, selectedCameraId]
  );

  const filteredCameras = useMemo(() => {
    return cameras.filter((cam) => {
      const matchQuery =
        cam.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cam.road.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cam.junction.toLowerCase().includes(searchQuery.toLowerCase()) ||
        cam.id.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchQuery) return false;
      if (statusFilter === 'ONLINE') return cam.status === 'ONLINE';
      if (statusFilter === 'WARNING') return cam.status === 'WARNING';
      if (statusFilter === 'SEVERE') return cam.aiAnalytics.congestionLevel === 'SEVERE';
      return true;
    });
  }, [cameras, searchQuery, statusFilter]);

  const toggleFavorite = (id: string) => {
    setFavorites((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const visibleGridCameras = filteredCameras.slice(0, gridCount);

  return (
    <div className="flex-1 h-full bg-[#050505] p-4 overflow-hidden font-mono text-xs flex flex-col space-y-4 select-none">
      {/* Top TMC Header Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-3 gap-3 shrink-0">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 text-[#06B6D4]">
            <Video className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-lg font-bold uppercase tracking-wider text-white">
                Bhubaneswar Traffic Management Center (TMC) — Authorized CCTV Feeds
              </h1>
              <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                12 ACTIVE FEEDS ONLINE
              </span>
            </div>
            <p className="text-white/40 text-[11px] mt-0.5">
              Integrated Optical PTZ Cameras, AI Vision Computer Telemetry, & Digital Twin Field-of-View Synchronization
            </p>
          </div>
        </div>

        {/* Dynamic Grid Count Controls */}
        <div className="flex items-center space-x-2">
          <span className="text-white/40 text-[10px] uppercase font-bold mr-1">Grid Layout:</span>
          {[1, 2, 4, 6, 9, 12, 16].map((num) => (
            <button
              key={num}
              onClick={() => setGridCount(num)}
              className={`px-2.5 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer ${
                gridCount === num
                  ? 'bg-[#06B6D4] text-black border-[#06B6D4]'
                  : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
              }`}
            >
              {num} Cam{num > 1 ? 's' : ''}
            </button>
          ))}
        </div>
      </div>

      {/* TMC Main Split-Screen Layout */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0 overflow-hidden">
        {/* LEFT COLUMN: Camera Filters & List (3 cols) */}
        <div className="lg:col-span-3 bg-[#0A0A0A] border border-white/10 rounded-lg p-3 flex flex-col space-y-3 min-h-0">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-white/70 font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <Filter className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Camera Registry</span>
            </span>
            <span className="text-[#06B6D4] font-bold">{filteredCameras.length} Feeds</span>
          </div>

          {/* Search Bar */}
          <div className="flex items-center bg-black border border-white/20 focus-within:border-[#06B6D4] rounded px-2.5 py-1.5 transition-all">
            <Search className="w-3.5 h-3.5 text-white/40 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by ID, Road, Junction..."
              className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full font-mono"
            />
          </div>

          {/* Status Filter Badges */}
          <div className="flex flex-wrap gap-1.5">
            {[
              { id: 'ALL', label: 'All Feeds' },
              { id: 'ONLINE', label: 'Online' },
              { id: 'SEVERE', label: 'Severe Traffic' },
            ].map((f) => (
              <button
                key={f.id}
                onClick={() => setStatusFilter(f.id as any)}
                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase border transition-all cursor-pointer ${
                  statusFilter === f.id
                    ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                    : 'bg-white/5 border-white/10 text-white/40 hover:text-white'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Camera Feeds List */}
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0">
            {filteredCameras.map((cam) => {
              const isSelected = cam.id === selectedCameraId;
              const isFav = favorites.includes(cam.id);
              return (
                <div
                  key={cam.id}
                  onClick={() => {
                    setSelectedCameraId(cam.id);
                    if (onSelectCameraOnMap) onSelectCameraOnMap(cam);
                  }}
                  className={`p-2.5 rounded border transition-all cursor-pointer ${
                    isSelected
                      ? 'bg-[#06B6D4]/10 border-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.15)]'
                      : 'bg-white/[0.02] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-white text-[11px] truncate">{cam.name}</span>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleFavorite(cam.id);
                      }}
                      className="text-amber-400 hover:scale-110 transition-transform cursor-pointer"
                    >
                      <Bookmark className={`w-3.5 h-3.5 ${isFav ? 'fill-amber-400' : 'text-white/20'}`} />
                    </button>
                  </div>

                  <div className="text-white/40 text-[9px] mt-0.5 truncate">{cam.road}</div>

                  <div className="mt-2 flex items-center justify-between text-[9px]">
                    <span className="px-1.5 py-0.5 rounded bg-white/5 border border-white/10 text-white/60 font-bold">
                      {cam.id}
                    </span>

                    <span
                      className={`font-bold px-1.5 py-0.5 rounded ${
                        cam.aiAnalytics.congestionLevel === 'SEVERE'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-[#10B981]/20 text-[#10B981]'
                      }`}
                    >
                      {cam.aiAnalytics.congestionLevel} ({cam.aiAnalytics.avgSpeedKmh} km/h)
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* CENTER COLUMN: Dynamic Video Camera Grid (6 cols) */}
        <div className="lg:col-span-6 bg-[#0A0A0A] border border-white/10 rounded-lg p-3 flex flex-col space-y-3 min-h-0 overflow-hidden">
          <div className="flex items-center justify-between text-[11px] shrink-0">
            <span className="text-white/70 font-bold uppercase tracking-wider flex items-center space-x-1.5">
              <Grid className="w-3.5 h-3.5 text-[#06B6D4]" />
              <span>Live Camera Feeds Grid ({visibleGridCameras.length} Rendered)</span>
            </span>
            <span className="text-white/40 text-[10px]">H.265 / WebRTC Stream</span>
          </div>

          {/* Dynamic Grid Layout */}
          <div
            className={`flex-1 grid gap-2.5 min-h-0 overflow-y-auto ${
              gridCount === 1
                ? 'grid-cols-1'
                : gridCount <= 4
                ? 'grid-cols-2'
                : gridCount <= 9
                ? 'grid-cols-3'
                : 'grid-cols-4'
            }`}
          >
            {visibleGridCameras.map((cam) => {
              const isSelected = cam.id === selectedCameraId;
              return (
                <div
                  key={cam.id}
                  onClick={() => {
                    setSelectedCameraId(cam.id);
                    if (onSelectCameraOnMap) onSelectCameraOnMap(cam);
                  }}
                  className={`relative rounded border overflow-hidden bg-black flex flex-col transition-all group ${
                    isSelected ? 'border-[#06B6D4] shadow-[0_0_16px_rgba(6,182,212,0.25)]' : 'border-white/15'
                  }`}
                >
                  {/* Camera Video Stream Frame */}
                  <div className="relative flex-1 min-h-[140px] overflow-hidden bg-black">
                    <img
                      src={cam.streamUrl}
                      alt={cam.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />

                    {/* AI Computer Vision Bounding Box Overlay */}
                    {showAiOverlay && (
                      <div className="absolute inset-0 pointer-events-none p-2 z-10">
                        {/* Box 1: Car */}
                        <div className="absolute top-[20%] left-[15%] w-[25%] h-[28%] border-2 border-[#06B6D4] bg-[#06B6D4]/10 rounded flex items-start p-1 shadow-[0_0_10px_rgba(6,182,212,0.3)]">
                          <span className="bg-[#06B6D4] text-black font-extrabold text-[8px] px-1 rounded">
                            CAR #14 [98%]
                          </span>
                        </div>
                        {/* Box 2: Truck */}
                        <div className="absolute top-[35%] right-[10%] w-[32%] h-[40%] border-2 border-amber-400 bg-amber-500/10 rounded flex items-start p-1 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                          <span className="bg-amber-400 text-black font-extrabold text-[8px] px-1 rounded">
                            TRUCK #02 [95%]
                          </span>
                        </div>
                        {/* Box 3: Pedestrian */}
                        <div className="absolute bottom-[25%] left-[45%] w-[12%] h-[22%] border-2 border-emerald-400 bg-emerald-500/10 rounded flex items-start p-1 shadow-[0_0_10px_rgba(16,185,129,0.3)]">
                          <span className="bg-emerald-400 text-black font-extrabold text-[7px] px-1 rounded">
                            PED #08 [97%]
                          </span>
                        </div>
                      </div>
                    )}

                    <div className="absolute inset-0 border border-cyan-500/20 pointer-events-none p-2 flex flex-col justify-between z-20">
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-black/80 text-[#06B6D4] border border-[#06B6D4]/40 flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping mr-1" />
                          SADAKSH AI | {cam.status} {cam.resolution}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-black/80 text-amber-400 border border-amber-500/40">
                          {cam.fps} FPS | {cam.latencyMs}ms
                        </span>
                      </div>

                      <div className="flex justify-between items-end bg-black/75 p-1.5 rounded backdrop-blur border border-white/10">
                        <div>
                          <div className="font-bold text-white text-[10px] truncate">{cam.name}</div>
                          <div className="text-white/50 text-[8px]">{cam.junction}</div>
                        </div>

                        <div className="text-right">
                          <span className="text-[#06B6D4] font-bold text-[10px]">
                            🚗 {cam.aiAnalytics.vehicleCount} Vehicles
                          </span>
                          <div className="text-white/40 text-[8px]">
                            {cam.aiAnalytics.avgSpeedKmh} km/h avg
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Card Bottom Quick Actions */}
                  <div className="p-1.5 bg-[#0D0D0D] border-t border-white/10 flex items-center justify-between shrink-0 text-[9px]">
                    <span className="text-white/40 font-mono">{cam.id}</span>

                    <div className="flex items-center space-x-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setFullscreenCam(cam);
                        }}
                        className="px-2 py-0.5 rounded bg-white/5 hover:bg-white/15 text-white/70 hover:text-white cursor-pointer"
                        title="Fullscreen"
                      >
                        <Maximize2 className="w-3 h-3" />
                      </button>

                      {onJumpToMap && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onSelectCameraOnMap) onSelectCameraOnMap(cam);
                            onJumpToMap();
                          }}
                          className="px-2 py-0.5 rounded bg-[#06B6D4]/10 hover:bg-[#06B6D4]/20 text-[#06B6D4] border border-[#06B6D4]/30 font-bold flex items-center space-x-1 cursor-pointer"
                          title="Jump to Digital Twin Camera"
                        >
                          <Navigation className="w-3 h-3" />
                          <span>Map</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* RIGHT COLUMN: Selected Camera Inspector & AI Vision Analytics (3 cols) */}
        <div className="lg:col-span-3 bg-[#0A0A0A] border border-white/10 rounded-lg p-3 flex flex-col space-y-3 min-h-0 overflow-y-auto">
          <div className="text-white/70 font-bold text-[11px] uppercase tracking-wider border-b border-white/10 pb-2 flex items-center space-x-1.5">
            <Activity className="w-3.5 h-3.5 text-[#06B6D4]" />
            <span>Camera Inspector & Vision Telemetry</span>
          </div>

          {selectedCamera && (
            <div className="space-y-3">
              {/* Selected Camera Overview */}
              <div className="p-3 bg-black border border-white/10 rounded space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-white text-xs">{selectedCamera.name}</span>
                  <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/40">
                    {selectedCamera.status}
                  </span>
                </div>
                <div className="text-white/40 text-[10px]">{selectedCamera.road}</div>

                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-white/10 text-[10px]">
                  <div>
                    <span className="text-white/40 block">CAMERA ID</span>
                    <span className="font-bold text-white">{selectedCamera.id}</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">LAT / LNG</span>
                    <span className="font-bold text-[#06B6D4]">
                      {selectedCamera.lat.toFixed(4)}, {selectedCamera.lng.toFixed(4)}
                    </span>
                  </div>
                  <div>
                    <span className="text-white/40 block">DIRECTION</span>
                    <span className="font-bold text-amber-400">{selectedCamera.directionDeg}° SW</span>
                  </div>
                  <div>
                    <span className="text-white/40 block">HEALTH SCORE</span>
                    <span className="font-bold text-[#10B981]">{selectedCamera.healthScore}%</span>
                  </div>
                </div>
              </div>

              {/* AI Vision Analytics Overlays */}
              <div className="p-3 bg-black border border-white/10 rounded space-y-2">
                <div className="flex items-center justify-between border-b border-white/10 pb-2">
                  <div className="text-white/60 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#06B6D4]" />
                    <span>Sadaksh AI Vision Telemetry</span>
                  </div>
                  <button
                    onClick={() => setShowAiOverlay(!showAiOverlay)}
                    className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase border transition-all cursor-pointer ${
                      showAiOverlay
                        ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                        : 'bg-white/5 border-white/10 text-white/40'
                    }`}
                  >
                    {showAiOverlay ? 'AI Overlays ON' : 'AI Overlays OFF'}
                  </button>
                </div>

                {/* Vehicle Classification Breakdown Grid */}
                <div className="grid grid-cols-3 gap-1.5 pt-1 text-[9px]">
                  <div className="bg-white/[0.03] border border-white/5 p-1.5 rounded text-center">
                    <span className="text-white/40 block text-[8px]">CARS</span>
                    <span className="font-bold text-[#06B6D4]">31</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/5 p-1.5 rounded text-center">
                    <span className="text-white/40 block text-[8px]">BUSES</span>
                    <span className="font-bold text-amber-400">3</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/5 p-1.5 rounded text-center">
                    <span className="text-white/40 block text-[8px]">TRUCKS</span>
                    <span className="font-bold text-rose-400">4</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/5 p-1.5 rounded text-center">
                    <span className="text-white/40 block text-[8px]">MOTORS</span>
                    <span className="font-bold text-emerald-400">10</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/5 p-1.5 rounded text-center">
                    <span className="text-white/40 block text-[8px]">PEDS</span>
                    <span className="font-bold text-purple-400">27</span>
                  </div>
                  <div className="bg-white/[0.03] border border-white/5 p-1.5 rounded text-center">
                    <span className="text-white/40 block text-[8px]">CONF</span>
                    <span className="font-bold text-cyan-300">{selectedCamera.aiAnalytics.confidencePct}%</span>
                  </div>
                </div>

                <div className="space-y-1.5 text-[10px] pt-1">
                  <div className="flex justify-between p-1.5 bg-white/[0.02] border border-white/5 rounded">
                    <span className="text-white/40">TOTAL VEHICLES</span>
                    <span className="font-bold text-[#06B6D4]">{selectedCamera.aiAnalytics.vehicleCount} Units</span>
                  </div>

                  <div className="flex justify-between p-1.5 bg-white/[0.02] border border-white/5 rounded">
                    <span className="text-white/40">CONGESTION LEVEL</span>
                    <span
                      className={`font-bold ${
                        selectedCamera.aiAnalytics.congestionLevel === 'SEVERE' ? 'text-rose-400' : 'text-[#10B981]'
                      }`}
                    >
                      {selectedCamera.aiAnalytics.congestionLevel}
                    </span>
                  </div>

                  <div className="flex justify-between p-1.5 bg-white/[0.02] border border-white/5 rounded">
                    <span className="text-white/40">AVERAGE SPEED</span>
                    <span className="font-bold text-amber-400">{selectedCamera.aiAnalytics.avgSpeedKmh} km/h</span>
                  </div>

                  <div className="flex justify-between p-1.5 bg-white/[0.02] border border-white/5 rounded">
                    <span className="text-white/40">QUEUE LENGTH</span>
                    <span className="font-bold text-white">{selectedCamera.aiAnalytics.queueLengthMeters} meters</span>
                  </div>

                  <div className="flex justify-between p-1.5 bg-white/[0.02] border border-white/5 rounded">
                    <span className="text-white/40">PEDESTRIAN COUNT</span>
                    <span className="font-bold text-[#10B981]">{selectedCamera.aiAnalytics.pedestrianCount} People</span>
                  </div>

                  <div className="flex justify-between p-1.5 bg-white/[0.02] border border-white/5 rounded">
                    <span className="text-white/40">VISION CONFIDENCE</span>
                    <span className="font-bold text-[#06B6D4]">{selectedCamera.aiAnalytics.confidencePct}%</span>
                  </div>
                </div>
              </div>

              {/* Camera Playback Controls */}
              <div className="p-3 bg-black border border-white/10 rounded space-y-2">
                <div className="text-white/60 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1.5">
                  <Clock className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Timeline Recording Playback</span>
                </div>

                <div className="flex items-center justify-between bg-white/[0.02] p-2 rounded border border-white/5">
                  <button
                    onClick={() => setIsPlayingRecording(!isPlayingRecording)}
                    className="p-1 rounded bg-[#06B6D4]/10 text-[#06B6D4] border border-[#06B6D4]/30 hover:bg-[#06B6D4]/20 cursor-pointer"
                  >
                    {isPlayingRecording ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                  </button>

                  <span className="font-bold text-white text-xs">{playbackTime} IST</span>

                  <div className="flex items-center space-x-1 text-white/50">
                    <button className="p-1 hover:text-white cursor-pointer"><SkipBack className="w-3.5 h-3.5" /></button>
                    <button className="p-1 hover:text-white cursor-pointer"><SkipForward className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </div>

              {/* Nearest Emergency Facilities */}
              <div className="p-3 bg-black border border-white/10 rounded space-y-2">
                <div className="text-white/60 font-bold text-[10px] uppercase tracking-wider flex items-center space-x-1.5">
                  <Building2 className="w-3.5 h-3.5 text-[#10B981]" />
                  <span>Nearest Emergency Facilities</span>
                </div>

                <div className="space-y-1 text-[9px] text-white/70">
                  <div>🏛 <strong>Junction</strong>: {selectedCamera.nearestJunction}</div>
                  <div>🚨 <strong>Police PS</strong>: {selectedCamera.nearestPoliceStation}</div>
                  <div>🏥 <strong>Hospital</strong>: {selectedCamera.nearestHospital}</div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Fullscreen Video Modal */}
      {fullscreenCam && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-6 animate-in fade-in">
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <div>
              <h2 className="text-lg font-bold text-white">{fullscreenCam.name}</h2>
              <p className="text-white/40 text-xs">{fullscreenCam.junction} | {fullscreenCam.road}</p>
            </div>
            <button
              onClick={() => setFullscreenCam(null)}
              className="px-4 py-2 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold text-xs uppercase cursor-pointer"
            >
              Close Fullscreen
            </button>
          </div>

          <div className="flex-1 mt-4 relative overflow-hidden rounded border border-white/20 bg-black flex items-center justify-center">
            <img src={fullscreenCam.streamUrl} alt={fullscreenCam.name} className="w-full h-full object-cover" />
            <div className="absolute top-4 left-4 bg-black/80 px-3 py-1.5 rounded border border-[#06B6D4]/40 text-[#06B6D4] font-bold text-xs">
              LIVE 4K STREAM | {fullscreenCam.fps} FPS | Latency {fullscreenCam.latencyMs}ms
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
