import React, { useState, useEffect } from 'react';
import { Database, Activity, RefreshCw, Cpu, ShieldCheck, AlertCircle, Info } from 'lucide-react';
import type { DataFabricSource } from '../../types';

export const DataFabricView: React.FC = () => {
  const [sources, setSources] = useState<DataFabricSource[]>([]);
  const [overallHealth, setOverallHealth] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  const fetchHealth = () => {
    setLoading(true);
    fetch('/api/data-fabric/health')
      .then((res) => res.json())
      .then((data) => {
        setSources(data.sources || []);
        setOverallHealth(data.overallHealthPct || 0);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Database className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              UNIFIED CITY DATA FABRIC & SOURCE HEALTH
            </h2>
            <p className="text-xs text-zinc-400">
              Centralized data-fusion layer bringing together all 17+ Bhubaneswar city telemetry feeds
            </p>
          </div>
        </div>

        <button
          onClick={fetchHealth}
          className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-xs font-mono text-zinc-300 rounded flex items-center gap-1.5 transition"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh Data Health
        </button>
      </div>

      {/* Health Overview Bar */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-lg font-mono text-xs">
          <span className="text-zinc-500 block">SYSTEM DATA FABRIC HEALTH</span>
          <span className="text-2xl font-bold text-emerald-400">{overallHealth}%</span>
          <span className="text-[11px] text-zinc-400 block mt-1">17/17 Data Ingestion Pipelines Monitored</span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-lg font-mono text-xs">
          <span className="text-zinc-500 block">ACTIVE TELEMETRY FEEDS</span>
          <span className="text-2xl font-bold text-orange-400">
            {sources.filter((s) => s.status === 'ACTIVE').length} Active
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Real-Time Ingestion Active</span>
        </div>

        <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-lg font-mono text-xs">
          <span className="text-zinc-500 block">UNAVAILABLE / INTEGRATION REQ</span>
          <span className="text-2xl font-bold text-amber-400">
            {sources.filter((s) => s.status === 'UNAVAILABLE').length} Pending
          </span>
          <span className="text-[11px] text-zinc-400 block mt-1">Explicitly marked (No fake data)</span>
        </div>
      </div>

      {/* Source Health Table */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg overflow-hidden flex-1 flex flex-col">
        <div className="p-3 bg-zinc-900 border-b border-zinc-800 text-xs font-mono text-zinc-400 grid grid-cols-12 gap-2 uppercase tracking-wider">
          <span className="col-span-4">DATA SOURCE NAME</span>
          <span className="col-span-2">CATEGORY</span>
          <span className="col-span-2">STATUS</span>
          <span className="col-span-2">FREQ / LATENCY</span>
          <span className="col-span-2 text-right">PROVENANCE / PROVIDER</span>
        </div>

        <div className="divide-y divide-zinc-800/80 flex-1 overflow-y-auto">
          {sources.map((src) => (
            <div key={src.id} className="p-3 grid grid-cols-12 gap-2 items-center text-xs font-mono hover:bg-zinc-900/40 transition">
              <div className="col-span-4">
                <span className="font-bold text-zinc-200 block">{src.name}</span>
                {src.note && <span className="text-[10px] text-amber-400">{src.note}</span>}
              </div>

              <div className="col-span-2 text-zinc-400">
                {src.category}
              </div>

              <div className="col-span-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                  src.status === 'ACTIVE' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  src.status === 'CONNECTED' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  src.status === 'UNAVAILABLE' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                  'bg-zinc-800 text-zinc-400 border-zinc-700'
                }`}>
                  {src.status}
                </span>
              </div>

              <div className="col-span-2 text-zinc-300">
                {src.updateFrequencySec > 0 ? `${src.updateFrequencySec}s sync` : 'N/A'} • {src.latencyMs}ms
              </div>

              <div className="col-span-2 text-right text-zinc-400 text-[11px]">
                {src.provenance.provider}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
