import React from 'react';
import { X, ExternalLink, Activity, MapPin, ShieldAlert, Cpu, Share2, Layers } from 'lucide-react';
import type { CityEntity } from '../types';
import { operationalStore } from '../store/useOperationalStore';

interface Props {
  entity: CityEntity | null;
  onClose: () => void;
}

export const EntityIntelligencePanel: React.FC<Props> = ({ entity, onClose }) => {
  if (!entity) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-zinc-950/95 border-l border-zinc-800 text-zinc-100 z-50 shadow-2xl flex flex-col backdrop-blur-md">
      {/* Header */}
      <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/50">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-xs font-mono font-semibold rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
            {entity.type}
          </span>
          <span className="text-xs font-mono text-zinc-400">{entity.id}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-5">
        {/* Title & Status */}
        <div>
          <h3 className="text-base font-semibold text-zinc-100">{entity.name}</h3>
          <div className="mt-1 flex items-center gap-2 text-xs">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-zinc-300 font-mono">STATUS: {entity.status}</span>
          </div>
          {entity.address && (
            <p className="text-xs text-zinc-400 flex items-center gap-1 mt-1">
              <MapPin className="w-3.5 h-3.5 text-zinc-500" />
              {entity.address}
            </p>
          )}
        </div>

        {/* Geospatial Coordinates */}
        {entity.lat && entity.lng && (
          <div className="bg-zinc-900/70 p-3 rounded border border-zinc-800 flex items-center justify-between text-xs font-mono">
            <span className="text-zinc-400">COORDINATES</span>
            <span className="text-orange-400 font-semibold">{entity.lat.toFixed(4)}° N, {entity.lng.toFixed(4)}° E</span>
          </div>
        )}

        {/* Provenance & Trust Card */}
        <div className="bg-zinc-900/70 p-3 rounded border border-zinc-800 space-y-2">
          <div className="flex items-center justify-between text-xs font-mono border-b border-zinc-800 pb-2">
            <span className="text-zinc-400 flex items-center gap-1">
              <Cpu className="w-3.5 h-3.5 text-orange-400" />
              PROVENANCE
            </span>
            <span className="text-emerald-400">{(entity.provenance.confidence * 100).toFixed(0)}% CONFIDENCE</span>
          </div>
          <div className="text-xs space-y-1 text-zinc-300">
            <p><span className="text-zinc-500">Source:</span> {entity.provenance.source}</p>
            <p><span className="text-zinc-500">Provider:</span> {entity.provenance.provider}</p>
            <p><span className="text-zinc-500">Latency:</span> {entity.provenance.latencyMs} ms</p>
            <p><span className="text-zinc-500 font-mono text-[10px]">Updated:</span> {new Date(entity.provenance.lastUpdated).toLocaleTimeString()}</p>
          </div>
        </div>

        {/* Connected Entities in Knowledge Graph */}
        <div>
          <h4 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Share2 className="w-3.5 h-3.5 text-orange-400" />
            Connected City Graph ({entity.connectedEntityIds.length})
          </h4>
          <div className="space-y-1.5">
            {entity.connectedEntityIds.map((connectedId) => (
              <div
                key={connectedId}
                className="p-2 bg-zinc-900/60 rounded border border-zinc-800 text-xs flex items-center justify-between hover:border-zinc-700 cursor-pointer"
              >
                <span className="font-mono text-zinc-300">{connectedId}</span>
                <span className="text-[10px] font-mono text-orange-400/80">LINKED</span>
              </div>
            ))}
          </div>
        </div>

        {/* Entity Attributes */}
        <div>
          <h4 className="text-xs font-mono text-zinc-400 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Layers className="w-3.5 h-3.5 text-orange-400" />
            Live Attributes
          </h4>
          <div className="bg-zinc-900/40 rounded border border-zinc-800 p-2 text-xs space-y-1 font-mono">
            {Object.entries(entity.attributes || {}).map(([key, val]) => (
              <div key={key} className="flex justify-between py-0.5 border-b border-zinc-800/50 last:border-0">
                <span className="text-zinc-500">{key}</span>
                <span className="text-zinc-200">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="pt-2 border-t border-zinc-800 space-y-2">
          <button
            onClick={() => {
              operationalStore.addAuditLog('Operator', 'INSPECTED_ENTITY', `Inspected ${entity.name}`, entity.id);
              alert(`Simulation context initialized for ${entity.name}`);
            }}
            className="w-full py-2 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-semibold rounded text-xs transition flex items-center justify-center gap-1.5 shadow"
          >
            <Activity className="w-3.5 h-3.5" />
            Run What-If Rerouting Simulation
          </button>
        </div>
      </div>
    </div>
  );
};
