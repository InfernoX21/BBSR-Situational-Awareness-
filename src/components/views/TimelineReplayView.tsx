import React, { useState } from 'react';
import { History, Play, Pause, RotateCcw, Filter, Calendar } from 'lucide-react';

export const TimelineReplayView: React.FC = () => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(30);

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <History className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              TIMELINE & EVENT MAP REPLAY
            </h2>
            <p className="text-xs text-zinc-400">
              Inspect historical city events chronologically: What happened before &rarr; What happened &rarr; What happened after
            </p>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-lg space-y-4 font-mono text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsPlaying(!isPlaying)}
              className="p-2 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold rounded transition flex items-center gap-1.5"
            >
              {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 fill-current" />}
              {isPlaying ? 'PAUSE REPLAY' : 'PLAY EVENT REPLAY'}
            </button>
            <button
              onClick={() => setCurrentTime(0)}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 rounded transition"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          <span className="text-orange-400 font-bold">
            REPLAY MOMENT: T + {currentTime} MINS
          </span>
        </div>

        {/* Timeline Slider */}
        <input
          type="range"
          min="0"
          max="60"
          value={currentTime}
          onChange={(e) => setCurrentTime(parseInt(e.target.value, 10))}
          className="w-full accent-orange-500 cursor-pointer"
        />
      </div>

      {/* Historical Stream */}
      <div className="space-y-2 flex-1">
        <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
          Chronological Event Sequence
        </h3>

        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3 font-mono text-xs">
          <div className="p-3 bg-zinc-950 rounded border border-zinc-800 flex justify-between items-center">
            <div>
              <span className="text-zinc-500">T - 15 MINS</span>
              <p className="font-bold text-zinc-200 mt-0.5">Heavy Rain Radar Alert Issued by IMD</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-400 text-[10px]">WEATHER</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded border border-orange-500/40 flex justify-between items-center">
            <div>
              <span className="text-zinc-500">T + 00 MINS</span>
              <p className="font-bold text-orange-400 mt-0.5">Multi-Vehicle Collision at Jayadev Vihar Overbridge</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 text-[10px]">CRITICAL</span>
          </div>

          <div className="p-3 bg-zinc-950 rounded border border-zinc-800 flex justify-between items-center">
            <div>
              <span className="text-zinc-500">T + 06 MINS</span>
              <p className="font-bold text-zinc-200 mt-0.5">Operator Patnaik Executed ATCS Signal Diversion</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 text-[10px]">ACTION</span>
          </div>
        </div>
      </div>
    </div>
  );
};
