import React, { useState } from 'react';
import { Incident } from '../types';
import {
  X,
  AlertTriangle,
  MapPin,
  Clock,
  Shield,
  Sparkles,
  CheckCircle2,
  Send,
  Navigation,
  FileText,
  Radio,
} from 'lucide-react';

interface IncidentDetailModalProps {
  incident: Incident | null;
  onClose: () => void;
  onUpdateStatus: (incidentId: string, newStatus: Incident['status']) => void;
}

export const IncidentDetailModal: React.FC<IncidentDetailModalProps> = ({
  incident,
  onClose,
  onUpdateStatus,
}) => {
  if (!incident) return null;

  const [dispatchNote, setDispatchNote] = useState('');
  const [dispatchSuccess, setDispatchSuccess] = useState(false);

  const handleDispatch = (e: React.FormEvent) => {
    e.preventDefault();
    setDispatchSuccess(true);
    onUpdateStatus(incident.id, 'DISPATCHED');
    setTimeout(() => setDispatchSuccess(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-red-950 border border-red-500/60 text-red-400">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-mono text-xs text-cyan-400 font-bold">{incident.id}</span>
                <span className="text-xs font-mono text-slate-400">[{incident.category}]</span>
              </div>
              <h2 className="text-base font-bold text-slate-100">{incident.title}</h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-100"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Status & Priority Row */}
          <div className="grid grid-cols-3 gap-3 font-mono">
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[10px] block">PRIORITY</span>
              <span className="text-red-400 font-bold text-sm">{incident.priority}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[10px] block">STATUS</span>
              <span className="text-emerald-400 font-bold text-sm">{incident.status}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
              <span className="text-slate-400 text-[10px] block">AI CONFIDENCE</span>
              <span className="text-indigo-400 font-bold text-sm">{incident.aiConfidence}%</span>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1">
            <label className="text-[10px] font-mono text-slate-400 uppercase font-semibold">Operational Summary</label>
            <p className="p-3 rounded-lg bg-slate-950 border border-slate-800 text-slate-200 leading-relaxed text-xs">
              {incident.description}
            </p>
          </div>

          {/* Location & Infrastructure Metrics */}
          <div className="grid grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 font-mono">
              <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                <MapPin className="w-3.5 h-3.5 text-cyan-400" />
                <span>LOCATION & COORDINATES</span>
              </div>
              <div className="text-slate-100 font-bold">{incident.location.name}</div>
              <div className="text-slate-400 text-[10px]">{incident.location.address}</div>
              <div className="text-cyan-400 text-[10px] font-bold">
                {incident.location.lat.toFixed(4)}° N, {incident.location.lng.toFixed(4)}° E
              </div>
            </div>

            <div className="p-3 rounded-lg bg-slate-950 border border-slate-800 space-y-1 font-mono">
              <div className="text-[10px] text-slate-400 flex items-center space-x-1">
                <Shield className="w-3.5 h-3.5 text-emerald-400" />
                <span>ASSIGNED AGENCIES</span>
              </div>
              <div className="text-emerald-400 font-bold">{incident.agencyAssigned}</div>
              <div className="text-slate-400 text-[10px]">
                Dispatched Units: <span className="text-slate-100 font-bold">{incident.unitsDispatched || 2} Units</span>
              </div>
              <div className="text-amber-400 text-[10px]">
                Impact: {incident.estimatedImpact || 'Moderate congestion'}
              </div>
            </div>
          </div>

          {/* Recommended Action Card */}
          <div className="p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-700/80 space-y-1.5">
            <div className="flex items-center space-x-2 text-indigo-300 font-mono text-[11px] font-bold">
              <Sparkles className="w-4 h-4 text-indigo-400" />
              <span>ARKA AI TACTICAL RECOMMENDATION</span>
            </div>
            <p className="text-indigo-100 leading-relaxed text-xs">{incident.recommendedAction}</p>
          </div>

          {/* Inter-Agency Dispatch Form */}
          <form onSubmit={handleDispatch} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-2">
            <div className="flex items-center justify-between font-mono text-[11px]">
              <span className="text-slate-300 font-bold flex items-center space-x-1.5">
                <Radio className="w-3.5 h-3.5 text-cyan-400" />
                <span>DIRECT INTER-AGENCY DISPATCH INSTRUCTION</span>
              </span>
            </div>

            <textarea
              value={dispatchNote}
              onChange={(e) => setDispatchNote(e.target.value)}
              placeholder="Enter specific dispatch command or order for BMC / Police / Fire field units..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2.5 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-cyan-500 h-20 font-mono"
            />

            <div className="flex items-center justify-between pt-1">
              {dispatchSuccess ? (
                <span className="text-emerald-400 font-mono text-xs font-bold flex items-center space-x-1">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>DISPATCH COMMAND SENT TO COMMAND NETWORK</span>
                </span>
              ) : (
                <span className="text-slate-500 font-mono text-[10px]">Encrypt & transmit to field units</span>
              )}
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-cyan-950 hover:bg-cyan-900 border border-cyan-500/60 text-cyan-300 font-mono text-xs font-bold flex items-center space-x-2 transition-all shadow-lg"
              >
                <Send className="w-3.5 h-3.5" />
                <span>TRANSMIT DISPATCH</span>
              </button>
            </div>
          </form>
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex items-center justify-between">
          <div className="flex space-x-2 font-mono text-xs">
            <button
              onClick={() => onUpdateStatus(incident.id, 'CONTAINED')}
              className="px-3 py-1.5 rounded bg-amber-950/60 hover:bg-amber-900/60 text-amber-300 border border-amber-800/60"
            >
              MARK CONTAINED
            </button>
            <button
              onClick={() => onUpdateStatus(incident.id, 'RESOLVED')}
              className="px-3 py-1.5 rounded bg-emerald-950/60 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-800/60"
            >
              MARK RESOLVED
            </button>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono text-xs"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
};
