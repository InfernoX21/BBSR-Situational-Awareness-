import React from 'react';
import { Navigation, ShieldAlert, Radio, Battery, Zap, AlertTriangle } from 'lucide-react';
import { DroneUnit, Incident, LandmarkNode } from '../../types';

interface DroneFeedViewProps {
  drones?: DroneUnit[];
  incidents?: Incident[];
  landmarks?: LandmarkNode[];
  onSelectDrone?: (drone: DroneUnit) => void;
  onJumpToMap?: () => void;
}

export const DroneFeedView: React.FC<DroneFeedViewProps> = ({
  drones = [],
  onSelectDrone,
  onJumpToMap,
}) => {
  const hasDrones = drones.length > 0;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-zinc-900/80 border border-zinc-800 p-4 rounded-xl">
        <div>
          <div className="flex items-center gap-2">
            <Navigation className="w-5 h-5 text-cyan-400" />
            <h1 className="text-xl font-bold text-zinc-100 tracking-wide font-mono">
              ARKA UAV RECONNAISSANCE & FEEDS
            </h1>
            <span className={`text-xs px-2.5 py-0.5 rounded font-mono font-semibold ${
              hasDrones ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
            }`}>
              {hasDrones ? 'SEED / SIMULATED' : 'UNAVAILABLE'}
            </span>
          </div>
          <p className="text-xs text-zinc-400 mt-1">
            Real-time aerial surveillance video stream and GCS ground control telemetry.
          </p>
        </div>
        {onJumpToMap && (
          <button
            onClick={onJumpToMap}
            className="flex items-center gap-2 px-3 py-1.5 bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-700/50 rounded-lg text-xs font-mono transition-colors"
          >
            <Radio className="w-4 h-4" />
            VIEW ON MAP
          </button>
        )}
      </div>

      {/* Main Content */}
      {hasDrones ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {drones.map((drone) => (
            <div
              key={drone.id}
              onClick={() => onSelectDrone && onSelectDrone(drone)}
              className="bg-zinc-900/80 border border-zinc-800 hover:border-zinc-700 rounded-xl p-4 cursor-pointer transition-all space-y-3"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-pulse" />
                  <span className="font-mono font-bold text-zinc-100">{drone.callsign}</span>
                  <span className="text-xs px-2 py-0.5 bg-zinc-800 text-zinc-300 rounded font-mono">
                    {drone.status}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-cyan-400 font-mono">
                  <Battery className="w-4 h-4" />
                  <span>{drone.battery}%</span>
                </div>
              </div>

              <div className="bg-black/60 border border-zinc-800 rounded-lg p-3 text-xs font-mono space-y-1 text-zinc-300">
                <div><span className="text-zinc-500">Target Zone:</span> {drone.targetArea}</div>
                <div><span className="text-zinc-500">Altitude:</span> {drone.altMeters} m</div>
                <div><span className="text-zinc-500">Airspeed:</span> {drone.speedKmh} km/h</div>
                <div><span className="text-zinc-500">Coordinates:</span> {drone.lat.toFixed(4)}, {drone.lng.toFixed(4)}</div>
              </div>

              <div className="text-[11px] text-amber-400/80 font-mono bg-amber-950/20 border border-amber-900/30 p-2 rounded">
                CLASSIFICATION: SIMULATED TELEMETRY (USE_DEMO_DATA=true)
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-zinc-900/60 border border-zinc-800 rounded-xl p-12 text-center space-y-4">
          <div className="w-12 h-12 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center mx-auto text-zinc-400">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <h3 className="text-base font-bold font-mono text-zinc-200">UAV VIDEO & GCS TELEMETRY UNAVAILABLE</h3>
            <p className="text-xs text-zinc-400 max-w-md mx-auto mt-1">
              No live RTSP/MPEG-TS drone video stream or MavLink GCS ground station receiver is currently configured.
            </p>
          </div>
          <div className="inline-block text-left bg-black/40 border border-zinc-800 rounded-lg p-4 text-xs font-mono text-zinc-400 max-w-lg space-y-1">
            <div className="text-zinc-300 font-semibold mb-1">Integration Setup Required:</div>
            <div>• Connect MavLink / DroneKit GCS telemetry IP port</div>
            <div>• Configure RTSP video stream URL in server.ts / .env</div>
            <div>• Set USE_DEMO_DATA=true in .env to view demo simulated UAV nodes</div>
          </div>
        </div>
      )}
    </div>
  );
};
