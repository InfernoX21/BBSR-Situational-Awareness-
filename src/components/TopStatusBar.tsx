import React, { useState, useEffect } from 'react';
import { WeatherData, Severity, ConnectionHealthInfo, ConnectionHealthMap } from '../types';
import { liveDataManager } from '../services/LiveDataManager';
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
} from 'lucide-react';

interface TopStatusBarProps {
  weather: WeatherData;
  threatLevel: Severity;
  setThreatLevel: (level: Severity) => void;
  onRefreshAll: () => void;
  onOpenMobileMenu?: () => void;
}

type PopoverId = 'threat' | 'weather' | null;

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  weather,
  threatLevel,
  setThreatLevel,
  onRefreshAll,
  onOpenMobileMenu,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [currentDate, setCurrentDate] = useState<string>('');
  const [healthMap, setHealthMap] = useState<ConnectionHealthMap>(liveDataManager.getConnectionHealth());
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [openPopover, setOpenPopover] = useState<PopoverId>(null);

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
    <header className="gov-glass-header text-white shrink-0 relative z-30 font-sans min-w-0">
      <div className="h-12 sm:h-14 flex items-center justify-between gap-1.5 sm:gap-3 px-2 sm:px-4 overflow-hidden min-w-0">
        {/* --- Identity --- */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onOpenMobileMenu && (
            <button
              type="button"
              onClick={onOpenMobileMenu}
              aria-label="Open navigation menu"
              className="md:hidden w-10 h-10 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center shrink-0"
            >
              <Menu className="w-5 h-5" aria-hidden="true" />
            </button>
          )}

          <div className="flex items-center gap-2.5">
            <span
              aria-hidden="true"
              className="w-8 h-8 rounded-md bg-white/10 border border-white/20 hidden sm:flex items-center justify-center text-[13px] font-bold tracking-tight"
            >
              AR
            </span>
            <div className="leading-tight min-w-0">
              <div className="text-[15px] font-bold tracking-tight">ARKA</div>
              <div className="text-[11px] text-white/70 hidden sm:block whitespace-nowrap">
                Geospatial Situational Awareness Platform
              </div>
            </div>
          </div>
        </div>

        <div className="hidden lg:block h-8 w-px bg-white/20 shrink-0" aria-hidden="true" />

        {/* --- Jurisdiction --- */}
        <div className="hidden lg:flex items-center gap-1.5 text-[12px] shrink-0">
          <MapPin className="w-3.5 h-3.5 text-white/60" aria-hidden="true" />
          <span className="text-white/60">Jurisdiction:</span>
          <span className="font-semibold">Bhubaneswar (BMC), Odisha</span>
        </div>

        <div className="flex-1 min-w-2" />

        {/* --- Date & time --- */}
        <div className="hidden md:flex flex-col items-end leading-tight shrink-0 pr-1">
          <span className="text-[11px] text-white/70">{currentDate}</span>
          <span className="gov-mono text-[12px] font-semibold tabular-nums">{currentTime}</span>
        </div>

        {/* --- System status --- */}
        <button
          type="button"
          onClick={() => setShowHealthModal(true)}
          title="Open connection health and stream diagnostics"
          className="gov-btn gov-btn-onnavy gov-btn-sm shrink-0"
        >
          {allStreamsUp ? (
            <CheckCircle2 className="w-3.5 h-3.5" aria-hidden="true" />
          ) : (
            <AlertTriangle className="w-3.5 h-3.5" aria-hidden="true" />
          )}
          <span className="hidden sm:inline">
            {allStreamsUp ? 'Systems normal' : 'Systems degraded'}
          </span>
          <span className="gov-mono text-[11px] text-white/80">
            {activeConnectedCount}/{totalStreamsCount}
          </span>
        </button>

        {/* --- Threat level --- */}
        <div className="relative shrink-0">
          <button
            type="button"
            onClick={() => toggle('threat')}
            aria-expanded={openPopover === 'threat'}
            aria-haspopup="menu"
            className="gov-btn gov-btn-onnavy gov-btn-sm"
            title="Set city-wide alert level"
          >
            <ShieldAlert className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="hidden sm:inline text-white/80">Alert level</span>
            <span className={`gov-badge ${threatBadgeClass(threatLevel)}`}>{threatLevel}</span>
            <ChevronDown className="w-3 h-3 opacity-70" aria-hidden="true" />
          </button>

          {openPopover === 'threat' && (
            <div role="menu" className="absolute right-0 top-full mt-2 w-44 gov-panel p-1 z-50">
              <p className="gov-label px-2 py-1">City alert level</p>
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]).map((lvl) => (
                <button
                  key={lvl}
                  role="menuitemradio"
                  aria-checked={threatLevel === lvl}
                  onClick={() => {
                    setThreatLevel(lvl);
                    setOpenPopover(null);
                  }}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-md text-[13px] text-left hover:bg-sunken ${
                    threatLevel === lvl ? 'text-accent font-semibold' : 'text-ink'
                  }`}
                >
                  <span>{lvl}</span>
                  {threatLevel === lvl && <CheckCircle2 className="w-4 h-4" aria-hidden="true" />}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* --- Weather + provenance --- */}
        <div className="relative shrink-0 hidden md:block">
          <button
            type="button"
            onClick={() => toggle('weather')}
            aria-expanded={openPopover === 'weather'}
            className="gov-btn gov-btn-onnavy gov-btn-sm"
            title="Bhubaneswar weather and data provenance"
          >
            <span className="text-white/70">Weather</span>
            <span className="gov-mono font-semibold">
              {weather.temperature}°C · {weather.humidity}% RH
            </span>
            <Info className="w-3.5 h-3.5 opacity-80" aria-hidden="true" />
          </button>

          {openPopover === 'weather' && (
            <div className="absolute right-0 top-full mt-2 w-80 gov-panel z-50">
              <div className="gov-panel-head">
                <span className="gov-title">Data provenance</span>
                <span className={`gov-tag ${
                  weather.provenance?.classification === 'LIVE' ? 'is-live' :
                  weather.provenance?.classification === 'CACHED' ? 'is-info' : 'is-high'
                }`}>
                  {weather.provenance?.classification || 'LIVE'}
                </span>
              </div>
              <dl className="p-3 space-y-1.5 text-[12px]">
                {[
                  ['Source', weather.provenance?.source || 'Open-Meteo & IMD radar'],
                  ['Provider', weather.provenance?.provider || 'IMD Bhubaneswar'],
                  ['Confidence', `${weather.provenance?.confidence ?? 98}%`],
                  ['Latency', `${weather.provenance?.latencyMs ?? 18} ms`],
                  ['Last sync', weather.provenance?.lastUpdated || new Date().toLocaleTimeString()],
                  ['Condition', weather.condition],
                ].map(([k, v]) => (
                  <div key={k} className="flex items-start justify-between gap-3">
                    <dt className="text-ink-muted">{k}</dt>
                    <dd className="text-ink font-medium text-right gov-mono">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        {/* --- Refresh --- */}
        <button
          type="button"
          onClick={onRefreshAll}
          className="gov-btn gov-btn-onnavy gov-btn-sm shrink-0"
          title="Refresh all feeds"
          aria-label="Refresh all feeds"
        >
          <RefreshCw className="w-3.5 h-3.5" aria-hidden="true" />
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
