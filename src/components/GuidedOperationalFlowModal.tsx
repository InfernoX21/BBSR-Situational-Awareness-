import React, { useState } from 'react';
import { X, Play, CheckCircle2, ChevronRight, ChevronLeft, ShieldAlert, Cpu, Activity, RotateCcw, AlertTriangle } from 'lucide-react';
import { operationalStore } from '../store/useOperationalStore';
import { arkaNav } from '../store/useArka';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

const FLOW_STEPS = [
  { step: 1, title: 'DATA: Emergency Vehicle Event Detected', desc: '108 ALS Ambulance Squad #04 broadcasts priority GPS ping encountering 18 min bottleneck at Jayadev Vihar Overbridge.', nav: 'Event Engine' },
  { step: 2, title: 'FUSION: Location & Traffic Context Mapped', desc: 'ARKA Data Fabric fuses GPS telemetry with BSCL loop sensors, IMD rain radar, and CCTV Cam #101.', nav: 'Live Map' },
  { step: 3, title: 'INTELLIGENCE: Impact & Intersections Identified', desc: 'Knowledge Graph traces entity chain: Ambulance #108 -> NH-16 Corridor -> Jayadev Vihar Intersection -> Capital Hospital Route.', nav: 'Knowledge Graph' },
  { step: 4, title: 'PREDICTION: Bottleneck Delay Calculated', desc: 'Prediction Engine forecasts 21.5 minute arrival delay without intervention.', nav: 'Prediction Engine' },
  { step: 5, title: 'SIMULATION: Scenario Analysis Executed', desc: 'What-If Simulation evaluates Janpath Corridor Diversion with Signal Green Wave vs current route.', nav: 'What-If Simulation' },
  { step: 6, title: 'DECISION: Recommendation Matrix Generated', desc: 'Decision Support System presents Option B (Janpath Green Wave, ETA 7.2 min, 94% confidence) with rationale.', nav: 'Decision Support' },
  { step: 7, title: 'ACTION: Operator Approves Rerouting Command', desc: 'Traffic Operator Patnaik approves Option B. System records audit log and dispatches ATCS signal override.', nav: 'Action Center' },
  { step: 8, title: 'FEEDBACK: Expected vs Actual Outcome Evaluated', desc: 'Post-intervention telemetry confirms ambulance arrival in 7.4 mins. Feedback loop logs +14.1 min saved time.', nav: 'Feedback Loop' }
];

export const GuidedOperationalFlowModal: React.FC<Props> = ({ isOpen, onClose }) => {
  const [activeStepIdx, setActiveStepIdx] = useState(0);

  if (!isOpen) return null;

  const current = FLOW_STEPS[activeStepIdx];

  const handleExecuteCurrentStep = () => {
    operationalStore.addAuditLog('Guided Flow Walkthrough', 'STEP_EXECUTED', `Executed Flow Step ${current.step}: ${current.title}`);
    arkaNav.goTo(current.nav as any);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl max-w-3xl w-full text-zinc-100 shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-900/60">
          <div className="flex items-center gap-2">
            <Activity className="w-5 h-5 text-orange-400" />
            <div>
              <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
                END-TO-END ARKA OPERATIONAL LOOP DEMO
              </h2>
              <p className="text-[11px] text-zinc-400">
                DATA &rarr; FUSION &rarr; INTELLIGENCE &rarr; PREDICTION &rarr; SIMULATION &rarr; DECISION &rarr; ACTION &rarr; FEEDBACK
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-zinc-400 hover:text-zinc-100 rounded hover:bg-zinc-800 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress Bar */}
        <div className="grid grid-cols-8 gap-1 p-3 bg-zinc-900/40 border-b border-zinc-800">
          {FLOW_STEPS.map((s, idx) => (
            <button
              key={s.step}
              onClick={() => setActiveStepIdx(idx)}
              className={`h-2 rounded transition ${
                idx === activeStepIdx
                  ? 'bg-orange-500 shadow-lg shadow-orange-500/50'
                  : idx < activeStepIdx
                  ? 'bg-emerald-500'
                  : 'bg-zinc-800'
              }`}
              title={s.title}
            />
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6 space-y-6 flex-1">
          <div className="flex items-center justify-between">
            <span className="px-2.5 py-1 text-xs font-mono font-bold rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
              STEP {current.step} OF 8
            </span>
            <span className="text-xs font-mono text-zinc-500">
              TARGET VIEW: {current.nav}
            </span>
          </div>

          <div>
            <h3 className="text-lg font-bold font-mono text-zinc-100">{current.title}</h3>
            <p className="text-sm text-zinc-300 mt-2 leading-relaxed bg-zinc-900/60 p-4 rounded border border-zinc-800">
              {current.desc}
            </p>
          </div>

          <div className="p-4 bg-zinc-900/30 rounded border border-zinc-800/80 space-y-2 text-xs font-mono text-zinc-400">
            <div className="flex justify-between">
              <span>Operational Loop Stage:</span>
              <span className="text-orange-400 font-bold">{current.title.split(':')[0]}</span>
            </div>
            <div className="flex justify-between">
              <span>Primary Entity:</span>
              <span className="text-zinc-200">108 ALS Ambulance Squad #04</span>
            </div>
            <div className="flex justify-between">
              <span>Geospatial Anchor:</span>
              <span className="text-zinc-200">Jayadev Vihar Overbridge, Bhubaneswar</span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div className="p-4 border-t border-zinc-800 bg-zinc-900/60 flex items-center justify-between">
          <button
            disabled={activeStepIdx === 0}
            onClick={() => setActiveStepIdx((prev) => Math.max(0, prev - 1))}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-mono text-zinc-200 rounded transition flex items-center gap-1"
          >
            <ChevronLeft className="w-4 h-4" /> Previous Step
          </button>

          <button
            onClick={() => {
              handleExecuteCurrentStep();
              onClose();
            }}
            className="px-5 py-2 bg-orange-500 hover:bg-orange-600 text-zinc-950 font-bold text-xs font-mono rounded transition flex items-center gap-2 shadow"
          >
            <Play className="w-4 h-4 fill-current" /> Jump to {current.nav} View
          </button>

          <button
            disabled={activeStepIdx === FLOW_STEPS.length - 1}
            onClick={() => setActiveStepIdx((prev) => Math.min(FLOW_STEPS.length - 1, prev + 1))}
            className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-40 text-xs font-mono text-zinc-200 rounded transition flex items-center gap-1"
          >
            Next Step <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
