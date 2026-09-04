import React, { useState } from 'react';
import { TrafficCorridor, TrafficSensor, TrafficSummary } from '../../types';
import {
  Car,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Clock,
  Navigation,
  Activity,
  Zap,
  Sliders,
  Play,
  CheckCircle,
  BarChart2,
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface MobilityViewProps {
  corridors: TrafficCorridor[];
  sensors: TrafficSensor[];
  summary?: TrafficSummary;
  onSelectCorridor?: (corridor: TrafficCorridor) => void;
  onJumpToMap?: () => void;
}

export const MobilityView: React.FC<MobilityViewProps> = ({
  corridors,
  sensors,
  summary,
  onSelectCorridor,
  onJumpToMap,
}) => {
  const [selectedCorridorId, setSelectedCorridorId] = useState<string>(corridors[0]?.id || '');
  const [signalOptimizationActive, setSignalOptimizationActive] = useState<boolean>(false);
  const [diversionActive, setDiversionActive] = useState<boolean>(false);

  const selectedCorridor = corridors.find((c) => c.id === selectedCorridorId) || corridors[0];

  const chartData = corridors.map((c) => ({
    name: c.name.replace(' Corridor', '').replace(' Express Arterial', '').replace(' Administrative Axis', ''),
    Speed: c.avgSpeedKmh,
    FreeFlow: c.freeFlowSpeedKmh,
    Vehicles: Math.round(c.vehicleCount / 20),
  }));

  const getStatusBadge = (level: TrafficCorridor['congestionLevel']) => {
    switch (level) {
      case 'SEVERE':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#EF4444] text-white animate-pulse">SEVERE JAM</span>;
      case 'JAMMED':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#EF4444]/80 text-white">CONGESTED</span>;
      case 'SLOW':
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#F59E0B] text-black">SLOW TRAFFIC</span>;
      default:
        return <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#10B981] text-black">FREE FLOW</span>;
    }
  };

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#06B6D4]">
            <Car className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Mobility — Corridors, Traffic &amp; Transport
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            Bhubaneswar Urban Traffic System (BUTS) Speed Radars, Signal Automation & Diversion Engine
          </p>
        </div>

        <div className="flex items-center space-x-2">
          {onJumpToMap && (
            <button
              onClick={onJumpToMap}
              className="px-3 py-1.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase flex items-center space-x-2 transition-all"
            >
              <Navigation className="w-3.5 h-3.5" />
              <span>View Traffic Digital Twin</span>
            </button>
          )}
        </div>
      </div>

      {/* KPI Stats Strip */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
            <div className="text-white/40 text-[9px] uppercase">City Average Speed</div>
            <div className="text-lg font-bold text-[#06B6D4] mt-0.5">{summary.cityAvgSpeedKmh} km/h</div>
            <div className="text-white/40 text-[9px] mt-1">Free-flow target: {summary.cityFreeFlowAvgSpeedKmh} km/h</div>
          </div>

          <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
            <div className="text-white/40 text-[9px] uppercase">Active Bottlenecks</div>
            <div className="text-lg font-bold text-[#EF4444] mt-0.5">{summary.activeBottlenecks} Arterials</div>
            <div className="text-[#EF4444] text-[9px] mt-1">Rasulgarh & Jayadev Vihar</div>
          </div>

          <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
            <div className="text-white/40 text-[9px] uppercase">Vehicle Throughput</div>
            <div className="text-lg font-bold text-[#F59E0B] mt-0.5">{summary.totalVehiclesPerMin} / min</div>
            <div className="text-white/40 text-[9px] mt-1">Peak Morning Rush Hour</div>
          </div>

          <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
            <div className="text-white/40 text-[9px] uppercase">Congestion Trend</div>
            <div className="text-lg font-bold text-emerald-400 mt-0.5">{summary.congestionTrend}</div>
            <div className="text-emerald-400 text-[9px] mt-1">Adaptive Signal Loop Active</div>
          </div>
        </div>
      )}

      {/* Main Grid: Corridor Details + Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Corridor Telemetry Cards */}
        <div className="lg:col-span-2 space-y-4">
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest">
            Monitored Arterial Corridors ({corridors.length})
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {corridors.map((corridor) => {
              const speedRatio = Math.round((corridor.avgSpeedKmh / corridor.freeFlowSpeedKmh) * 100);
              const isSelected = corridor.id === selectedCorridorId;

              return (
                <div
                  key={corridor.id}
                  onClick={() => {
                    setSelectedCorridorId(corridor.id);
                    if (onSelectCorridor) onSelectCorridor(corridor);
                  }}
                  className={`p-3.5 rounded border transition-all cursor-pointer flex flex-col justify-between space-y-3 ${
                    isSelected
                      ? 'bg-white/10 border-[#06B6D4] shadow-lg'
                      : 'bg-[#0A0A0A] border-white/10 hover:border-white/20'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-white text-xs truncate max-w-[180px]">
                        {corridor.name}
                      </span>
                      {getStatusBadge(corridor.congestionLevel)}
                    </div>
                    <div className="text-white/40 text-[9px] truncate">{corridor.roadName}</div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-[10px] pt-1 border-t border-white/5">
                    <div>
                      <div className="text-white/40">CURRENT SPEED</div>
                      <div className="text-sm font-bold text-[#06B6D4]">
                        {corridor.avgSpeedKmh} <span className="text-[9px] text-white/50">km/h</span>
                      </div>
                    </div>

                    <div>
                      <div className="text-white/40">VEHICLE RATE</div>
                      <div className="text-sm font-bold text-[#F59E0B]">
                        {corridor.vehicleCount} <span className="text-[9px] text-white/50">veh</span>
                      </div>
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div>
                    <div className="flex justify-between text-[8px] text-white/40 mb-1">
                      <span>FLOW RATIO</span>
                      <span>{speedRatio}% OF FREEFLOW</span>
                    </div>
                    <div className="w-full h-1.5 bg-black rounded-full overflow-hidden border border-white/10">
                      <div
                        className={`h-full transition-all duration-300 ${
                          corridor.congestionLevel === 'SEVERE' || corridor.congestionLevel === 'JAMMED'
                            ? 'bg-[#EF4444]'
                            : corridor.congestionLevel === 'SLOW'
                            ? 'bg-[#F59E0B]'
                            : 'bg-[#10B981]'
                        }`}
                        style={{ width: `${speedRatio}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bar Chart Visualization */}
          <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-2">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center justify-between">
              <span>Corridor Speed Comparison (km/h) vs Free-Flow</span>
              <BarChart2 className="w-4 h-4 text-[#06B6D4]" />
            </div>

            <div className="h-48 w-full pt-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" stroke="rgba(255,255,255,0.4)" fontSize={8} interval={0} angle={-15} textAnchor="end" />
                  <YAxis stroke="rgba(255,255,255,0.4)" fontSize={8} unit="k" />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0a0a0a',
                      borderColor: 'rgba(255,255,255,0.1)',
                      fontSize: '10px',
                      borderRadius: '4px',
                    }}
                  />
                  <Bar dataKey="Speed" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                  <Bar dataKey="FreeFlow" fill="rgba(255,255,255,0.15)" radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Speed Radar Sensor Grid & Traffic Optimization Controls */}
        <div className="space-y-4">
          <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest flex items-center justify-between border-b border-white/5 pb-2">
              <span>Traffic Signal Automation Engine</span>
              <Zap className="w-4 h-4 text-[#F59E0B]" />
            </div>

            <p className="text-white/60 text-[10px] leading-relaxed">
              AI Traffic Adaptive Signal Optimizer utilizes real-time queue estimation and Dijkstra Graph Rerouting to eliminate urban bottlenecks.
            </p>

            <div className="space-y-2 pt-2">
              <button
                onClick={() => setSignalOptimizationActive(!signalOptimizationActive)}
                className={`w-full py-2 px-3 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-all border ${
                  signalOptimizationActive
                    ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                    : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                }`}
              >
                <span>Green Wave Adaptive Loop</span>
                <span>{signalOptimizationActive ? 'ACTIVE' : 'OFF'}</span>
              </button>

              <button
                onClick={() => setDiversionActive(!diversionActive)}
                className={`w-full py-2 px-3 rounded text-xs font-bold uppercase tracking-wider flex items-center justify-between transition-all border ${
                  diversionActive
                    ? 'bg-[#06B6D4]/20 border-[#06B6D4] text-[#06B6D4]'
                    : 'bg-white/5 border-white/10 text-white/70 hover:text-white'
                }`}
              >
                <span>Automated VMS Diversion Signals</span>
                <span>{diversionActive ? 'DEPLOYED' : 'OFF'}</span>
              </button>
            </div>
          </div>

          {/* Speed Radar Sensors List */}
          <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
            <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest border-b border-white/5 pb-2 flex justify-between">
              <span>Speed Radar Nodes ({sensors.length})</span>
              <span className="text-[#10B981]">ONLINE</span>
            </div>

            <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
              {sensors.map((sensor) => (
                <div
                  key={sensor.id}
                  className="p-2 bg-white/[0.02] border border-white/5 rounded flex items-center justify-between text-[10px]"
                >
                  <div>
                    <div className="font-bold text-white">{sensor.id} - {sensor.name}</div>
                    <div className="text-white/40 text-[9px]">{sensor.vehicleRatePerMin} vehicles / min</div>
                  </div>

                  <div className="text-right">
                    <div className={`font-bold text-xs ${sensor.speed < 20 ? 'text-[#EF4444]' : 'text-[#06B6D4]'}`}>
                      {sensor.speed} km/h
                    </div>
                    <div className="text-white/30 text-[8px]">{sensor.status}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
