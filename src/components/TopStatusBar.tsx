import React, { useState, useEffect } from 'react';
import { WeatherData, Severity, ConnectionHealthInfo, ConnectionHealthMap } from '../types';
import { liveDataManager } from '../services/LiveDataManager';
import { operationalStore, useOperationalStore } from '../store/useOperationalStore';
import {
  Activity,
  ShieldAlert,
  RefreshCw,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Menu,
  ChevronDown,
  X,
  MapPin,
  UserCheck,
  Search,
  Play,
} from 'lucide-react';

interface TopStatusBarProps {
  weather: WeatherData;
  threatLevel: Severity;
  setThreatLevel: (level: Severity) => void;
  onRefreshAll: () => void;
  onRefreshWeather?: () => void;
  onOpenMobileMenu?: () => void;
}

type PopoverId = 'threat' | 'weather' | null;

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  weather,
  threatLevel,
  setThreatLevel,
  onRefreshAll,
  onRefreshWeather,
  onOpenMobileMenu,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [healthMap, setHealthMap] = useState<ConnectionHealthMap>(liveDataManager.getConnectionHealth());
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [openPopover, setOpenPopover] = useState<PopoverId>(null);
  const [isSyncingWeather, setIsSyncingWeather] = useState(false);

  const handleManualWeatherSync = () => {
    setIsSyncingWeather(true);
    if (onRefreshWeather) {
      onRefreshWeather();
    } else {
      onRefreshAll();
    }
    setTimeout(() => setIsSyncingWeather(false), 600);
  };

  useEffect(() => {
    const updateTimes = () => {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString('en-US', {
          timeZone: 'Asia/Kolkata',
          hour12: false,
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }) + ' IST'
      );
      setCurrentDate(
        now.toLocaleDateString('en-GB', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          year: 'numeric',
        })
      );
      setHealthMap(liveDataManager.getConnectionHealth());
    };

    updateTimes();
    const interval = setInterval(updateTimes, 1000);
    const unsub = liveDataManager.subscribe(() => setHealthMap(liveDataManager.getConnectionHealth()));

    return () => {
      clearInterval(interval);
      unsub();
    };
  }, []);

  const toggle = (id: Exclude<PopoverId, null>) =>
    setOpenPopover((prev) => (prev === id ? null : id));

  const threatBadgeClass = (level: Severity) => {
    switch (level) {
      case 'CRITICAL':
        return 'is-critical';
      case 'HIGH':
        return 'is-high';
      case 'MEDIUM':
        return 'is-medium';
      default:
        return 'is-low';
    }
  };

  const healthEntries = Object.entries(healthMap) as [string, ConnectionHealthInfo][];
  const activeConnectedCount = healthEntries.filter(([, h]) => h.status === 'CONNECTED').length;
  const totalStreamsCount = healthEntries.length;
  const degradedStreams = healthEntries.filter(([, h]) => h.status !== 'CONNECTED');
  const allStreamsUp = degradedStreams.length === 0;

  return (
    <header className="gov-glass-header text-white shrink-0 relative z-[100] font-sans min-w-0">
      <div className="h-9 sm:h-10 flex items-center justify-between gap-1.5 sm:gap-2 px-2.5 sm:px-3 min-w-0 relative z-[100]">
        {/* --- Identity --- */}
        <div className="flex items-center gap-2 shrink-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Open navigation menu"
              className="md:hidden w-7 h-7 rounded bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
            >
              <Menu className="w-4 h-4" aria-hidden="true" />
            </button>
          )}

          <div className="flex flex-col justify-center leading-none min-w-0 select-none">
            <div className="flex items-center text-[14px] sm:text-[15px] font-extrabold tracking-tight font-mono">
              <span className="text-white">ARKA</span>
              <span className="text-cyan-400 font-bold ml-0.5">.OS</span>
            </div>
            <div className="text-[7.5px] sm:text-[8.5px] text-white/50 tracking-[0.22em] uppercase font-mono mt-0.5 whitespace-nowrap">
              GEOSPATIAL SITUATIONAL AWARENESS
            </div>
          </div>
        </div>

        {/* --- Jurisdiction --- */}
        <div className="hidden lg:flex items-center gap-1.5 text-[11px] font-mono text-white/70 bg-white/[0.03] border border-white/10 px-2 py-0.5 rounded-full shrink-0">
          <MapPin className="w-3 h-3 text-cyan-400 shrink-0" aria-hidden="true" />
          <span className="text-white/50">Jurisdiction:</span>
          <span className="font-semibold text-white">Bhubaneswar (BMC), Odisha</span>
        </div>

        {/* --- Global Search Trigger --- */}
        <button
          onClick={() => operationalStore.setIsSearchOpen(true)}
          className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-300 text-xs font-mono transition cursor-pointer"
          title="Search everything across Bhubaneswar (Ctrl+K)"
        >
          <Search className="w-3.5 h-3.5 text-orange-400" />
          <span>Search...</span>
          <span className="text-[10px] px-1 py-0.2 rounded bg-zinc-950 text-zinc-500 font-mono">Ctrl+K</span>
        </button>

        {/* --- Guided Operational Loop Demo Button --- */}
        <button
          onClick={() => operationalStore.setIsGuidedFlowOpen(true)}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold text-xs font-mono transition shadow"
          title="Demonstrate end-to-end 14-step operational loop"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>OPERATIONAL LOOP DEMO</span>
        </button>

        {/* --- Role Switcher --- */}
        <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 rounded px-1.5 py-0.5 text-xs font-mono">
          <UserCheck className="w-3.5 h-3.5 text-orange-400" />
          <select
            value={useOperationalStore().role}
            onChange={(e) => operationalStore.setRole(e.target.value as any)}
            className="bg-transparent text-zinc-200 focus:outline-none cursor-pointer font-bold"
          >
            <option value="TRAFFIC_OPERATOR" className="bg-zinc-950">Traffic Operator</option>
            <option value="EMERGENCY_OPERATOR" className="bg-zinc-950">Emergency Operator</option>
            <option value="CITY_ADMIN" className="bg-zinc-950">City Administrator</option>
            <option value="ANALYST" className="bg-zinc-950">City Analyst</option>
          </select>
        </div>

        <div className="flex-1 min-w-2" />

        {/* --- Date & time --- */}
        <div className="hidden md:flex items-center gap-2 text-[11px] font-mono bg-white/[0.03] border border-white/10 px-2 py-0.5 rounded text-white/80 shrink-0">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          <span className="text-white/40 text-[10px]">{currentDate}</span>
          <span className="text-white font-semibold tabular-nums">{currentTime}</span>
        </div>

        {/* --- System status --- */}
        <button
          type="button"
          onClick={() => setShowHealthModal(true)}
          title="Open connection health and stream diagnostics"
          className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-400 text-[11px] font-mono font-medium transition-all shrink-0 cursor-pointer shadow-sm"
        >
          {allStreamsUp ? (
            <CheckCircle2 className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">
            {allStreamsUp ? 'Systems normal' : 'Systems degraded'}
          </span>
          <span className="text-[10px] bg-emerald-500/20 px-1 py-0.2 rounded text-emerald-300 font-bold">
            {activeConnectedCount}/{totalStreamsCount}
          </span>
        </button>

        {/* --- Threat level --- */}
        <div className="relative shrink-0 z-[100]">
          <button
            type="button"
            onClick={() => toggle('threat')}
            aria-expanded={openPopover === 'threat'}
            aria-haspopup="menu"
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[11px] font-mono transition-all shrink-0 cursor-pointer shadow-sm"
            title="Set city-wide alert level"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-amber-400 shrink-0" aria-hidden="true" />
            <span className="hidden sm:inline text-white/70">Alert level</span>
            <span className={`px-1.5 py-0.2 rounded text-[9px] font-bold uppercase tracking-wider ${threatBadgeClass(threatLevel)}`}>
              {threatLevel}
            </span>
            <ChevronDown className="w-3 h-3 opacity-60 shrink-0" aria-hidden="true" />
          </button>

          {openPopover === 'threat' && (
            <div role="menu" className="absolute right-0 top-full mt-1.5 w-44 bg-[#090D14] border border-amber-500/40 rounded-md p-1.5 z-[9999] shadow-2xl animate-in fade-in duration-150">
              <p className="gov-label px-2 py-1 text-[10px] font-mono text-white/40">City alert level</p>
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]).map((lvl) => (
                <button
                  key={lvl}
                  role="menuitemradio"
                  aria-checked={threatLevel === lvl}
                  onClick={() => {
                    setThreatLevel(lvl);
                    setOpenPopover(null);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded text-[11px] font-mono text-left transition-colors ${
                    threatLevel === lvl ? 'bg-cyan-500/20 text-cyan-300 font-bold border border-cyan-500/30' : 'text-white/80 hover:bg-white/10'
                  }`}
                >
                  <span>{lvl}</span>
                  {threatLevel === lvl && <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* --- Weather + live provenance --- */}
        <div className="relative shrink-0 hidden md:block">
          <button
            type="button"
            onClick={() => toggle('weather')}
            aria-expanded={openPopover === 'weather'}
            className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white/80 text-[11px] font-mono transition-all shrink-0 cursor-pointer group"
            title="Real-time Bhubaneswar weather telemetry and data provenance"
          >
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse shrink-0" title="Live stream active" />
            <span className="text-white/50">Weather</span>
            <span className="font-semibold text-white">
              {weather.temperature}°C · {weather.humidity}% RH
            </span>
            <Info className="w-3 h-3 text-white/40 group-hover:text-cyan-400 shrink-0 transition-colors" aria-hidden="true" />
          </button>

          {openPopover === 'weather' && (
            <div className="absolute right-0 top-full mt-1.5 w-80 gov-glass border border-white/15 rounded-md p-3 z-50 shadow-2xl space-y-2.5">
              <div className="flex items-center justify-between border-b border-white/10 pb-1.5">
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[11px] font-bold font-mono text-white">Data provenance</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase ${
                    weather.provenance?.classification === 'LIVE' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                    weather.provenance?.classification === 'CACHED' ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                  }`}>
                    {weather.provenance?.classification || 'LIVE'}
                  </span>
                </div>
              </div>

              {/* Live Telemetry Overview Cards */}
              <div className="grid grid-cols-2 gap-1.5 text-[10px] font-mono">
                <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                  <div className="text-white/40">TEMPERATURE</div>
                  <div className="text-cyan-300 font-bold text-[11px]">{weather.temperature}°C</div>
                </div>
                <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                  <div className="text-white/40">HUMIDITY</div>
                  <div className="text-emerald-300 font-bold text-[11px]">{weather.humidity}% RH</div>
                </div>
                <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                  <div className="text-white/40">WIND SPEED</div>
                  <div className="text-white font-bold">{weather.windSpeed || 14.2} km/h {weather.windDirection || 'SW'}</div>
                </div>
                <div className="bg-white/[0.03] p-1.5 rounded border border-white/5">
                  <div className="text-white/40">RAIN RATE</div>
                  <div className="text-amber-300 font-bold">{weather.rainIntensity || 0} mm/h</div>
                </div>
              </div>

              {/* Data Provenance Details */}
              <dl className="space-y-1 text-[11px] font-mono pt-1 border-t border-white/10">
                {[
                  ['Source', weather.provenance?.source || 'Open-Meteo & IMD radar'],
                  ['Provider', weather.provenance?.provider || 'IMD Bhubaneswar'],
                  ['Confidence', `${weather.provenance?.confidence ?? 98}%`],
                  ['Latency', `${weather.provenance?.latencyMs ?? 18} ms`],
                  ['Last sync', weather.provenance?.lastUpdated || new Date().toLocaleTimeString()],
                  ['Condition', weather.condition],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3">
                    <dt className="text-white/40">{k}</dt>
                    <dd className="text-white font-medium text-right">{v}</dd>
                  </div>
                ))}
              </dl>

              {/* Instant Manual Sync Action */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={handleManualWeatherSync}
                  className="w-full py-1 px-2 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 hover:text-cyan-200 text-[10px] font-mono font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <RotateCw className={`w-3 h-3 ${isSyncingWeather ? 'animate-spin text-cyan-400' : ''}`} />
                  <span>SYNC LIVE WEATHER NOW</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* --- Refresh --- */}
        <button
          type="button"
          onClick={onRefreshAll}
          className="w-6.5 h-6.5 rounded bg-white/[0.03] hover:bg-white/[0.08] border border-white/10 text-white/60 hover:text-white flex items-center justify-center transition-all shrink-0 cursor-pointer"
          title="Refresh all feeds"
          aria-label="Refresh all feeds"
        >
          <RefreshCw className="w-3 h-3" aria-hidden="true" />
        </button>
      </div>

      {/* Click-away layer for popovers */}
      {openPopover && (
        <div
          className="fixed inset-0 z-20"
          aria-hidden="true"
          onClick={() => setOpenPopover(null)}
        />
      )}

      {/* --- Connection health & stream diagnostics --- */}
      {showHealthModal && (
        <div
          className="fixed inset-0 bg-navy/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => setShowHealthModal(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Connection health and stream diagnostics"
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-3xl gov-panel shadow-lg max-h-[85vh] flex flex-col"
          >
            <div className="gov-panel-head">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" aria-hidden="true" />
                <h3 className="text-[14px] font-semibold text-ink">
                  Connection health & stream diagnostics
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowHealthModal(false)}
                aria-label="Close diagnostics"
                className="gov-btn gov-btn-quiet gov-btn-sm"
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>

            <div className="p-4 overflow-y-auto">
              <p className="text-[12px] text-ink-muted mb-3">
                {activeConnectedCount} of {totalStreamsCount} ingestion streams are connected.
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {healthEntries.map(([key, info]) => {
                  const badge =
                    info.status === 'CONNECTED'
                      ? 'is-low'
                      : info.status === 'SYNCING'
                      ? 'is-info'
                      : 'is-high';
                  const rail =
                    info.status === 'CONNECTED'
                      ? 'gov-rail-low'
                      : info.status === 'SYNCING'
                      ? 'gov-rail-info'
                      : 'gov-rail-high';
                  const clsLabel = info.classification || (info.status === 'CONNECTED' ? 'LIVE' : 'UNAVAILABLE');
                  return (
                    <div key={key} className={`gov-row gov-rail ${rail} p-3`}>
                      <div className="flex justify-between items-start gap-2 mb-1.5">
                        <span className="text-[13px] font-semibold text-ink capitalize flex items-center gap-1.5">
                          {key} stream
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-mono">
                            {clsLabel}
                          </span>
                        </span>
                        <span className={`gov-badge ${badge}`}>
                          {info.status === 'CONNECTED' ? (
                            <CheckCircle2 className="w-3 h-3" aria-hidden="true" />
                          ) : info.status === 'SYNCING' ? (
                            <RotateCw className="w-3 h-3 animate-spin" aria-hidden="true" />
                          ) : (
                            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                          )}
                          {info.status}
                        </span>
                      </div>

                      <dl className="text-[12px] space-y-0.5">
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-muted">Provider</dt>
                          <dd className="text-ink font-medium text-right">{info.provider}</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-muted">Latency</dt>
                          <dd className="gov-mono text-ink text-right">{info.latencyMs} ms</dd>
                        </div>
                        <div className="flex justify-between gap-2">
                          <dt className="text-ink-muted">Last sync</dt>
                          <dd className="gov-mono text-ink text-right">{info.lastSync}</dd>
                        </div>
                      </dl>

                      <p className="text-[11px] text-ink-subtle mt-1.5">{info.details}</p>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-4 py-3 border-t border-line flex justify-end">
              <button
                type="button"
                onClick={() => setShowHealthModal(false)}
                className="gov-btn gov-btn-primary"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};
