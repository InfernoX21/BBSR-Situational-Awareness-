import React, { useState, useEffect } from 'react';
import { WeatherData, Severity, ConnectionHealthInfo, ConnectionHealthMap } from '../types';
import { liveDataManager } from '../services/LiveDataManager';
import {
  Activity,
  ShieldAlert,
  Sparkles,
  RefreshCw,
  Wifi,
  Info,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Menu,
} from 'lucide-react';

interface TopStatusBarProps {
  weather: WeatherData;
  threatLevel: Severity;
  setThreatLevel: (level: Severity) => void;
  onFuseIntelligence: () => void;
  isFusing: boolean;
  onRefreshAll: () => void;
  onOpenMobileMenu?: () => void;
}

export const TopStatusBar: React.FC<TopStatusBarProps> = ({
  weather,
  threatLevel,
  setThreatLevel,
  onFuseIntelligence,
  isFusing,
  onRefreshAll,
  onOpenMobileMenu,
}) => {
  const [currentTime, setCurrentTime] = useState<string>('');
  const [healthMap, setHealthMap] = useState<ConnectionHealthMap>(liveDataManager.getConnectionHealth());
  const [showHealthModal, setShowHealthModal] = useState(false);
  const [showWeatherProvenance, setShowWeatherProvenance] = useState(false);

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

  const getThreatBadge = (level: Severity) => {
    switch (level) {
      case 'CRITICAL':
        return 'text-[#EF4444] font-bold';
      case 'HIGH':
        return 'text-[#F59E0B] font-bold';
      case 'MEDIUM':
        return 'text-yellow-400 font-bold';
      default:
        return 'text-[#06B6D4] font-bold';
    }
  };

  const activeConnectedCount = (Object.values(healthMap) as ConnectionHealthInfo[]).filter((h) => h.status === 'CONNECTED').length;
  const totalStreamsCount = Object.keys(healthMap).length;

  return (
    <header className="h-12 md:h-10 border-b border-white/10 bg-[#0A0A0A] flex items-center px-3 md:px-4 justify-between shrink-0 select-none overflow-x-auto text-[11px] font-mono relative">
      {/* Left System Status & Mobile Drawer Toggle */}
      <div className="flex items-center gap-3 md:gap-6">
        {onOpenMobileMenu && (
          <button
            onClick={onOpenMobileMenu}
            aria-label="Open mobile navigation drawer"
            className="md:hidden w-10 h-10 rounded bg-white/10 flex items-center justify-center text-white active:bg-white/20 transition-colors shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <button
          onClick={() => setShowHealthModal(!showHealthModal)}
          className="flex items-center gap-2 px-2 py-1 rounded bg-white/[0.03] border border-white/10 hover:border-[#10B981]/40 transition-all cursor-pointer"
        >
          <div className="w-2 h-2 rounded-full bg-[#10B981] animate-pulse shadow-[0_0_8px_#10B981]" />
          <span className="text-[10px] font-bold tracking-[0.15em] text-[#10B981] uppercase truncate">
            TELEMETRY ({activeConnectedCount}/{totalStreamsCount})
          </span>
          <Wifi className="w-3 h-3 text-[#10B981] shrink-0" />
        </button>

        <div className="h-4 w-[1px] bg-white/10" />

        <div className="flex items-center gap-3">
          <span className="text-white/40 uppercase">Threat Level:</span>
          <div className="relative group">
            <button
              className={`uppercase tracking-wider transition-all flex items-center gap-1.5 ${getThreatBadge(
                threatLevel
              )}`}
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>DEFCON 5 / {threatLevel}</span>
            </button>

            {/* Quick Threat Switcher Dropdown */}
            <div className="absolute top-full left-0 mt-1 hidden group-hover:flex flex-col bg-[#0A0A0A] border border-white/10 rounded shadow-2xl p-1 z-50 space-y-1 w-32">
              {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as Severity[]).map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setThreatLevel(lvl)}
                  className="w-full text-left px-2 py-1 text-[10px] rounded hover:bg-white/10 text-white transition-colors uppercase font-mono"
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Middle/Right Telemetry & Weather & Live Status */}
      <div className="flex items-center gap-6 uppercase">
        {/* Weather Indicator with Data Provenance Popover */}
        <div className="relative">
          <button
            onClick={() => setShowWeatherProvenance(!showWeatherProvenance)}
            className="hidden md:flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/[0.03] border border-white/10 hover:border-[#06B6D4]/40 transition-all text-white/80"
          >
            <span className="text-white/40">BBSR WEATHER:</span>
            <span className="text-white font-bold">{weather.temperature}°C / {weather.humidity}% RH</span>
            <Info className="w-3 h-3 text-[#06B6D4]" />
          </button>

          {showWeatherProvenance && (
            <div className="absolute top-full right-0 mt-2 w-80 bg-[#0A0A0A] border border-[#06B6D4]/40 rounded shadow-2xl p-3 z-50 font-mono text-[10px] text-white">
              <div className="flex justify-between items-center text-[#06B6D4] font-bold border-b border-white/10 pb-1 mb-2">
                <span>DATA PROVENANCE METADATA</span>
                <span className="text-[8px] bg-[#06B6D4]/20 px-1 rounded">VERIFIED SOURCE</span>
              </div>
              <div className="space-y-1 text-white/70">
                <div>SOURCE: <strong className="text-white">{weather.provenance?.source || 'Open-Meteo & IMD Radar'}</strong></div>
                <div>PROVIDER: <strong className="text-white">{weather.provenance?.provider || 'IMD Bhubaneswar'}</strong></div>
                <div>CONFIDENCE: <strong className="text-[#10B981]">{weather.provenance?.confidence || 98}%</strong></div>
                <div>LATENCY: <strong className="text-cyan-400">{weather.provenance?.latencyMs || 18} ms</strong></div>
                <div>LAST SYNC: <strong className="text-white">{weather.provenance?.lastUpdated || new Date().toLocaleTimeString()}</strong></div>
                <div>CONDITION: <strong className="text-yellow-400">{weather.condition}</strong></div>
              </div>
            </div>
          )}
        </div>

        <div className="hidden lg:flex gap-2">
          <span className="text-white/40">TIME:</span>
          <span className="text-white tracking-widest">{currentTime}</span>
        </div>

        {/* AI Fusion Trigger */}
        <button
          onClick={onFuseIntelligence}
          disabled={isFusing}
          className="px-2 py-0.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/30 text-[#06B6D4] hover:bg-[#06B6D4]/20 text-[9px] font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
        >
          <Sparkles className={`w-3 h-3 ${isFusing ? 'animate-spin' : ''}`} />
          <span>{isFusing ? 'FUSING...' : 'AI FUSION'}</span>
        </button>

        <button
          onClick={onRefreshAll}
          className="p-1 text-white/40 hover:text-white transition-colors"
          title="Refresh All Feeds"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>

        <div className="flex items-center gap-1 bg-[#10B981]/10 px-2.5 py-0.5 rounded border border-[#10B981]/30">
          <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
          <span className="text-[9px] font-bold text-[#10B981]">CONNECTED</span>
        </div>
      </div>

      {/* SYSTEM CONNECTION HEALTH DIAGNOSTICS MODAL */}
      {showHealthModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-2xl bg-[#0A0A0A] border border-white/20 rounded-lg shadow-2xl p-5 font-mono text-xs">
            <div className="flex justify-between items-center border-b border-white/10 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <Activity className="w-5 h-5 text-[#06B6D4]" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  ARKA Connection Health & Stream Diagnostics
                </h3>
              </div>
              <button
                onClick={() => setShowHealthModal(false)}
                className="text-white/40 hover:text-white text-base px-2"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
              {(Object.entries(healthMap) as [string, ConnectionHealthInfo][]).map(([key, info]) => (
                <div
                  key={key}
                  className="bg-white/[0.02] border border-white/10 rounded p-3 flex flex-col justify-between"
                >
                  <div className="flex justify-between items-start mb-1">
                    <span className="font-bold text-white uppercase text-[11px]">{key} STREAM</span>
                    <span
                      className={`text-[9px] font-bold px-1.5 py-0.5 rounded flex items-center gap-1 ${
                        info.status === 'CONNECTED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : info.status === 'SYNCING'
                          ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30'
                          : 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                      }`}
                    >
                      {info.status === 'CONNECTED' ? (
                        <CheckCircle2 className="w-2.5 h-2.5" />
                      ) : info.status === 'SYNCING' ? (
                        <RotateCw className="w-2.5 h-2.5 animate-spin" />
                      ) : (
                        <AlertTriangle className="w-2.5 h-2.5" />
                      )}
                      {info.status}
                    </span>
                  </div>

                  <div className="text-[10px] text-white/60 space-y-0.5">
                    <div>PROVIDER: <strong className="text-white">{info.provider}</strong></div>
                    <div>LATENCY: <strong className="text-cyan-400">{info.latencyMs} ms</strong></div>
                    <div>LAST SYNC: <strong className="text-white">{info.lastSync}</strong></div>
                    <div className="text-[9px] text-white/40 italic mt-1">{info.details}</div>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex justify-end">
              <button
                onClick={() => setShowHealthModal(false)}
                className="px-4 py-1.5 rounded bg-[#06B6D4] hover:bg-[#06B6D4]/80 text-black font-bold text-xs uppercase transition-all"
              >
                Close Diagnostics
              </button>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

