import React, { useState, useEffect } from 'react';
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
  Pause,
  ArrowRight,
  Flame,
  Zap,
  Car,
  CloudRain,
  HeartPulse,
  RotateCcw,
  Send,
  Eye,
} from 'lucide-react';

interface ActiveSituationsViewProps {
  incidents: Incident[];
  onSelectIncident: (inc: Incident) => void;
  onUpdateStatus: (id: string, status: Incident['status']) => void;
  onJumpToMap: (inc: Incident) => void;
}

export const ActiveSituationsView: React.FC<ActiveSituationsViewProps> = ({
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
  const [replayStep, setReplayStep] = useState<number>(0);
  const [replayLog, setReplayLog] = useState<string>('');

  const [activeTab, setActiveTab] = useState<'GRID' | 'WORKFLOW'>('GRID');
  const [selectedWorkflowIncident, setSelectedWorkflowIncident] = useState<Incident>(incidents[0] || ({} as Incident));
  const [activeBuffer, setActiveBuffer] = useState<number>(500);

  useEffect(() => {
    if (incidents.length > 0 && (!selectedWorkflowIncident || !selectedWorkflowIncident.id)) {
      setSelectedWorkflowIncident(incidents[0]);
    }
  }, [incidents]);

  const workflowStagesList = [
    'DETECTED',
    'VALIDATE',
    'SEVERITY',
    'EXACT_LOCATION',
    'BUFFER_ZONE',
    'NEARBY_RESPONDERS',
    'TRAFFIC_ANALYSIS',
    'WEATHER_ANALYSIS',
    'INFRASTRUCTURE_CONSTRAINTS',
    'RECOMMENDED_RESPONSE',
    'NOTIFY_AGENCIES',
    'DEPLOY_RESOURCES',
    'MONITOR_PROGRESS',
    'UPDATE_STATE',
    'RESOLVE',
    'ARCHIVE_ANALYTICS',
  ];

  const categories = ['ALL', 'TRAFFIC', 'FIRE', 'FLOOD', 'UTILITY', 'SECURITY', 'MEDICAL'];
  const priorities = ['ALL', 'CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];
  const statuses = ['ALL', 'ACTIVE', 'DISPATCHED', 'CONTAINED', 'RESOLVED'];

  useEffect(() => {
    if (isReplaying) {
      setReplayLog('Workflow Replay Step 1: Ingested validated incident report.');
    } else {
      setReplayStep(0);
      setReplayLog('');
    }
  }, [isReplaying]);

  const filteredIncidents = incidents
    .filter((inc) => {
      const matchesCat = categoryFilter === 'ALL' || inc.category === categoryFilter;
      const matchesPri = priorityFilter === 'ALL' || inc.priority === priorityFilter;
      const matchesSta = statusFilter === 'ALL' || inc.status === statusFilter;
      const matchesSearch =
        inc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        inc.agencyAssigned.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesCat && matchesPri && matchesSta && matchesSearch;
    })
    .sort((a, b) => {
      const statusOrder: Record<Incident['status'], number> = {
        ACTIVE: 1,
        DISPATCHED: 2,
        CONTAINED: 3,
        RESOLVED: 4,
      };
      const statusDiff = statusOrder[a.status] - statusOrder[b.status];
      if (statusDiff !== 0) return statusDiff;

      const priorityOrder: Record<Severity, number> = {
        CRITICAL: 1,
        HIGH: 2,
        MEDIUM: 3,
        LOW: 4,
      };
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    });

  const hasActiveFilters =
    categoryFilter !== 'ALL' || priorityFilter !== 'ALL' || statusFilter !== 'ALL' || searchQuery !== '';

  const resetFilters = () => {
    setCategoryFilter('ALL');
    setPriorityFilter('ALL');
    setStatusFilter('ALL');
    setSearchQuery('');
  };

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

  const getStatusStyle = (status: Incident['status']) => {
    switch (status) {
      case 'ACTIVE': return 'border-[#EF4444]/60 text-[#EF4444] bg-[#EF4444]/10';
      case 'DISPATCHED': return 'border-[#06B6D4]/60 text-[#06B6D4] bg-[#06B6D4]/10';
      case 'CONTAINED': return 'border-[#F59E0B]/60 text-[#F59E0B] bg-[#F59E0B]/10';
      case 'RESOLVED': return 'border-[#10B981]/60 text-[#10B981] bg-[#10B981]/10';
    }
  };

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#EF4444]">
            <AlertTriangle className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Active Situations — Incidents, Alerts &amp; Anomalies
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            Centralized Emergency Dispatch, Autonomous Workflow Engine & Multi-Agency C2 Matrix
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {/* Tab Navigation Toggle */}
          <div className="flex items-center bg-white/5 border border-white/10 rounded p-1 space-x-1">
            <button
              onClick={() => setActiveTab('GRID')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer ${
                activeTab === 'GRID' ? 'bg-[#06B6D4] text-black shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              Incidents Grid
            </button>
            <button
              onClick={() => setActiveTab('WORKFLOW')}
              className={`px-3 py-1 rounded text-xs font-bold transition-all cursor-pointer flex items-center space-x-1 ${
                activeTab === 'WORKFLOW' ? 'bg-[#3B82F6] text-white shadow' : 'text-white/60 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3" />
              <span>Workflow Engine</span>
            </button>
          </div>

          <button
            onClick={() => setIsReplaying(!isReplaying)}
            className={`px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all cursor-pointer ${
              isReplaying
                ? 'bg-[#F59E0B]/20 border-[#F59E0B] text-[#F59E0B]'
                : 'bg-white/5 border-white/20 text-white/70 hover:text-white hover:border-white/40'
            }`}
          >
            {isReplaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
            <span>{isReplaying ? 'Stop Replay' : 'Bayesian Incident Replay'}</span>
          </button>
        </div>
      </div>

      {/* Bayesian Replay Active Banner */}
      {isReplaying && (
        <div className="p-3 bg-[#F59E0B]/10 border border-[#F59E0B]/30 rounded flex items-center justify-between animate-pulse">
          <div className="flex items-center space-x-3 text-[#F59E0B]">
            <Sparkles className="w-4 h-4 shrink-0" />
            <span className="font-bold text-xs uppercase tracking-wide">
              Replay Step [{replayStep + 1}/4]: {replayLog}
            </span>
          </div>
          <span className="text-[10px] text-white/50 font-mono">SIMULATION SPEED: 1.0x</span>
        </div>
      )}

      {/* Main Tab Content */}
      {activeTab === 'GRID' ? (
        <div className="space-y-4">
          {/* Search & Filter Bar */}
          <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3 p-3 bg-[#0A0A0A] border border-white/10 rounded">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
              <input
                type="text"
                placeholder="Search incidents by title, location, or assigned agency..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-black border border-white/15 rounded pl-9 pr-3 py-1.5 text-white placeholder-white/30 focus:outline-none focus:border-[#06B6D4]"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-black border border-white/15 text-white px-2.5 py-1.5 rounded focus:outline-none focus:border-[#06B6D4]"
              >
                {categories.map((c) => (
                  <option key={c} value={c}>Category: {c}</option>
                ))}
              </select>

              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="bg-black border border-white/15 text-white px-2.5 py-1.5 rounded focus:outline-none focus:border-[#06B6D4]"
              >
                {priorities.map((p) => (
                  <option key={p} value={p}>Priority: {p}</option>
                ))}
              </select>

              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="bg-black border border-white/15 text-white px-2.5 py-1.5 rounded focus:outline-none focus:border-[#06B6D4]"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>Status: {s}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Incident Cards */}
          <div className="space-y-3">
            {filteredIncidents.length === 0 ? (
              <div className="p-12 text-center bg-[#0A0A0A] border border-white/10 rounded space-y-3">
                <AlertTriangle className="w-8 h-8 text-white/20 mx-auto" />
                <div className="text-white/60 font-bold">No Incidents Found</div>
              </div>
            ) : (
              filteredIncidents.map((inc) => (
                <div
                  key={inc.id}
                  className="p-4 bg-[#0A0A0A] border border-white/10 hover:border-white/25 rounded transition-all flex flex-col md:flex-row items-start md:items-center justify-between gap-4"
                >
                  <div
                    onClick={() => onSelectIncident(inc)}
                    className="space-y-2 flex-1 cursor-pointer group"
                  >
                    <div className="flex items-center space-x-3">
                      {getCategoryIcon(inc.category)}
                      <span className="font-bold text-white text-sm group-hover:text-[#06B6D4] transition-colors">
                        {inc.title}
                      </span>
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
                      <div>AGENCY: <strong className="text-white">{inc.agencyAssigned}</strong></div>
                      <div>CONFIDENCE: <strong className="text-[#10B981]">{inc.aiConfidence}%</strong></div>
                    </div>

                    <p className="text-white/70 text-[11px] leading-relaxed max-w-3xl">
                      {inc.description}
                    </p>
                  </div>

                  <div className="flex items-center space-x-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedWorkflowIncident(inc);
                        setActiveTab('WORKFLOW');
                      }}
                      className="px-3 py-1.5 rounded bg-blue-500/20 border border-blue-500/40 text-blue-400 font-bold hover:bg-blue-500/30 transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <Sparkles className="w-3 h-3" />
                      <span>Workflow Engine</span>
                    </button>
                    <button
                      onClick={() => onJumpToMap(inc)}
                      className="px-3 py-1.5 rounded bg-white/10 text-white font-bold hover:bg-white/20 transition-all cursor-pointer flex items-center space-x-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>View Map</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      ) : (
        /* AUTONOMOUS WORKFLOW ENGINE DASHBOARD VIEW */
        <div className="space-y-6">
          {/* Target Incident Selector & Buffer Zone */}
          <div className="p-4 bg-[#090E17] border border-blue-500/30 rounded-lg flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-3 w-full lg:w-auto">
              <label className="text-white/60 font-bold text-xs uppercase tracking-wider shrink-0">
                Target Incident:
              </label>
              <select
                value={selectedWorkflowIncident?.id || ''}
                onChange={(e) => {
                  const target = incidents.find((i) => i.id === e.target.value);
                  if (target) setSelectedWorkflowIncident(target);
                }}
                className="bg-black/60 border border-blue-500/40 text-white px-3 py-1.5 rounded font-mono text-xs focus:outline-none focus:border-blue-400 w-full sm:w-80"
              >
                {incidents.map((inc) => (
                  <option key={inc.id} value={inc.id}>
                    #{inc.id} — {inc.title} ({inc.priority})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center space-x-2">
              <span className="text-white/60 font-bold text-xs uppercase tracking-wider">
                Response Buffer Zone:
              </span>
              <div className="flex items-center bg-black/60 border border-white/10 rounded p-1 space-x-1">
                {[100, 250, 500, 1000].map((radius) => (
                  <button
                    key={radius}
                    onClick={() => setActiveBuffer(radius)}
                    className={`px-2.5 py-1 rounded text-[10px] font-bold transition-all cursor-pointer ${
                      activeBuffer === radius
                        ? 'bg-blue-600 text-white shadow'
                        : 'text-white/50 hover:text-white'
                    }`}
                  >
                    {radius >= 1000 ? `${radius / 1000}km` : `${radius}m`}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 16-Stage Lifecycle Stepper */}
          <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
                <Sparkles className="w-4 h-4 text-blue-400" />
                <span>Operational Lifecycle State Machine (16 Stages)</span>
              </span>
              <span className="text-[10px] text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                ACTIVE STATE: NOTIFY_AGENCIES
              </span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-8 gap-2">
              {workflowStagesList.map((stg, idx) => {
                const isCompleted = idx <= 10;
                const isCurrent = idx === 10;
                return (
                  <div
                    key={stg}
                    className={`p-2 rounded border text-center font-mono text-[9px] flex flex-col justify-between transition-all ${
                      isCurrent
                        ? 'bg-blue-600/30 border-blue-400 text-white font-bold shadow-[0_0_10px_#3b82f6]'
                        : isCompleted
                        ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                        : 'bg-white/5 border-white/5 text-white/30'
                    }`}
                  >
                    <span className="text-[8px] opacity-60">P-{idx + 1}</span>
                    <span className="truncate mt-1 uppercase font-bold">{stg.replace(/_/g, ' ')}</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* AI Decision & Multi-Agency Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-[#06B6D4]" />
                  <span>AI Decision Support</span>
                </span>
                <span className="text-[10px] text-emerald-400 font-bold">CONFIDENCE 94%</span>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-2.5 bg-white/5 border border-white/10 rounded">
                  <div className="text-white/40 text-[9px]">ESCALATION RISK</div>
                  <div className="text-amber-400 font-bold text-sm mt-0.5">MODERATE</div>
                </div>
                <div className="p-2.5 bg-white/5 border border-white/10 rounded">
                  <div className="text-white/40 text-[9px]">EST. RESOLUTION SLA</div>
                  <div className="text-blue-400 font-bold text-sm mt-0.5">25 MINS</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="text-white/60 font-bold text-[10px] uppercase">
                  Suggested Operational Actions:
                </div>
                <ul className="space-y-1.5 text-[11px] text-white/80">
                  <li className="p-2 bg-white/5 rounded border border-white/5 flex items-start space-x-2">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>Establish {activeBuffer}m perimeter around site.</span>
                  </li>
                  <li className="p-2 bg-white/5 rounded border border-white/5 flex items-start space-x-2">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>Signal priority green wave corridor to Capital Hospital.</span>
                  </li>
                  <li className="p-2 bg-white/5 rounded border border-white/5 flex items-start space-x-2">
                    <ArrowRight className="w-3.5 h-3.5 text-blue-400 shrink-0 mt-0.5" />
                    <span>Dispatch Telegram operational alert to duty commanders.</span>
                  </li>
                </ul>
              </div>
            </div>

            <div className="lg:col-span-2 p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-emerald-400" />
                  <span>Multi-Agency Operational C2 Matrix</span>
                </span>
                <span className="text-[10px] text-white/50">4 AGENCIES SYNCHRONIZED</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {[
                  { name: 'Commissionerate Police', role: 'Perimeter Security', status: 'DISPATCHED', eta: '3m', color: 'text-blue-400' },
                  { name: 'Fire & Rescue Services', role: 'Hazmat & Fire Containment', status: 'EN_ROUTE', eta: '5m', color: 'text-orange-400' },
                  { name: '108 Ambulance Services', role: 'Medical Trauma Unit', status: 'DISPATCHED', eta: '6m', color: 'text-rose-400' },
                  { name: 'Bhubaneswar Municipal Corp', role: 'Civic Works & Drainage', status: 'NOTIFIED', eta: '15m', color: 'text-yellow-400' },
                ].map((ag) => (
                  <div key={ag.name} className="p-3 bg-white/5 border border-white/10 rounded space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-xs ${ag.color}`}>{ag.name}</span>
                      <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-white">
                        {ag.status}
                      </span>
                    </div>
                    <div className="text-white/60 text-[10px]">{ag.role}</div>
                    <div className="flex items-center justify-between text-[10px] text-white/40 pt-1 border-t border-white/5">
                      <span>EST. ARRIVAL: <strong className="text-white">{ag.eta}</strong></span>
                      <span className="text-emerald-400">ACKNOWLEDGED</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Ranked Responders & Timeline */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
              <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
                <Car className="w-4 h-4 text-amber-400" />
                <span>Ranked Available Responder Deployment</span>
              </span>

              <div className="space-y-2">
                {[
                  { rank: 1, name: 'Bhubaneswar Water Tender Unit 1', dist: '1.2 km', eta: '4 min', match: '98%', type: 'Fire Engines' },
                  { rank: 2, name: 'PCR Squad Delta 4', dist: '0.5 km', eta: '2 min', match: '95%', type: 'Police Vehicles' },
                  { rank: 3, name: '108 ALS Ambulance Squad 2', dist: '1.8 km', eta: '6 min', match: '92%', type: 'Ambulances' },
                ].map((res) => (
                  <div key={res.name} className="p-2.5 bg-white/5 border border-white/10 rounded flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <span className="w-5 h-5 rounded-full bg-blue-500/20 text-blue-400 font-bold text-[10px] flex items-center justify-center border border-blue-500/40">
                        #{res.rank}
                      </span>
                      <div>
                        <div className="font-bold text-white text-xs">{res.name}</div>
                        <div className="text-white/40 text-[9px]">{res.type} • {res.dist} away</div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-emerald-400 font-bold text-xs">ETA {res.eta}</div>
                      <div className="text-white/40 text-[9px]">MATCH {res.match}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white text-xs uppercase tracking-wider flex items-center space-x-2">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span>Workflow Operational Audit Log</span>
                </span>
                <span className="text-[9px] text-white/40">REAL-TIME TELEMETRY</span>
              </div>

              <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
                {[
                  { time: '12:31 PM', title: 'Incident Detected', desc: 'Triggered by AI surveillance stream.', actor: 'AI_ENGINE' },
                  { time: '12:32 PM', title: 'Incident Validated', desc: 'Multi-camera correlation verified.', actor: 'AI_ENGINE' },
                  { time: '12:33 PM', title: 'Severity Assessed', desc: 'Escalation risk: MODERATE.', actor: 'AI_ENGINE' },
                  { time: '12:34 PM', title: 'Response Buffer Zone Created', desc: `${activeBuffer}m perimeter established.`, actor: 'WORKFLOW' },
                  { time: '12:35 PM', title: 'Agencies Notified & Telegram Alert Issued', desc: 'Broadcasted to C2 command channel.', actor: 'TELEGRAM' },
                ].map((t, idx) => (
                  <div key={idx} className="p-2 bg-white/5 rounded border border-white/5 flex items-start space-x-3 text-[10px]">
                    <span className="text-blue-400 font-bold shrink-0">{t.time}</span>
                    <div className="flex-1">
                      <div className="font-bold text-white">{t.title}</div>
                      <div className="text-white/50">{t.desc}</div>
                    </div>
                    <span className="px-1.5 py-0.5 rounded bg-white/10 text-white/70 text-[8px] font-bold shrink-0">
                      {t.actor}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
