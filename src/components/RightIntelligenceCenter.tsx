import React, { useState } from 'react';
import { Incident, IntelligenceItem, Severity } from '../types';
import {
  ExternalLink,
  ChevronRight,
  Video,
} from 'lucide-react';

interface RightIntelligenceCenterProps {
  incidents: Incident[];
  intelligenceItems: IntelligenceItem[];
  onSelectIncident: (incident: Incident) => void;
  onOpenArticle: (item: IntelligenceItem) => void;
  onViewAllAlerts: () => void;
}

export const RightIntelligenceCenter: React.FC<RightIntelligenceCenterProps> = ({
  incidents,
  intelligenceItems,
  onSelectIncident,
  onOpenArticle,
  onViewAllAlerts,
}) => {
  const [alertFilter, setAlertFilter] = useState<'ALL' | Severity>('ALL');

  const filteredIncidents = incidents.filter((inc) => {
    if (alertFilter === 'ALL') return true;
    return inc.priority === alertFilter;
  });

  const getSeverityBadge = (priority: Severity) => {
    switch (priority) {
      case 'CRITICAL':
        return 'bg-[#EF4444]/20 text-[#EF4444] border-[#EF4444]/40 font-bold';
      case 'HIGH':
        return 'bg-[#F59E0B]/20 text-[#F59E0B] border-[#F59E0B]/40 font-bold';
      case 'MEDIUM':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40 font-bold';
      default:
        return 'bg-[#10B981]/20 text-[#10B981] border-[#10B981]/40 font-bold';
    }
  };

  return (
    <aside className="w-72 border-l border-white/10 bg-[#0A0A0A] flex flex-col p-4 shrink-0 overflow-hidden select-none">
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        {/* Widget 1: LIVE ALERTS */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
              Live Alerts
            </span>
            <button
              onClick={onViewAllAlerts}
              className="text-[9px] font-mono text-[#06B6D4] hover:underline flex items-center gap-0.5"
            >
              <span>View All ({incidents.length})</span>
              <ChevronRight className="w-3 h-3" />
            </button>
          </div>

          {/* Severity Filter Tabs */}
          <div className="flex items-center gap-1 mb-2 font-mono text-[9px]">
            {(['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'] as const).map((lvl) => (
              <button
                key={lvl}
                onClick={() => setAlertFilter(lvl)}
                className={`px-1.5 py-0.5 rounded transition-all ${
                  alertFilter === lvl
                    ? 'bg-white/10 text-[#06B6D4] border border-white/20 font-bold'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {lvl}
              </button>
            ))}
          </div>

          {/* Alert Cards Container */}
          <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
            {filteredIncidents.slice(0, 4).map((inc) => (
              <div
                key={inc.id}
                onClick={() => onSelectIncident(inc)}
                className={`p-2 rounded border cursor-pointer transition-all space-y-1 ${
                  inc.priority === 'CRITICAL'
                    ? 'border-[#EF4444]/30 bg-[#EF4444]/5'
                    : 'border-white/10 bg-white/[0.02] hover:bg-white/5'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span
                    className={`px-1.5 py-0.5 rounded text-[8px] font-mono border uppercase ${getSeverityBadge(
                      inc.priority
                    )}`}
                  >
                    {inc.priority}
                  </span>
                  <span className="text-[8px] font-mono text-white/40">{inc.timestamp}</span>
                </div>
                <h3 className="text-[11px] font-semibold text-white leading-tight line-clamp-1">
                  {inc.title}
                </h3>
                <p className="text-[10px] text-white/60 line-clamp-2 leading-tight">
                  {inc.description}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 2: INTELLIGENCE FEED */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[9px] font-bold text-white/30 uppercase tracking-widest">
              Live Intelligence
            </span>
            <span className="text-[8px] font-mono text-white/40 bg-white/5 px-1.5 py-0.5 rounded border border-white/10">
              RSS / GOVT
            </span>
          </div>

          <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
            {intelligenceItems.map((item) => (
              <div
                key={item.id}
                onClick={() => onOpenArticle(item)}
                className="p-2 border border-white/10 bg-white/[0.02] hover:border-[#06B6D4]/50 rounded space-y-1 hover:bg-white/5 transition-all cursor-pointer group"
              >
                <div className="flex items-center justify-between text-[9px] font-mono">
                  <span className="text-[#06B6D4] font-bold truncate max-w-[130px] group-hover:text-cyan-300 transition-colors">
                    {item.publisherName}
                  </span>
                  <div className="flex items-center gap-1">
                    <span className="text-[7px] px-1 py-0.2 rounded bg-zinc-800 text-zinc-300 font-mono">
                      {item.classification || 'LIVE'}
                    </span>
                    <span className="text-white/40 text-[8px]">{item.publishedTime}</span>
                  </div>
                </div>

                <h4 className="text-[11px] font-medium text-white leading-tight group-hover:text-[#06B6D4] transition-colors">
                  {item.headline}
                </h4>

                <p className="text-[10px] text-white/70 line-clamp-2 leading-tight">
                  {item.summary}
                </p>

                <div className="flex items-center justify-between pt-1">
                  <span className="text-[8px] font-mono text-white/40 bg-black/40 px-1 py-0.5 rounded">
                    {item.category}
                  </span>
                  <div className="text-[9px] font-mono text-[#06B6D4] group-hover:underline flex items-center gap-1">
                    <span>Read Summary</span>
                    <ExternalLink className="w-2.5 h-2.5" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Widget 3: LIVE MEDIA & NEWS BROADCAST FEEDS */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <Video className="w-3 h-3 text-[#06B6D4] animate-pulse" />
              <span>Live Odisha News Media Feeds</span>
            </span>
            <span className="text-[8px] font-mono text-[#10B981] bg-[#10B981]/10 px-1.5 py-0.5 rounded border border-[#10B981]/30 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-ping" />
              <span>2 LIVE BROADCASTS</span>
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            {/* OTV News Live Stream */}
            <div className="bg-black border border-white/10 rounded overflow-hidden flex flex-col group relative">
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                <iframe
                  src="https://www.youtube.com/embed/cGZASpb4_9M?autoplay=0&mute=1"
                  title="OTV Odisha Live Stream"
                  className="w-full h-full border-0 pointer-events-auto"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-600/90 text-white font-mono text-[8px] font-bold flex items-center gap-1 shadow pointer-events-none">
                  <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                  <span>OTV LIVE</span>
                </div>
              </div>
              <div className="p-1.5 bg-[#050505] text-[9px] font-mono text-white/70 flex justify-between items-center border-t border-white/5">
                <span className="font-bold text-white truncate">OTV NEWS ODISHA</span>
                <a
                  href="https://www.youtube.com/live/cGZASpb4_9M"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#06B6D4] hover:underline font-semibold text-[8px]"
                >
                  OPEN STREAM ↗
                </a>
              </div>
            </div>

            {/* Kanak News Live Stream */}
            <div className="bg-black border border-white/10 rounded overflow-hidden flex flex-col group relative">
              <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
                <iframe
                  src="https://www.youtube.com/embed/QKar1sXiCDU?autoplay=0&mute=1"
                  title="Kanak News Live Stream"
                  className="w-full h-full border-0 pointer-events-auto"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                />
                <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-600/90 text-white font-mono text-[8px] font-bold flex items-center gap-1 shadow pointer-events-none">
                  <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                  <span>KANAK NEWS</span>
                </div>
              </div>
              <div className="p-1.5 bg-[#050505] text-[9px] font-mono text-white/70 flex justify-between items-center border-t border-white/5">
                <span className="font-bold text-white truncate">KANAK NEWS ODISHA</span>
                <a
                  href="https://www.youtube.com/live/QKar1sXiCDU"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[#06B6D4] hover:underline font-semibold text-[8px]"
                >
                  OPEN STREAM ↗
                </a>
              </div>
            </div>
          </div>

          {/* CCTV Smart City Surveillance Section */}
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <Video className="w-3 h-3 text-[#10B981] animate-pulse" />
              <span>BSCL CCTV Traffic Cameras</span>
            </span>
          </div>

          <div className="bg-black border border-white/10 rounded overflow-hidden flex flex-col group relative">
            <div className="relative aspect-video bg-black flex items-center justify-center overflow-hidden">
              <video
                src="https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/SubaruOutbackOnStreetAndDirt.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
              
              <div className="absolute inset-0 pointer-events-none p-2">
                <div className="absolute top-1/3 left-1/4 w-12 h-8 border border-amber-400/80 rounded bg-amber-400/10 flex items-start p-0.5">
                  <span className="bg-amber-400 text-black text-[6px] font-mono font-bold px-0.5 rounded">
                    YOLO#104
                  </span>
                </div>
                <div className="absolute bottom-1/4 right-1/3 w-10 h-7 border border-[#06B6D4]/80 rounded bg-[#06B6D4]/10 flex items-start p-0.5">
                  <span className="bg-[#06B6D4] text-black text-[6px] font-mono font-bold px-0.5 rounded">
                    ANPR
                  </span>
                </div>
              </div>

              <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-red-600/90 text-white font-mono text-[8px] font-bold flex items-center gap-1 shadow">
                <span className="w-1 h-1 rounded-full bg-white animate-ping" />
                <span>CAM-01 JAYADEV VIHAR</span>
              </div>
              <div className="absolute bottom-1.5 right-1.5 bg-black/80 px-1.5 py-0.5 rounded text-[8px] text-[#06B6D4] font-mono border border-white/10">
                YOLOv9 • 60 FPS
              </div>
            </div>
            <div className="p-1.5 bg-[#050505] text-[9px] font-mono text-white/70 flex justify-between items-center border-t border-white/5">
              <span className="font-bold text-white truncate">JAYADEV VIHAR TRAFFIC JUNCTION</span>
              <span className="text-amber-400 font-semibold text-[8px] bg-amber-950/40 px-1 py-0.5 rounded border border-amber-800/40">SIMULATED MEDIA</span>
            </div>
          </div>
        </div>
      </div>
    </aside>
  );
};
