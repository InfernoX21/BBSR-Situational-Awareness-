import React, { useState, useEffect } from 'react';
import { Cpu, AlertTriangle, MapPin, Clock, ShieldAlert, CheckCircle2, ArrowRight } from 'lucide-react';
import type { CityEvent } from '../../types';
import { operationalStore } from '../../store/useOperationalStore';

export const EventEngineView: React.FC = () => {
  const [events, setEvents] = useState<CityEvent[]>([]);

  useEffect(() => {
    fetch('/api/events')
      .then((res) => res.json())
      .then((data) => {
        if (data.events) setEvents(data.events);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              CENTRALIZED CITY EVENT ENGINE
            </h2>
            <p className="text-xs text-zinc-400">
              Standardized real-time event pipeline ingesting telemetry from CV, sensors, APIs, and operators
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 text-xs font-mono rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
          EVENT STREAM ACTIVE ({events.length})
        </span>
      </div>

      {/* Events List */}
      <div className="space-y-4 flex-1">
        {events.map((evt) => (
          <div key={evt.id} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3 font-mono text-xs">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                  evt.severity === 'CRITICAL' ? 'bg-red-500/20 text-red-400 border-red-500/30' : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                }`}>
                  SEVERITY: {evt.severity}
                </span>
                <span className="text-orange-400 font-bold">{evt.title}</span>
              </div>

              <div className="flex items-center gap-2 text-zinc-400">
                <span>{(evt.confidence * 100).toFixed(0)}% CONFIDENCE</span>
                <span>•</span>
                <span>{new Date(evt.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            {/* Standard Event Structure */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-zinc-950 p-3 rounded border border-zinc-800">
              <div>
                <span className="text-zinc-500 block text-[10px]">WHAT HAPPENED?</span>
                <p className="text-zinc-200">{evt.what}</p>
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px]">WHERE & WHEN?</span>
                <p className="text-zinc-200">{evt.where} ({evt.when})</p>
              </div>

              <div>
                <span className="text-zinc-500 block text-[10px]">SOURCE FEED</span>
                <p className="text-orange-400">{evt.source}</p>
              </div>
            </div>

            <div className="p-2.5 bg-zinc-950/70 border border-zinc-800 rounded text-zinc-300">
              <span className="text-zinc-500 block text-[10px]">EVALUATION & RECOMMENDED ANALYSIS:</span>
              <p className="text-zinc-200 mt-0.5">{evt.evaluationNotes}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
