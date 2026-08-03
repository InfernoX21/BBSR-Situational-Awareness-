import React, { useState } from 'react';
import { LandmarkNode } from '../../types';
import {
  Building2,
  Zap,
  HeartPulse,
  Radio,
  ShieldAlert,
  Search,
  CheckCircle2,
  AlertTriangle,
  Activity,
  Wrench,
  Navigation,
} from 'lucide-react';

interface InfrastructureViewProps {
  landmarks: LandmarkNode[];
  onSelectLandmark: (lm: LandmarkNode) => void;
  onJumpToMap?: () => void;
}

export const InfrastructureView: React.FC<InfrastructureViewProps> = ({
  landmarks,
  onSelectLandmark,
  onJumpToMap,
}) => {
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const types = ['ALL', 'HOSPITAL', 'POLICE', 'FIRE', 'POWER', 'WATER', 'TELECOM', 'GOVT'];

  const filteredLandmarks = landmarks.filter((lm) => {
    const matchesType = typeFilter === 'ALL' || lm.type === typeFilter;
    const matchesSearch =
      lm.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      lm.details.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesType && matchesSearch;
  });

  const getStatusBadge = (status: LandmarkNode['status']) => {
    switch (status) {
      case 'ALERT':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#EF4444] text-white animate-pulse">ALERT</span>;
      case 'MAINTENANCE':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B] text-black">MAINTENANCE</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#10B981]/20 text-[#10B981] border border-[#10B981]/30">OPERATIONAL</span>;
    }
  };

  const getTypeIcon = (type: LandmarkNode['type']) => {
    switch (type) {
      case 'HOSPITAL': return <HeartPulse className="w-4 h-4 text-rose-400" />;
      case 'POWER': return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'TELECOM': return <Radio className="w-4 h-4 text-cyan-400" />;
      case 'POLICE': return <ShieldAlert className="w-4 h-4 text-emerald-400" />;
      default: return <Building2 className="w-4 h-4 text-white/70" />;
    }
  };

  const operationalCount = landmarks.filter((l) => l.status === 'OPERATIONAL').length;
  const alertCount = landmarks.filter((l) => l.status === 'ALERT').length;
  const maintenanceCount = landmarks.filter((l) => l.status === 'MAINTENANCE').length;

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#06B6D4]">
            <Building2 className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Critical Infrastructure & Smart Assets
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            Isolation Forest Structural Health Scoring, SCADA Sensor Telemetry & Predictive Maintenance
          </p>
        </div>

        {onJumpToMap && (
          <button
            onClick={onJumpToMap}
            className="px-3 py-1.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase flex items-center space-x-2 transition-all"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>GIS Digital Twin Assets</span>
          </button>
        )}
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Total Smart Assets</div>
          <div className="text-lg font-bold text-white mt-0.5">{landmarks.length} Nodes</div>
          <div className="text-white/40 text-[9px] mt-1">SCADA Monitored</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Fully Operational</div>
          <div className="text-lg font-bold text-[#10B981] mt-0.5">{operationalCount} Assets</div>
          <div className="text-[#10B981] text-[9px] mt-1">98.2% health uptime</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Anomaly Alerts</div>
          <div className="text-lg font-bold text-[#EF4444] mt-0.5">{alertCount} Node</div>
          <div className="text-[#EF4444] text-[9px] mt-1">Voltage variance detected</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Scheduled Work Orders</div>
          <div className="text-lg font-bold text-[#F59E0B] mt-0.5">{maintenanceCount} Maintenance</div>
          <div className="text-white/40 text-[9px] mt-1">Preventive overhaul</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-[#0A0A0A] p-3 rounded border border-white/10">
        <div className="flex items-center space-x-1.5 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setTypeFilter(t)}
              className={`px-3 py-1.5 rounded text-[10px] font-bold uppercase transition-all shrink-0 ${
                typeFilter === t
                  ? 'bg-white/10 text-[#06B6D4] border border-[#06B6D4]/40'
                  : 'text-white/40 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>

        <div className="flex items-center bg-black border border-white/10 rounded px-3 py-1.5 w-full sm:w-64">
          <Search className="w-3.5 h-3.5 text-white/40 mr-2 shrink-0" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search infrastructure assets..."
            className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full"
          />
        </div>
      </div>

      {/* Asset Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
        {filteredLandmarks.map((lm) => (
          <div
            key={lm.id}
            onClick={() => onSelectLandmark(lm)}
            className="p-4 bg-[#0A0A0A] border border-white/10 hover:border-[#06B6D4]/50 rounded transition-all cursor-pointer flex flex-col justify-between space-y-3 group"
          >
            <div>
              <div className="flex items-center justify-between border-b border-white/5 pb-2 mb-2">
                <div className="flex items-center space-x-2">
                  {getTypeIcon(lm.type)}
                  <span className="font-bold text-[#06B6D4] text-[10px] uppercase">{lm.type}</span>
                </div>
                {getStatusBadge(lm.status)}
              </div>

              <h2 className="text-sm font-bold text-white group-hover:text-[#06B6D4] transition-colors">
                {lm.name}
              </h2>

              <p className="text-white/70 text-[11px] mt-2 leading-relaxed">
                {lm.details}
              </p>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[10px] text-white/40">
              <div>
                LAT/LNG: <span className="text-white/70 font-mono">{lm.lat.toFixed(4)}, {lm.lng.toFixed(4)}</span>
              </div>
              <span className="text-[#06B6D4] group-hover:underline font-bold">Inspect SCADA</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
