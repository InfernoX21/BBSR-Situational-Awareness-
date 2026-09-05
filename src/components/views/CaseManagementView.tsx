import React from 'react';
import { FolderKanban, MapPin, Clock, AlertTriangle, ShieldCheck, FileText, User, Share2 } from 'lucide-react';
import { arkaNav } from '../../store/useArka';

export const CaseManagementView: React.FC = () => {
  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <FolderKanban className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              INCIDENT CASE WORKSPACE — INCIDENT #ARKA-9021
            </h2>
            <p className="text-xs text-zinc-400">
              Single consolidated operational workspace for major city incidents in Bhubaneswar
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-red-500/20 text-red-400 border border-red-500/30">
            SEVERITY: CRITICAL
          </span>
          <span className="px-2.5 py-1 text-xs font-mono rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
            STATUS: ACTIVE DIVERSION
          </span>
        </div>
      </div>

      {/* Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1">
        {/* Left Column: Summary & Evidence */}
        <div className="space-y-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3 font-mono text-xs">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider">
              Incident Metadata
            </h3>
            <div className="space-y-1.5 border-t border-zinc-800 pt-2 text-zinc-300">
              <p><span className="text-zinc-500">Case Ref:</span> INCIDENT #ARKA-9021</p>
              <p><span className="text-zinc-500">Category:</span> MULTI-VEHICLE COLLISION & SPILL</p>
              <p><span className="text-zinc-500">Location:</span> Jayadev Vihar Overbridge, NH-16</p>
              <p><span className="text-zinc-500">Coordinates:</span> 20.2961° N, 85.8245° E</p>
              <p><span className="text-zinc-500">Assigned Units:</span> 108 ALS-04, Fire Tender VT-01, PCR Delta-4</p>
              <p><span className="text-zinc-500">Operators:</span> A.Patnaik (Traffic), S.Mohanty (Disaster)</p>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3 font-mono text-xs">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider">
              Evidence & Data Feeds
            </h3>
            <div className="space-y-1.5">
              <div className="p-2 bg-zinc-950 rounded border border-zinc-800 text-zinc-300 flex justify-between">
                <span>CCTV Cam #101 Feed</span>
                <span className="text-emerald-400">VERIFIED CV</span>
              </div>
              <div className="p-2 bg-zinc-950 rounded border border-zinc-800 text-zinc-300 flex justify-between">
                <span>BSCL Loop Sensor #42</span>
                <span className="text-emerald-400">14 KM/H CONGESTION</span>
              </div>
              <div className="p-2 bg-zinc-950 rounded border border-zinc-800 text-zinc-300 flex justify-between">
                <span>108 Telemetry Stream</span>
                <span className="text-amber-400">PATIENT EN ROUTE</span>
              </div>
            </div>
          </div>
        </div>

        {/* Center & Right Column: Timeline & Intelligence */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3">
            <h3 className="text-xs font-mono font-bold text-orange-400 uppercase tracking-wider flex items-center justify-between">
              <span>Chronological Incident Timeline</span>
              <button
                onClick={() => arkaNav.goTo('Timeline Replay')}
                className="text-[11px] text-orange-400 hover:underline font-normal"
              >
                Open Map Replay &rarr;
              </button>
            </h3>

            <div className="space-y-2 border-l border-zinc-800 pl-4 text-xs font-mono">
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-red-500" />
                <span className="text-zinc-500">12:00:15 PM</span> — <span className="text-zinc-200 font-bold">Collision Detected</span> by Junction CCTV Cam #101 AI model.
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-orange-500" />
                <span className="text-zinc-500">12:02:40 PM</span> — <span className="text-zinc-200 font-bold">Event Escalated</span> to State Emergency Dispatch & 108 ALS Squad #04.
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-amber-500" />
                <span className="text-zinc-500">12:05:10 PM</span> — <span className="text-zinc-200 font-bold">Simulation Executed</span>: Option B Janpath Green Wave evaluated.
              </div>
              <div className="relative">
                <span className="absolute -left-[21px] top-1 w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span className="text-zinc-500">12:06:00 PM</span> — <span className="text-zinc-200 font-bold">Action Executed</span> by Operator Patnaik. Signal override active on Janpath link.
              </div>
            </div>
          </div>

          <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3 font-mono text-xs">
            <h3 className="text-xs font-bold text-orange-400 uppercase tracking-wider">
              Post-Incident Analysis Summary
            </h3>
            <p className="text-zinc-300 leading-relaxed bg-zinc-950 p-3 rounded border border-zinc-800">
              Integrated response prevented secondary bottleneck on NH-16 northbound link. ATCS green wave phase extension saved 14.3 minutes of emergency transport time to Capital Hospital Trauma Ward.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
