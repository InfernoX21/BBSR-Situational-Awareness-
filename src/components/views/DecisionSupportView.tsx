import React, { useState, useEffect } from 'react';
import { Activity, CheckSquare, AlertTriangle, ShieldCheck, ArrowRight, UserCheck, ChevronRight } from 'lucide-react';
import type { DecisionRecommendation, DecisionOption } from '../../types';
import { operationalStore, useOperationalStore } from '../../store/useOperationalStore';

export const DecisionSupportView: React.FC = () => {
  const { activeRecommendation, role } = useOperationalStore();
  const [recommendation, setRecommendation] = useState<DecisionRecommendation | null>(activeRecommendation);
  const [selectedOptionId, setSelectedOptionId] = useState<string>('opt-b');

  useEffect(() => {
    if (!activeRecommendation) {
      fetch('/api/decision-support')
        .then((res) => res.json())
        .then((data) => {
          if (data.recommendations && data.recommendations.length > 0) {
            setRecommendation(data.recommendations[0]);
          }
        });
    } else {
      setRecommendation(activeRecommendation);
    }
  }, [activeRecommendation]);

  if (!recommendation) {
    return (
      <div className="h-full bg-zinc-950 text-zinc-100 flex items-center justify-center p-8 text-xs font-mono text-zinc-500">
        Loading Decision Support Center...
      </div>
    );
  }

  const handleApprove = (optionId: string) => {
    operationalStore.approveRecommendationOption(recommendation.id, optionId, `Operator-A.Patnaik (${role})`);
    alert(`Option approved! Task created and dispatched to Action Center.`);
  };

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <Activity className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              DECISION SUPPORT CENTER
            </h2>
            <p className="text-xs text-zinc-400">
              Converts grounded city intelligence into operator-evaluated action options
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 text-xs font-mono rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
            HUMAN-IN-THE-LOOP CONTROL
          </span>
        </div>
      </div>

      {/* Incident & Situation Banner */}
      <div className="bg-zinc-900/80 border border-zinc-800 p-4 rounded-lg space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-orange-400 font-bold">{recommendation.incidentId}</span>
          <span className="text-zinc-400">TIMESTAMP: {new Date(recommendation.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="text-sm font-semibold text-zinc-100">{recommendation.situationSummary}</p>
        <div className="p-2.5 bg-orange-500/10 border border-orange-500/30 rounded text-xs font-mono text-orange-300">
          <span className="font-bold">SYSTEM RATIONALE:</span> {recommendation.recommendationReason}
        </div>
      </div>

      {/* Options Comparison Matrix */}
      <div className="space-y-3">
        <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
          Evaluated Operational Options ({recommendation.options.length})
        </h3>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {recommendation.options.map((opt) => {
            const isRecommended = opt.id === recommendation.recommendedOptionId;
            const isApproved = recommendation.status === 'APPROVED' && selectedOptionId === opt.id;

            return (
              <div
                key={opt.id}
                onClick={() => setSelectedOptionId(opt.id)}
                className={`p-4 rounded-lg border flex flex-col justify-between space-y-4 cursor-pointer transition relative ${
                  isRecommended
                    ? 'bg-zinc-900/90 border-orange-500 shadow-lg shadow-orange-500/10'
                    : 'bg-zinc-900/40 border-zinc-800 hover:border-zinc-700'
                }`}
              >
                {/* Option Header */}
                <div>
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="w-6 h-6 rounded bg-orange-500 text-zinc-950 font-bold font-mono text-xs flex items-center justify-center">
                        {opt.optionLabel}
                      </span>
                      <h4 className="text-xs font-bold font-mono text-zinc-200">{opt.title}</h4>
                    </div>
                    {isRecommended && (
                      <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        RECOMMENDED
                      </span>
                    )}
                  </div>

                  <div className="space-y-2 text-xs font-mono">
                    <p><span className="text-zinc-500">Expected Impact:</span> <span className="text-zinc-200">{opt.expectedImpact}</span></p>
                    <p><span className="text-zinc-500">Affected Area:</span> <span className="text-zinc-300">{opt.affectedArea}</span></p>
                    <p><span className="text-zinc-500">Confidence:</span> <span className="text-emerald-400 font-bold">{opt.confidencePct}%</span></p>
                  </div>
                </div>

                {/* Assumptions & Risks */}
                <div className="space-y-2 pt-2 border-t border-zinc-800 text-xs font-mono">
                  <div>
                    <span className="text-zinc-500 block text-[11px]">ASSUMPTIONS</span>
                    <ul className="list-disc list-inside text-zinc-300 text-[11px] space-y-0.5">
                      {opt.assumptions.map((a, i) => (
                        <li key={i}>{a}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <span className="text-zinc-500 block text-[11px]">RISKS</span>
                    <ul className="list-disc list-inside text-amber-300 text-[11px] space-y-0.5">
                      {opt.risks.map((r, i) => (
                        <li key={i}>{r}</li>
                      ))}
                    </ul>
                  </div>
                </div>

                {/* Action Trigger */}
                <div className="pt-3 border-t border-zinc-800">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleApprove(opt.id);
                    }}
                    className={`w-full py-2.5 rounded text-xs font-mono font-bold transition flex items-center justify-center gap-1.5 shadow ${
                      isRecommended
                        ? 'bg-orange-500 hover:bg-orange-600 text-zinc-950'
                        : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-200'
                    }`}
                  >
                    <CheckSquare className="w-4 h-4" />
                    Approve Option {opt.optionLabel} & Dispatch
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
