import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
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
  Car,
  Users,
  Clock,
  Building2,
  AlertTriangle,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Bookmark,
  Sparkles,
  Grid,
} from 'lucide-react';
import {
  CameraAIService,
  SadakshFrameResponse,
  SadakshEvent,
  SadakshAnalytics,
} from '../../services/ai/cameraAIService';
import { SadakshDiagnosticsPanel } from '../ai/SadakshDiagnosticsPanel';

const ai = CameraAIService.getInstance();

interface WebcamVideoElementProps {
  stream: MediaStream;
  className?: string;
}

const WebcamVideoElement: React.FC<WebcamVideoElementProps> = ({ stream, className }) => {
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  return (
    <video
      ref={videoRef}
      autoPlay
      playsInline
      muted
      className={className || 'w-full h-full object-cover group-hover:scale-105 transition-transform duration-500'}
    />
  );
};

/** Class-specific colors matching Sadaksh draw_utils.py palette */
const CLASS_COLORS: Record<string, string> = {
  person:     '#56A8FF',
  bicycle:    '#FFC83C',
  car:        '#3CFFA0',
  motorcycle: '#FF50C8',
  bus:        '#50C8FF',
  truck:      '#FF8250',
};

// PureSadakshAiCanvas — submits frames to PyTorch AI server or runs Edge AI Vision Engine for real-time bounding boxes
const PureSadakshAiCanvas: React.FC<{
  stream?: MediaStream | null;
  camId: string;
  isWebcam: boolean;
  videoUrl?: string;
  onFrameResult?: (result: SadakshFrameResponse) => void;
}> = ({ stream, camId, isWebcam, videoUrl, onFrameResult }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [modelDetections, setModelDetections] = useState<any[]>([]);
  const [tick, setTick] = useState<number>(0);

  useEffect(() => {
    if (videoRef.current && stream && isWebcam) {
      videoRef.current.srcObject = stream;
    }
  }, [stream, isWebcam]);

  // Periodic AI inference loop — queries PyTorch AI server (http://127.0.0.1:8008)
  useEffect(() => {
    const interval = setInterval(async () => {
      const vid = videoRef.current;
      let frameData: string | null = null;
      if (vid && vid.readyState >= 2) {
        try {
          const capCanvas = document.createElement('canvas');
          capCanvas.width = 320;
          capCanvas.height = 240;
          const capCtx = capCanvas.getContext('2d');
          if (capCtx) {
            capCtx.drawImage(vid, 0, 0, 320, 240);
            frameData = capCanvas.toDataURL('image/jpeg', 0.5);
          }
        } catch {
          // ignore frame capture error
        }
      }

      if (frameData) {
        try {
          const result = await ai.analyzeFrame(camId, frameData);
          if (result && result.status === 'READY') {
            setModelDetections(result.detections || []);
            if (onFrameResult) onFrameResult(result);
          } else {
            setModelDetections([]);
            if (onFrameResult && result) onFrameResult(result);
          }
        } catch {
          setModelDetections([]);
        }
      }
    }, 500);
    return () => clearInterval(interval);
  }, [camId, onFrameResult]);

  // Render live Sadaksh detections: bounding boxes + class labels + trajectory polylines
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const W = canvas.width || 360;
    const H = canvas.height || 240;
    ctx.clearRect(0, 0, W, H);

    if (!modelDetections || modelDetections.length === 0) return;

    modelDetections.forEach((det) => {
      const [xPct, yPct, wPct, hPct] = det.bbox ?? [0, 0, 0, 0];
      const x = (xPct / 100) * W;
      const y = (yPct / 100) * H;
      const w = (wPct / 100) * W;
      const h = (hPct / 100) * H;
      const color = CLASS_COLORS[det.class] ?? '#06B6D4';

      // Bounding box fill + stroke
      ctx.fillStyle = `${color}18`;
      ctx.fillRect(x, y, w, h);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x, y, w, h);

      // Corner accent marks
      const mark = 6;
      ctx.lineWidth = 2.5;
      [[x, y], [x + w, y], [x, y + h], [x + w, y + h]].forEach(([cx, cy], i) => {
        ctx.beginPath();
        ctx.moveTo(cx + (i % 2 === 0 ? mark : -mark), cy);
        ctx.lineTo(cx, cy);
        ctx.lineTo(cx, cy + (i < 2 ? mark : -mark));
        ctx.stroke();
      });

      // Label
      const conf = Math.round((det.confidence ?? 0.95) * 100);
      const spd = det.speed_kmh > 0 ? ` ${det.speed_kmh}km/h` : '';
      const label = `#${det.track_id} ${det.class.toUpperCase()} ${conf}%${spd}`;
      ctx.font = 'bold 8px monospace';
      const tw = ctx.measureText(label).width;
      const lx = x;
      const ly = Math.max(0, y - 14);
      ctx.fillStyle = color;
      ctx.fillRect(lx, ly, tw + 8, 13);
      ctx.fillStyle = '#000';
      ctx.fillText(label, lx + 4, ly + 9);

      // Trajectory polyline
      const traj: Array<[number, number]> = det.trajectory ?? [];
      if (traj.length >= 2) {
        ctx.beginPath();
        traj.forEach(([px, py], i) => {
          const rx = (px / 100) * W;
          const ry = (py / 100) * H;
          if (i === 0) ctx.moveTo(rx, ry);
          else ctx.lineTo(rx, ry);
        });
        ctx.strokeStyle = `${color}90`;
        ctx.lineWidth = 1.5;
        ctx.stroke();
        // Trajectory end dot
        const last = traj[traj.length - 1];
        ctx.beginPath();
        ctx.arc((last[0] / 100) * W, (last[1] / 100) * H, 2.5, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
    });
  }, [modelDetections]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-black">
      {isWebcam && stream ? (
        <video
          ref={videoRef}
          autoPlay playsInline muted
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      ) : (
        <video
          src={videoUrl} autoPlay loop muted playsInline
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
        />
      )}
      <canvas
        ref={canvasRef}
        width={360} height={240}
        className="absolute inset-0 w-full h-full pointer-events-none z-10"
      />
    </div>
  );
};

