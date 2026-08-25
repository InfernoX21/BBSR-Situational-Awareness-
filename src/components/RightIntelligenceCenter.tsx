import React, { useState } from 'react';
import { Incident, IntelligenceItem, ResourceUnit, Severity } from '../types';
import {
  ExternalLink,
  ChevronRight,
  Radio,
} from 'lucide-react';

interface RightIntelligenceCenterProps {
  incidents: Incident[];
  intelligenceItems: IntelligenceItem[];
  resources?: ResourceUnit[];
  onSelectIncident: (incident: Incident) => void;
  onOpenArticle: (item: IntelligenceItem) => void;
  onViewAllAlerts: () => void;
}

export const RightIntelligenceCenter: React.FC<RightIntelligenceCenterProps> = ({
  incidents,
  intelligenceItems,
  resources = [],
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
    <aside className="hidden lg:flex w-64 xl:w-72 2xl:w-80 border-l border-white/10 bg-[#0A0A0A] flex-col p-3 xl:p-4 shrink-0 overflow-hidden select-none transition-all duration-300 min-h-0 min-w-0">
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

        {/* Section 3: TACTICAL RESOURCE FLEET */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[9px] font-bold text-white/40 uppercase tracking-widest flex items-center gap-1.5">
              <Radio className="w-3 h-3 text-[#10B981] animate-pulse" />
              <span>Resource Fleet</span>
            </span>
            <span className="text-[8px] font-mono text-amber-400 bg-amber-950/40 px-1.5 py-0.5 rounded border border-amber-800/40">
              STATIC ROSTER
            </span>
          </div>

          <div className="space-y-1.5 bg-white/[0.02] border border-white/10 rounded p-2 text-[9px] font-mono">
            {resources.map((res) => {
              const pct = Math.round((res.available / res.total) * 100);
              return (
                <div key={res.id} className="space-y-0.5">
                  <div className="flex justify-between text-white/80">
                    <span className="truncate max-w-[130px] font-medium">{res.name}</span>
                    <span className="text-white/40">
                      <strong className="text-[#10B981] font-bold">{res.available}</strong>/{res.total}
                    </span>
                  </div>
                  <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-white/10">
                    <div
                      className={`h-full rounded-full transition-all duration-300 ${
                        pct > 70 ? 'bg-[#10B981]' : pct > 40 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
