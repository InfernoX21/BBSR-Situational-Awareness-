import React, { useState } from 'react';
import { PlayCircle, AlertOctagon, Car, ShieldAlert, Cpu, CheckCircle2, ArrowRight } from 'lucide-react';
import { operationalStore } from '../../store/useOperationalStore';

export const SimulationView: React.FC = () => {
  const [scenarioType, setScenarioType] = useState<'ROAD_BLOCK' | 'EMERGENCY_PRIORITY'>('EMERGENCY_PRIORITY');
  const [selectedRoad, setSelectedRoad] = useState('NH-16 Jayadev Vihar Overbridge');
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<any>(null);

  const handleRunSimulation = () => {
    setIsRunning(true);
    fetch('/api/simulation/run', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scenarioType,
        blockedRoadId: selectedRoad
      })
    })
      .then((res) => res.json())
      .then((data) => {
        setResult(data);
        setIsRunning(false);
        operationalStore.addAuditLog('Operator', 'RUN_WHAT_IF_SIMULATION', `Executed ${scenarioType} scenario simulation`);
      })
      .catch(() => setIsRunning(false));
  };

  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Simulation Banner Requirement */}
      <div className="bg-amber-500/20 border-2 border-amber-500/60 p-3 rounded-lg flex items-center justify-between text-amber-300">
        <div className="flex items-center gap-2 font-mono font-bold text-sm">
          <AlertOctagon className="w-5 h-5 text-amber-400 animate-pulse" />
          SIMULATION / SCENARIO SANDBOX — NOT LIVE CITY STATE
        </div>
        <span className="text-xs font-mono text-amber-400/90">
          HYPOTHETICAL DIGITAL TWIN MODELING
        </span>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <PlayCircle className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              WHAT-IF SIMULATION & SCENARIO ENGINE
            </h2>
            <p className="text-xs text-zinc-400">
              Evaluate hypothetical traffic disruptions and emergency green waves before taking action
            </p>
          </div>
        </div>
      </div>

      {/* Configuration Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Scenario Selector */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-4">
          <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider">
            1. Select Hypothetical Scenario
          </h3>

          <div className="space-y-2">
            <button
              onClick={() => setScenarioType('EMERGENCY_PRIORITY')}
              className={`w-full p-3 rounded border text-left text-xs font-mono transition flex items-center justify-between ${
                scenarioType === 'EMERGENCY_PRIORITY'
                  ? 'bg-orange-500/10 border-orange-500 text-zinc-100'
                  : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div>
                <p className="font-bold text-zinc-200">Emergency Priority Rerouting</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Evaluate signal green wave & ETA reduction</p>
              </div>
              <ShieldAlert className="w-4 h-4 text-orange-400" />
            </button>

            <button
              onClick={() => setScenarioType('ROAD_BLOCK')}
              className={`w-full p-3 rounded border text-left text-xs font-mono transition flex items-center justify-between ${
                scenarioType === 'ROAD_BLOCK'
                  ? 'bg-orange-500/10 border-orange-500 text-zinc-100'
                  : 'bg-zinc-950/70 border-zinc-800 text-zinc-400 hover:border-zinc-700'
              }`}
            >
              <div>
                <p className="font-bold text-zinc-200">Road Blockage / Closure</p>
                <p className="text-[11px] text-zinc-500 mt-0.5">Evaluate traffic spillover & intersection load</p>
              </div>
              <Car className="w-4 h-4 text-amber-400" />
            </button>
          </div>

          <div className="space-y-1.5 pt-2">
            <label className="text-xs font-mono text-zinc-400 block">Target Corridor / Segment</label>
            <select
              value={selectedRoad}
              onChange={(e) => setSelectedRoad(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 text-xs font-mono text-zinc-200 rounded p-2.5 focus:outline-none focus:border-orange-500"
            >
              <option value="NH-16 Jayadev Vihar Overbridge">NH-16 Jayadev Vihar Overbridge</option>
              <option value="Janpath Corridor (Vani Vihar)">Janpath Corridor (Vani Vihar)</option>
              <option value="Nandan Kanan Road Junction">Nandan Kanan Road Junction</option>
              <option value="Khandagiri Flyover Approach">Khandagiri Flyover Approach</option>
            </select>
          </div>

          <button
            onClick={handleRunSimulation}
            disabled={isRunning}
            className="w-full py-3 bg-orange-500 hover:bg-orange-600 font-bold font-mono text-xs text-zinc-950 rounded transition flex items-center justify-center gap-2 shadow"
          >
            <PlayCircle className={`w-4 h-4 ${isRunning ? 'animate-spin' : ''}`} />
            {isRunning ? 'Running Simulation...' : 'Execute What-If Scenario'}
          </button>
        </div>

        {/* Results Panel */}
        <div className="md:col-span-2 bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-4 flex flex-col">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-1.5">
              <Cpu className="w-4 h-4 text-orange-400" />
              Simulation Results & Predicted Operational Impact
            </h3>
            {result && (
              <span className="px-2 py-0.5 text-[10px] font-mono rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                SIMULATION — NOT LIVE
              </span>
            )}
          </div>

          {!result ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-xs font-mono text-zinc-500">
              <PlayCircle className="w-10 h-10 text-zinc-700 mb-2" />
              Configure parameters on the left and click "Execute What-If Scenario" to compute traffic propagation.
            </div>
          ) : (
            <div className="space-y-4 overflow-y-auto pr-1">
              {/* Metrics Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500 block">TRAFFIC SPILLOVER</span>
                  <span className="text-base font-bold text-amber-400">
                    +{result.results.trafficCongestionIncreasePct}%
                  </span>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500 block">SIMULATED ETA</span>
                  <span className="text-base font-bold text-emerald-400">
                    {result.results.emergencyRouteEtaMin} min
                  </span>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500 block">SAVED TIME</span>
                  <span className="text-base font-bold text-orange-400">
                    {result.results.savedTimeMin} min
                  </span>
                </div>
                <div className="bg-zinc-950 p-3 rounded border border-zinc-800 text-xs font-mono">
                  <span className="text-zinc-500 block">AFFECTED ROADS</span>
                  <span className="text-base font-bold text-zinc-200">
                    {result.results.affectedRoads.length}
                  </span>
                </div>
              </div>

              {/* Rerouting & Signal Adjustments */}
              <div className="space-y-2">
                <h4 className="text-xs font-mono text-zinc-400 uppercase">Recommended Alternate Routes</h4>
                <div className="space-y-1">
                  {result.results.alternateRouteNames.map((route: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-zinc-200 flex items-center justify-between"
                    >
                      <span>{route}</span>
                      <span className="text-emerald-400 font-bold">RECOMMENDED</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-mono text-zinc-400 uppercase">Signal Control Recommendations</h4>
                <div className="space-y-1">
                  {result.results.signalAdjustmentRecommendations.map((sig: string, idx: number) => (
                    <div
                      key={idx}
                      className="p-2.5 bg-zinc-950 border border-zinc-800 rounded text-xs font-mono text-amber-300 flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5 text-amber-400" />
                      {sig}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