interface CamerasViewProps {
  incidents?: Incident[];
  landmarks?: LandmarkNode[];
  onSelectCameraOnMap?: (cam: TrafficCameraFeed) => void;
  onJumpToMap?: () => void;
}

export const CamerasView: React.FC<CamerasViewProps> = ({
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

  // Live Sadaksh AI inference state — populated by real model callbacks
  const [liveAnalytics, setLiveAnalytics] = useState<SadakshAnalytics | null>(null);
  const [liveFps, setLiveFps] = useState<number | null>(null);
  const [liveLatency, setLiveLatency] = useState<number | null>(null);
  const [liveEvents, setLiveEvents] = useState<SadakshEvent[]>([]);
  const [inspectorTab, setInspectorTab] = useState<'camera' | 'ai' | 'events'>('ai');

  // Callback fired by PureSadakshAiCanvas each time a real inference frame returns
  const handleFrameResult = useCallback((result: SadakshFrameResponse) => {
    setLiveAnalytics(result.analytics);
    setLiveFps(result.fps);
    setLiveLatency(result.latency);
    if (result.events && result.events.length > 0) {
      setLiveEvents((prev) => {
        const combined = [...result.events, ...prev].slice(0, 20);
        return combined;
      });
    }
  }, []);

  // Laptop Camera State
  const [isWebcamActive, setIsWebcamActive] = useState(false);
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const webcamRef = useRef<HTMLVideoElement | null>(null);

  // Automatically toggle Sadak AI ON whenever cameras view is opened or camera selection changes
  useEffect(() => {
    setShowAiOverlay(true);
  }, [selectedCameraId, fullscreenCam]);

  const enableCamera = async () => {
    try {
      setCameraError(null);
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
      });
      setWebcamStream(stream);
      setIsWebcamActive(true);
      setSelectedCameraId('CAM-LAPTOP-01');
      setShowAiOverlay(true);
    } catch (err: any) {
      console.warn('Laptop camera access error:', err);
      setCameraError('Camera access denied or unavailable. Click "Connect Laptop Cam" to retry.');
    }
  };

  useEffect(() => {
    // Automatically request laptop camera access on mount
    enableCamera();

    return () => {
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  useEffect(() => {
    if (webcamRef.current && webcamStream) {
      webcamRef.current.srcObject = webcamStream;
    }
  }, [webcamStream, isWebcamActive]);

  const toggleWebcam = async () => {
    if (isWebcamActive) {
      if (webcamStream) {
        webcamStream.getTracks().forEach((track) => track.stop());
      }
      setWebcamStream(null);
      setIsWebcamActive(false);
    } else {
      await enableCamera();
    }
  };

  const selectedCamera = useMemo(
    () => cameras.find((c) => c.id === selectedCameraId) || cameras[0],
    [cameras, selectedCameraId]
  );

  const filteredCameras = useMemo(() => {
    const list = cameras.filter((cam) => {
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

    if (isWebcamActive) {
      const laptopCam: TrafficCameraFeed = {
        id: 'CAM-LAPTOP-01',
        name: 'Local Operator Laptop Camera (Live Webcam)',
        road: 'Command Workstation Axis',
        junction: 'Operator Control Desk 1',
        zone: 'Central Command Zone',
        lat: 20.2961,
        lng: 85.8245,
        directionDeg: 0,
        status: 'ONLINE',
        streamUrl: 'webcam',
        fps: 60,
        resolution: '720p HD WebRTC',
        latencyMs: 4,
        recordingAvailable: true,
        aiEnabled: true,
        healthScore: 100,
        installedDate: '2026-08-04',
        owner: 'Local Operator Console',
        aiAnalytics: {
          vehicleCount: 14,
          congestionLevel: 'MODERATE',
          pedestrianCount: 2,
          avgSpeedKmh: 35,
          queueLengthMeters: 10,
          stoppedVehicles: 0,
          confidencePct: 99,
        },
        nearestJunction: 'Operator Desk (0m)',
        nearestPoliceStation: 'Capital PS (500m)',
        nearestHospital: 'Capital Hospital (800m)',
      };
      return [laptopCam, ...list];
    }

    return list;
  }, [cameras, searchQuery, statusFilter, isWebcamActive]);

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

        {/* Dynamic Grid Count & Laptop Camera Controls */}
        <div className="flex items-center space-x-2">
          <button
            onClick={toggleWebcam}
            className={`px-3 py-1 rounded text-[10px] font-bold border transition-all cursor-pointer flex items-center space-x-1.5 ${
              isWebcamActive
                ? 'bg-rose-600 text-white border-rose-400 animate-pulse shadow-[0_0_12px_rgba(244,63,94,0.4)]'
                : 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4] hover:bg-[#06B6D4]/30'
            }`}
          >
            <CameraIcon className="w-3.5 h-3.5" />
            <span>{isWebcamActive ? 'Disconnect Laptop Cam' : 'Connect Laptop Cam'}</span>
          </button>

          <span className="text-white/40 text-[10px] uppercase font-bold ml-2 mr-1">Grid Layout:</span>
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

          {/* Camera Permission Status Banner */}
          {isWebcamActive ? (
            <div className="p-2 rounded bg-[#10B981]/10 border border-[#10B981]/40 text-[#10B981] flex items-center justify-between text-[10px] font-bold">
              <span className="flex items-center space-x-2">
                <span className="w-2 h-2 rounded-full bg-[#10B981] animate-ping" />
                <span>🎥 LOCAL LAPTOP CAMERA CONNECTED — LIVE STREAMING IN SLOT 1 WITH SEMANTIC EDGE 5G AI OVERLAYS</span>
              </span>
              <button onClick={toggleWebcam} className="underline text-white hover:text-[#10B981] cursor-pointer">
                Disconnect
              </button>
            </div>
          ) : (
            <div className="p-2 rounded bg-amber-500/10 border border-amber-500/40 text-amber-400 flex items-center justify-between text-[10px] font-bold">
              <span className="flex items-center space-x-2">
                <CameraIcon className="w-4 h-4 animate-pulse text-amber-400" />
                <span>ALLOW BROWSER CAMERA PERMISSION TO USE YOUR LAPTOP CAMERA IN REAL-TIME</span>
              </span>
              <button
                onClick={toggleWebcam}
                className="px-2.5 py-1 rounded bg-amber-400 text-black font-extrabold uppercase hover:bg-amber-300 transition-all cursor-pointer"
              >
                Grant Camera Access
              </button>
            </div>
          )}

          {/* Dynamic Grid Layout */}
          <div
            className={`flex-1 grid gap-2.5 min-h-0 overflow-y-auto ${
              gridCount === 1
                ? 'grid-cols-1'
                : gridCount <= 4
                ? 'grid-cols-1 sm:grid-cols-2'
                : gridCount <= 9
                ? 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3'
                : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-4'
            }`}
          >
            {visibleGridCameras.map((cam) => {
              const isSelected = cam.id === selectedCameraId;
              return (
                <div
                  key={cam.id}
                  onClick={() => {
                    setSelectedCameraId(cam.id);
                    setShowAiOverlay(true);
                    if (onSelectCameraOnMap) onSelectCameraOnMap(cam);
                  }}
                  className={`relative rounded border overflow-hidden bg-black flex flex-col transition-all group ${
                    isSelected ? 'border-[#06B6D4] shadow-[0_0_16px_rgba(6,182,212,0.25)]' : 'border-white/15'
                  }`}
                >
                  {/* Camera Video Stream Frame with Live Dynamic Frame Detection */}
                  <div className="relative flex-1 min-h-[140px] overflow-hidden bg-black">
                    {showAiOverlay ? (
                      <PureSadakshAiCanvas
                        stream={isWebcamActive ? webcamStream : null}
                        camId={cam.id}
                        isWebcam={isWebcamActive}
                        videoUrl={cam.streamUrl}
                        onFrameResult={cam.id === selectedCameraId ? handleFrameResult : undefined}
                      />
                    ) : isWebcamActive && webcamStream ? (
                      <WebcamVideoElement stream={webcamStream} />
                    ) : (
                      <video
                        src={cam.streamUrl}
                        autoPlay loop muted playsInline
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      />
                    )}

                    <div className="absolute inset-0 border border-cyan-500/20 pointer-events-none p-2 flex flex-col justify-between z-20">
                      <div className="flex justify-between items-start">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-black/80 text-[#06B6D4] border border-[#06B6D4]/40 flex items-center space-x-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping mr-1" />
                          SADAKSH AI | {cam.resolution || '1080p'}
                        </span>
                        {/* Live AI quick counts badge for selected camera */}
                        {cam.id === selectedCameraId && liveAnalytics ? (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-black/80 border flex items-center space-x-1.5"
                            style={{
                              color: CameraAIService.congestionColor(liveAnalytics.congestionLevel),
                              borderColor: `${CameraAIService.congestionColor(liveAnalytics.congestionLevel)}50`,
                            }}
                          >
                            <Car className="w-2.5 h-2.5" />
                            <span>{liveAnalytics.vehicleCount}</span>
                            <Users className="w-2.5 h-2.5 ml-1" />
                            <span>{liveAnalytics.pedestrianCount}</span>
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-black/80 text-emerald-400 border border-emerald-500/40">
                            LIVE STREAM
                          </span>
                        )}
                      </div>

                      <div className="flex justify-between items-end bg-black/75 p-1.5 rounded backdrop-blur border border-white/10">
                        <div>
                          <div className="font-bold text-white text-[10px] truncate">{cam.name}</div>
                          <div className="text-white/50 text-[8px]">{cam.junction}</div>
                        </div>
                        <div className="text-right">
                          {cam.id === selectedCameraId && liveFps !== null ? (
                            <span className="text-amber-400 font-bold text-[9px]">{liveFps} fps</span>
                          ) : (
                            <span className="text-[#06B6D4] font-bold text-[9px]">{cam.status}</span>
                          )}
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

        {/* RIGHT COLUMN: Camera Inspector & Live AI Vision Intelligence (3 cols) */}
        <div className="lg:col-span-3 bg-[#0A0A0A] border border-white/10 rounded-lg flex flex-col min-h-0 overflow-hidden">
          {/* Tab Bar */}
          <div className="flex border-b border-white/10 shrink-0">
            {(['camera', 'ai', 'events'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setInspectorTab(tab)}
                className={`flex-1 py-2 text-[9px] font-bold uppercase tracking-wider transition-all cursor-pointer ${
                  inspectorTab === tab
                    ? 'text-[#06B6D4] bg-[#06B6D4]/10 border-b-2 border-[#06B6D4]'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {tab === 'camera' ? '📷 Camera' : tab === 'ai' ? '🤖 AI Engine' : `⚡ Events${liveEvents.length > 0 ? ` (${liveEvents.length})` : ''}`}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-3 min-h-0">

            {/* CAMERA TAB */}
            {inspectorTab === 'camera' && selectedCamera && (
              <div className="space-y-3">
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

                {/* Live AI Quick Stats */}
                {liveAnalytics && (
                  <div className="p-3 bg-black border border-[#06B6D4]/20 rounded space-y-2 font-mono text-[10px]">
                    <div className="text-[#06B6D4] font-bold uppercase tracking-wider text-[9px] border-b border-white/10 pb-1">
                      Live AI Output — This Frame
                    </div>
                    <div className="grid grid-cols-2 gap-1.5 text-[9px]">
                      <div className="bg-white/5 p-1.5 rounded">
                        <div className="text-white/40">Vehicles</div>
                        <div className="font-bold text-[#06B6D4] text-sm">{liveAnalytics.vehicleCount}</div>
                      </div>
                      <div className="bg-white/5 p-1.5 rounded">
                        <div className="text-white/40">Pedestrians</div>
                        <div className="font-bold text-[#10B981] text-sm">{liveAnalytics.pedestrianCount}</div>
                      </div>
                      <div className="bg-white/5 p-1.5 rounded">
                        <div className="text-white/40">FPS</div>
                        <div className="font-bold text-amber-400 text-sm">{liveFps ?? '—'}</div>
                      </div>
                      <div className="bg-white/5 p-1.5 rounded">
                        <div className="text-white/40">Latency</div>
                        <div className="font-bold text-white text-sm">{liveLatency ? `${liveLatency}ms` : '—'}</div>
                      </div>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-white/40">Congestion:</span>
                      <span
                        className="font-bold px-1.5 py-0.5 rounded"
                        style={{
                          color: CameraAIService.congestionColor(liveAnalytics.congestionLevel),
                          backgroundColor: `${CameraAIService.congestionColor(liveAnalytics.congestionLevel)}20`,
                        }}
                      >
                        {liveAnalytics.congestionLevel}
                      </span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-white/40">Active Tracks:</span>
                      <span className="font-bold text-white">{liveAnalytics.activeTracks ?? liveAnalytics.totalTargets}</span>
                    </div>
                    <div className="flex justify-between text-[9px]">
                      <span className="text-white/40">Flow Rate:</span>
                      <span className="font-bold text-cyan-400">{liveAnalytics.flowRate}/min</span>
                    </div>
                  </div>
                )}

                {/* Playback Controls */}
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

                {/* Nearest Facilities */}
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

            {/* AI ENGINE TAB — Full SadakshDiagnosticsPanel */}
            {inspectorTab === 'ai' && (
              <SadakshDiagnosticsPanel compact />
            )}

            {/* EVENTS TAB — Live AI-detected events */}
            {inspectorTab === 'events' && (
              <div className="space-y-2">
                <div className="text-white/50 text-[9px] font-bold uppercase tracking-wider pb-1 border-b border-white/10">
                  Live AI Event Log — {liveEvents.length} Events
                </div>
                {liveEvents.length === 0 ? (
                  <div className="text-center text-white/20 text-[10px] py-8">
                    No events detected yet.<br />
                    <span className="text-white/10">Connect camera and start inference.</span>
                  </div>
                ) : (
                  liveEvents.map((ev, i) => {
                    const color = CameraAIService.severityColor(ev.severity);
                    return (
                      <div
                        key={i}
                        className="p-2 rounded border text-[9px] font-mono"
                        style={{
                          borderColor: `${color}40`,
                          backgroundColor: `${color}10`,
                        }}
                      >
                        <div className="flex justify-between items-start">
                          <span className="font-bold" style={{ color }}>
                            {ev.type.replace(/_/g, ' ')}
                          </span>
                          <span
                            className="px-1 py-0.5 rounded text-[7px] font-bold"
                            style={{ color, backgroundColor: `${color}25` }}
                          >
                            {ev.severity}
                          </span>
                        </div>
                        <div className="text-white/60 mt-0.5 leading-tight">{ev.message}</div>
                        {ev.camera && (
                          <div className="text-white/30 text-[8px] mt-0.5">📷 {ev.camera}</div>
                        )}
                        {ev.timestamp && (
                          <div className="text-white/20 text-[7px]">
                            {new Date(ev.timestamp).toLocaleTimeString()}
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        </div>
      </div>


      {/* Fullscreen Video Modal with Sadaksh YOLOv8 + ByteTrack Engine */}
      {fullscreenCam && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col p-6 animate-in fade-in select-none">
          <div className="flex justify-between items-center pb-4 border-b border-white/10">
            <div>
              <div className="flex items-center space-x-3">
                <h2 className="text-lg font-bold text-white">{fullscreenCam.name}</h2>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                  FULLSCREEN SADAKSH BYTETRACK LIVE STREAM
                </span>
              </div>
              <p className="text-white/40 text-xs mt-0.5">
                {fullscreenCam.junction} | {fullscreenCam.road} | Lat: {fullscreenCam.lat}, Lng: {fullscreenCam.lng}
              </p>
            </div>
            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowAiOverlay(!showAiOverlay)}
                className={`px-3 py-1.5 rounded text-xs font-bold uppercase border transition-all cursor-pointer ${
                  showAiOverlay ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]' : 'bg-white/5 border-white/10 text-white/50'
                }`}
              >
                {showAiOverlay ? 'AI Overlays ON' : 'AI Overlays OFF'}
              </button>

              <button
                onClick={() => setFullscreenCam(null)}
                className="px-4 py-2 rounded bg-rose-500/20 border border-rose-500/40 text-rose-400 font-bold text-xs uppercase cursor-pointer hover:bg-rose-500/30 transition-all"
              >
                Close Fullscreen
              </button>
            </div>
          </div>

          <div className="flex-1 mt-4 relative overflow-hidden rounded-lg border border-white/20 bg-black flex items-center justify-center">
            {showAiOverlay ? (
              <PureSadakshAiCanvas
                stream={isWebcamActive ? webcamStream : null}
                camId={fullscreenCam.id}
                isWebcam={isWebcamActive}
                videoUrl={fullscreenCam.streamUrl}
                onFrameResult={handleFrameResult}
              />
            ) : isWebcamActive && webcamStream ? (
              <WebcamVideoElement stream={webcamStream} />
            ) : (
              <video src={fullscreenCam.streamUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
            )}

            {/* Sadaksh AI Fullscreen Status Header & Footer Bar */}
            {showAiOverlay && (
              <div className="absolute inset-0 pointer-events-none p-6 z-20 flex flex-col justify-between">
                {/* Header Telemetry Badges */}
                <div className="flex justify-between items-start">
                  <div className="bg-black/85 px-3 py-2 rounded border border-[#06B6D4]/40 text-[#06B6D4] font-bold text-xs shadow-xl backdrop-blur flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>SADAKSH PYTORCH ENGINE | REAL-TIME TELEMETRY</span>
                  </div>
                  <div className="bg-black/90 border border-emerald-500/40 text-emerald-400 px-3.5 py-2 rounded font-mono font-bold text-xs shadow-xl backdrop-blur flex items-center space-x-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span>Sadaksh AI Engine Active</span>
                  </div>
                </div>

                {/* Bottom Telemetry Bar — Live AI data from model */}
                <div className="bg-black/90 p-3.5 rounded-lg backdrop-blur border border-white/15 flex justify-between items-center text-xs shadow-2xl">
                  <div className="flex items-center space-x-4">
                    <span className="text-white font-bold">Cam ID: {fullscreenCam.id}</span>
                    <span className="text-white/40">|</span>
                    {liveAnalytics ? (
                      <>
                        <span className="text-[#06B6D4] font-bold flex items-center space-x-1">
                          <Car className="w-3.5 h-3.5" />
                          <span>{liveAnalytics.vehicleCount} Vehicles</span>
                        </span>
                        <span className="text-[#10B981] font-bold flex items-center space-x-1">
                          <Users className="w-3.5 h-3.5" />
                          <span>{liveAnalytics.pedestrianCount} Pedestrians</span>
                        </span>
                        <span className="font-bold px-2 py-0.5 rounded" style={{
                          color: CameraAIService.congestionColor(liveAnalytics.congestionLevel),
                          backgroundColor: `${CameraAIService.congestionColor(liveAnalytics.congestionLevel)}20`,
                        }}>{liveAnalytics.congestionLevel}</span>
                      </>
                    ) : (
                      <span className="text-[#06B6D4] font-bold">Live PyTorch Inference Stream</span>
                    )}
                  </div>

                  <div className="flex items-center space-x-4 font-mono font-bold">
                    <span className="text-emerald-400">⚡ YOLOv8 + ByteTrack</span>
                    {liveFps !== null && <span className="text-amber-400">{liveFps} FPS · {liveLatency}ms</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
