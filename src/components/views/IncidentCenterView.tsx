import React, { useState } from 'react';
import { Incident, Severity } from '../../types';
import {
  AlertTriangle,
  Search,
  Filter,
  ShieldAlert,
  MapPin,
  Clock,
  Sparkles,
  CheckCircle2,
  Play,
  ArrowRight,
  Flame,
  Zap,
  Car,
  CloudRain,
  HeartPulse,
} from 'lucide-react';

interface IncidentCenterViewProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
  onUpdateStatus: (id: string, status: Incident['status']) => void;
  onJumpToMap: (inc: Incident) => void;
}

export const IncidentCenterView: React.FC<IncidentCenterViewProps> = ({
  incidents,
  onSelectIncident,
  onUpdateStatus,
  onJumpToMap,
}) => {
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isReplaying, setIsReplaying] = useState<boolean>(false);

  const categories = ['ALL', 'TRAFFIC', 'FIRE', 'FLOOD', 'UTILITY', 'SECURITY', 'MEDICAL'];
  const priorities = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const statuses = ['ALL', 'ACTIVE', 'DISPATCHED', 'CONTAINED', 'RESOLVED'];

  const filteredIncidents = incidents.filter((inc) => {
    const matchesCat = categoryFilter === 'ALL' || inc.category === categoryFilter;
    const matchesPri = priorityFilter === 'ALL' || inc.priority === priorityFilter;
    const matchesSta = statusFilter === 'ALL' || inc.status === statusFilter;
    const matchesSearch =
      inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      inc.agencyAssigned.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesPri && matchesSta && matchesSearch;
  });

  const getPriorityBadge = (priority: Severity) => {
    switch (priority) {
      case 'CRITICAL':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#EF4444] text-white animate-pulse">CRITICAL</span>;
      case 'HIGH':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B] text-black">HIGH</span>;
      case 'MEDIUM':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">MEDIUM</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/10 text-white/70">LOW</span>;
    }
  };

  const getCategoryIcon = (category: Incident['category']) => {
    switch (category) {
      case 'FIRE': return <Flame className="w-4 h-4 text-orange-400" />;
      case 'FLOOD': return <CloudRain className="w-4 h-4 text-[#06B6D4]" />;
      case 'UTILITY': return <Zap className="w-4 h-4 text-yellow-400" />;
      case 'SECURITY': return <ShieldAlert className="w-4 h-4 text-emerald-400" />;
      case 'MEDICAL': return <HeartPulse className="w-4 h-4 text-rose-400" />;
      default: return <Car className="w-4 h-4 text-indigo-400" />;
    }
  };

  const activeCount = incidents.filter((i) => i.status === 'ACTIVE').length;
  const criticalCount = incidents.filter((i) => i.priority === 'CRITICAL').length;
  const dispatchedCount = incidents.filter((i) => i.status === 'DISPATCHED').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED' || i.status === 'CONTAINED').length;

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#EF4444]">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Incident Management Center
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            Centralized Emergency Dispatch, Bayesian Graph Correlation & Multi-Agency Workflow
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsReplaying(!isReplaying)}
            className={`px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              isReplaying
                ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]'
                : 'bg-white/5 border-white/20 text-white/70 hover:text-white'
            }`}
          >
            <Play className={`w-3.5 h-3.5 ${isReplaying ? 'animate-spin' : ''}`} />
            <span>{isReplaying ? 'Replay Mode Active' : 'Bayesian Incident Replay'}</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Active Emergencies</div>
          <div className="text-lg font-bold text-[#EF4444] mt-0.5">{activeCount} Incidents</div>
          <div className="text-white/40 text-[9px] mt-1">Requiring immediate response</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Critical Priority</div>
          <div className="text-lg font-bold text-orange-400 mt-0.5">{criticalCount} High Risk</div>
          <div className="text-white/40 text-[9px] mt-1">Multi-agency involvement</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Field Dispatches</div>
          <div className="text-lg font-bold text-[#06B6D4] mt-0.5">{dispatchedCount} Units Active</div>
          <div className="text-[#06B6D4] text-[9px] mt-1">Average ETA: 4.2 mins</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Contained & Resolved</div>
          <div className="text-lg font-bold text-[#10B981] mt-0.5">{resolvedCount} Completed</div>
          <div className="text-[#10B981] text-[9px] mt-1">92.8% containment rate</div>
        </div>
      </div>

      {/* Filters & Search Toolbar */}
      <div className="space-y-3 bg-[#0A0A0A] p-3 rounded border border-white/10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Categories */}
          <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 sm:pb-0">
            <span className="text-white/40 text-[9px] font-bold uppercase mr-1">Category:</span>
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setCategoryFilter(cat)}
                className={`px-2.5 py-1 rounded text-[10px] font-bold uppercase transition-all ${
                  categoryFilter === cat
                    ? 'bg-white/10 text-[#06B6D4] border border-[#06B6D4]/40'
                    : 'text-white/40 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>

          {/* Search */}
          <div className="flex items-center bg-black border border-white/10 rounded px-3 py-1.5 w-full sm:w-60">
            <Search className="w-3.5 h-3.5 text-white/40 mr-2 shrink-0" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search incidents by location, agency..."
              className="bg-transparent text-xs text-white placeholder-white/30 focus:outline-none w-full"
            />
          </div>
        </div>

        {/* Priority & Status Row */}
        <div className="flex flex-wrap items-center space-x-6 pt-2 border-t border-white/5 text-[10px]">
          <div className="flex items-center space-x-2">
            <span className="text-white/40 font-bold uppercase">Priority:</span>
            {priorities.map((pri) => (
              <button
                key={pri}
                onClick={() => setPriorityFilter(pri)}
                className={`px-2 py-0.5 rounded transition-all ${
                  priorityFilter === pri
                    ? 'bg-white/10 text-[#F59E0B] font-bold'
                    : 'text-white/30 hover:text-white'
                }`}
              >
                {pri}
              </button>
            ))}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-white/40 font-bold uppercase">Status:</span>
            {statuses.map((sta) => (
              <button
                key={sta}
                onClick={() => setStatusFilter(sta)}
                className={`px-2 py-0.5 rounded transition-all ${
                  statusFilter === sta
                    ? 'bg-white/10 text-[#10B981] font-bold'
                    : 'text-white/30 hover:text-white'
                }`}
              >
                {sta}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Incident List */}
      <div className="space-y-3 flex-1">
        {filteredIncidents.map((inc) => (
          <div
            key={inc.id}
            className="p-4 bg-[#0A0A0A] border border-white/10 hover:border-white/20 rounded transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
          >
            <div className="space-y-2 flex-1">
              <div className="flex items-center space-x-3">
                {getCategoryIcon(inc.category)}
                <span className="font-bold text-white text-sm">{inc.title}</span>
                {getPriorityBadge(inc.priority)}
                <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-white/5 text-white/60 border border-white/10">
                  #{inc.id}
                </span>
              </div>

              <div className="flex flex-wrap items-center text-[10px] text-white/50 space-x-4 gap-y-1">
                <div className="flex items-center space-x-1 text-[#06B6D4]">
                  <MapPin className="w-3 h-3" />
                  <span>{inc.location.name}</span>
                </div>

                <div className="flex items-center space-x-1">
                  <Clock className="w-3 h-3 text-[#F59E0B]" />
                  <span>{inc.timestamp}</span>
                </div>

                <div>
                  AGENCY: <strong className="text-white">{inc.agencyAssigned}</strong>
                </div>

                <div>
                  CONFIDENCE: <strong className="text-[#10B981]">{inc.aiConfidence}%</strong>
                </div>
              </div>

              <p className="text-white/70 text-[11px] leading-relaxed max-w-3xl">
                {inc.description}
              </p>

              {inc.recommendedAction && (
                <div className="p-2 bg-[#06B6D4]/5 border border-[#06B6D4]/20 rounded text-[10px] text-[#06B6D4] flex items-center space-x-2">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>AI Recommended Dispatch: <strong>{inc.recommendedAction}</strong></span>
                </div>
              )}
            </div>

            {/* Quick Actions & Status Changer */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center space-y-2 sm:space-y-0 sm:space-x-2 w-full md:w-auto shrink-0 border-t md:border-t-0 border-white/5 pt-3 md:pt-0">
              <select
                value={inc.status}
                onChange={(e) => onUpdateStatus(inc.id, e.target.value as Incident['status'])}
                className="bg-black border border-white/20 rounded px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#06B6D4]"
              >
                <option value="ACTIVE">Status: ACTIVE</option>
                <option value="DISPATCHED">Status: DISPATCHED</option>
                <option value="CONTAINED">Status: CONTAINED</option>
                <option value="RESOLVED">Status: RESOLVED</option>
              </select>

              <button
                onClick={() => {
                  onSelectIncident(inc);
                  onJumpToMap(inc);
                }}
                className="px-3 py-1.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase flex items-center justify-center space-x-1.5 transition-all"
              >
                <span>Jump to Map</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
