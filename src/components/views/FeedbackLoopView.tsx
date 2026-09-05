import React, { useState, useEffect } from 'react';
import { RotateCcw, CheckCircle2, TrendingUp, TrendingDown, BookOpen, Activity, ArrowRight } from 'lucide-react';
import type { FeedbackRecord } from '../../types';
import { useOperationalStore } from '../../store/useOperationalStore';

export const FeedbackLoopView: React.FC = () => {
  const { feedbackTimeline } = useOperationalStore();
  const [items, setItems] = useState<FeedbackRecord[]>(feedbackTimeline);

  useEffect(() => {
    fetch('/api/feedback-loop')
      .then((res) => res.json())
      .then((data) => {
        if (data.timeline) {
          setItems(data.timeline);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              OPERATIONAL FEEDBACK LOOP & OUTCOME TIMELINE
            </h2>
            <p className="text-xs text-zinc-400">
              Evaluates expected vs actual telemetry post-action to continuously refine decision models
            </p>
          </div>
        </div>

        <span className="px-2.5 py-1 text-xs font-mono rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
          CLOSED-LOOP LEARNING ACTIVE
        </span>
      </div>

      {/* Operational Loop Diagram Banner */}
      <div className="bg-zinc-900/80 border border-zinc-800 p-3 rounded-lg flex items-center justify-between text-xs font-mono">
        <span className="text-zinc-400">OPERATIONAL FLYWHEEL:</span>
        <div className="flex items-center gap-1.5 text-zinc-300">
          <span>DATA</span>
          <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
          <span>INTELLIGENCE</span>
          <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
          <span>DECISION</span>
          <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
          <span>ACTION</span>
          <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
          <span>OUTCOME</span>
          <ArrowRight className="w-3.5 h-3.5 text-orange-400" />
          <span className="text-emerald-400 font-bold">LEARNING</span>
        </div>
      </div>

      {/* Feedback Items Timeline */}
      <div className="space-y-4 flex-1">
        {items.map((fb) => (
          <div key={fb.id} className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2 text-xs font-mono">
              <div className="flex items-center gap-2">
                <span className="text-orange-400 font-bold">{fb.incidentId}</span>
                <span className="text-zinc-500">|</span>
                <span className="text-zinc-300">ACTION #{fb.actionId}</span>
              </div>

              <div className="flex items-center gap-2">
                <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                  fb.outcomeGrade === 'EXCEEDED' ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' :
                  fb.outcomeGrade === 'MET' ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' :
                  'bg-red-500/20 text-red-400 border-red-500/30'
                }`}>
                  OUTCOME: {fb.outcomeGrade}
                </span>
                <span className="text-zinc-500">{new Date(fb.timestamp).toLocaleTimeString()}</span>
              </div>
            </div>

            <h4 className="text-sm font-semibold font-mono text-zinc-100">{fb.metricName}</h4>

            {/* Expected vs Actual Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono text-xs">
              <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                <span className="text-zinc-500 block text-[11px]">EXPECTED OUTCOME</span>
                <span className="text-zinc-200">{fb.expectedOutcome}</span>
              </div>

              <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                <span className="text-zinc-500 block text-[11px]">ACTUAL OUTCOME</span>
                <span className="text-emerald-400 font-bold">{fb.actualOutcome}</span>
              </div>

              <div className="bg-zinc-950 p-3 rounded border border-zinc-800">
                <span className="text-zinc-500 block text-[11px]">DEVIATION</span>
                <span className="text-orange-400 font-bold">
                  {fb.deviationPct > 0 ? `+${fb.deviationPct}%` : `${fb.deviationPct}%`}
                </span>
              </div>
            </div>

            {/* Lessons Learned */}
            <div className="p-3 bg-zinc-950/70 border border-zinc-800 rounded text-xs font-mono space-y-1">
              <span className="text-zinc-400 font-bold flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-orange-400" />
                SYSTEM LEARNINGS & MODEL RECALIBRATION:
              </span>
              <p className="text-zinc-300 leading-relaxed pl-5">{fb.lessonsLearned}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
