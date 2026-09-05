import React from 'react';
import { TrendingUp, Clock, AlertTriangle, ShieldCheck, Cpu } from 'lucide-react';

export const PredictionView: React.FC = () => {
  return (
    <div className="h-full bg-zinc-950 text-zinc-100 flex flex-col p-4 space-y-4 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-5 h-5 text-orange-400" />
          <div>
            <h2 className="text-sm font-bold font-mono text-zinc-100 tracking-wider">
              PREDICTION ENGINE & FORECASTING WORKFLOWS
            </h2>
            <p className="text-xs text-zinc-400">
              Predictive modeling for corridor congestion trends, emergency ETAs, and infrastructure cascades
            </p>
          </div>
        </div>
      </div>

      {/* Prediction Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 font-mono text-xs">
        {/* Active Prediction: Traffic */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-orange-400 font-bold">NH-16 Corridor Traffic Forecast</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                MODEL ACTIVE
              </span>
            </div>

            <div className="space-y-1.5 text-zinc-300">
              <p><span className="text-zinc-500">Target:</span> Jayadev Vihar to Khandagiri Segment</p>
              <p><span className="text-zinc-500">Horizon:</span> +30 Minutes</p>
              <p><span className="text-zinc-500">Confidence:</span> 92%</p>
              <p><span className="text-zinc-500">Forecasted State:</span> Congestion Score +28% without signal intervention</p>
            </div>
          </div>

          <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded text-[11px] text-zinc-400">
            Source Data: BSCL Loop Sensors, Historical 30-day Speed Vectors, IMD Radar
          </div>
        </div>

        {/* Active Prediction: Emergency ETA */}
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-lg p-4 space-y-3 flex flex-col justify-between">
          <div className="space-y-2">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
              <span className="text-orange-400 font-bold">108 ALS Ambulance ETA Delay Model</span>
              <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px]">
                MODEL ACTIVE
              </span>
            </div>

            <div className="space-y-1.5 text-zinc-300">
              <p><span className="text-zinc-500">Target:</span> Capital Hospital Unit 6 Emergency Arrival</p>
              <p><span className="text-zinc-500">Horizon:</span> Live Corridor Tracking</p>
              <p><span className="text-zinc-500">Confidence:</span> 94%</p>
              <p><span className="text-zinc-500">Forecasted State:</span> 21.5m (Normal) vs 7.2m (Green Wave Reroute)</p>
            </div>
          </div>

          <div className="p-2.5 bg-zinc-950 border border-zinc-800 rounded text-[11px] text-zinc-400">
            Source Data: 108 GPS Stream, BSCL ATCS Signal Timings, Janpath Flow Rates
          </div>
        </div>

        {/* Unavailable Prediction Example (Requirement #6) */}
        <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-lg p-4 space-y-3 md:col-span-2">
          <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
            <span className="text-zinc-400 font-bold">Subsurface Utility Water Pressure Cascade Prediction</span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px]">
              Prediction unavailable — insufficient live data/model
            </span>
          </div>
          <p className="text-zinc-500 text-xs">
            Notice: Sensor telemetry for WATCO underground pressure transducers is awaiting integration. ARKA explicitly displays unavailable status rather than manufacturing unsupported predictions.
          </p>
        </div>
      </div>
    </div>
  );
};
