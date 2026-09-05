import React from 'react';
import { X, ShieldCheck, Cpu, Database, Info, Layers } from 'lucide-react';
import type { ExplainableIntelligenceCard } from '../types';

interface Props {
  card: ExplainableIntelligenceCard | null;
  onClose: () => void;
}

export const ProvenanceModal: React.FC<Props> = ({ card, onClose }) => {
  if (!card) return null;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-lg max-w-xl w-full p-6 text-zinc-100 shadow-2xl space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-semibold font-mono tracking-wide">
              PROVENANCE & TRUST: WHY AM I SEEING THIS?
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Classification Badge */}
        <div className="flex items-center justify-between bg-zinc-900/80 p-3 rounded border border-zinc-800">
          <div>
            <span className="text-xs text-zinc-400 font-mono block">DATA CLASSIFICATION</span>
            <span className="text-sm font-bold font-mono text-orange-400 tracking-wider">
              {card.classification}
            </span>
          </div>
          <div className="text-right">
            <span className="text-xs text-zinc-400 font-mono block">MODEL CONFIDENCE</span>
            <span className="text-sm font-bold font-mono text-emerald-400">{card.confidencePct}%</span>
          </div>
        </div>

        {/* Situation & Evidence */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-1">
            <Info className="w-3.5 h-3.5 text-orange-400" />
            Situation Statement
          </h4>
          <p className="text-sm text-zinc-200 bg-zinc-900/40 p-3 rounded border border-zinc-800">
            {card.situation}
          </p>
        </div>

        {/* Raw Data Sources */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-1">
            <Database className="w-3.5 h-3.5 text-blue-400" />
            Raw Data Sources & Feed Provenance
          </h4>
          <div className="space-y-1">
            {card.dataSources.map((src, idx) => (
              <div
                key={idx}
                className="bg-zinc-900/60 p-2 rounded border border-zinc-800 text-xs font-mono text-zinc-300 flex items-center justify-between"
              >
                <span>{src}</span>
                <span className="text-emerald-400 font-sans text-[10px]">VERIFIED FEED</span>
              </div>
            ))}
          </div>
        </div>

        {/* Model Logic & Evidence */}
        <div className="space-y-2">
          <h4 className="text-xs font-mono text-zinc-400 uppercase flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5 text-purple-400" />
            Supporting Evidence & Transformation Logic
          </h4>
          <ul className="list-disc list-inside text-xs text-zinc-300 space-y-1 bg-zinc-900/40 p-3 rounded border border-zinc-800">
            {card.evidence.map((item, idx) => (
              <li key={idx}>{item}</li>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-zinc-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-mono rounded transition"
          >
            Close Provenance Explorer
          </button>
        </div>
      </div>
    </div>
  );
};
