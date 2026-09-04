import React, { useState } from 'react';
import {
  Zap,
  Droplets,
  Flame,
  Radio,
  Lightbulb,
  AlertTriangle,
  Activity,
  CheckCircle,
  Sliders,
  TrendingUp,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface UtilitiesViewProps {
  onJumpToMap?: () => void;
}

export const UtilitiesView: React.FC<UtilitiesViewProps> = ({ onJumpToMap }) => {
  const [selectedUtility, setSelectedUtility] = useState<'POWER' | 'WATER' | 'GAS' | 'TELECOM' | 'STREETLIGHTS'>('POWER');
  const [autoLoadShedding, setAutoLoadShedding] = useState<boolean>(false);

  /**
   * Each utility plots different series keys, so the rows are a common
   * time-plus-measures shape rather than five incompatible literal types —
   * otherwise Recharts infers its `data` generic from whichever config happens
   * to be declared first and rejects the other four.
   */
  type SeriesRow = { time: string } & Record<string, string | number>;

  // Configuration map for each utility grid
  const utilityConfigs: Record<
    'POWER' | 'WATER' | 'GAS' | 'TELECOM' | 'STREETLIGHTS',
    {
      name: string;
      title: string;
      subtitle: string;
      peakBadge: string;
      accentColor: string;
      borderColor: string;
      bgColor: string;
      textColor: string;
      dataKey1: string;
      name1: string;
      dataKey2: string;
      name2: string;
      data: SeriesRow[];
      nodes: { name: string; status: string; val: string }[];
    }
  > = {
    POWER: {
      name: 'Power Grid',
      title: 'Citywide 24h TPCODL Power Load Forecasting',
      subtitle: 'ARIMA Time-Series Predictive Demand & Grid Capacity Model',
      peakBadge: 'PEAK DEMAND: 495 MW (20:00)',
      accentColor: '#EAB308',
      borderColor: 'border-yellow-400',
      bgColor: 'bg-yellow-400/10',
      textColor: 'text-yellow-400',
      dataKey1: 'PowerMW',
      name1: 'Power Demand (MW)',
      dataKey2: 'CapacityMW',
      name2: 'Grid Threshold (MW)',
      data: [
        { time: '00:00', PowerMW: 280, CapacityMW: 500 },
        { time: '04:00', PowerMW: 240, CapacityMW: 500 },
        { time: '08:00', PowerMW: 410, CapacityMW: 500 },
        { time: '12:00', PowerMW: 480, CapacityMW: 500 },
        { time: '16:00', PowerMW: 460, CapacityMW: 500 },
        { time: '20:00', PowerMW: 495, CapacityMW: 500 },
        { time: '23:59', PowerMW: 350, CapacityMW: 500 },
      ],
      nodes: [
        { name: 'Patia 33kV Substation', status: '88% LOAD', val: '142 MW' },
        { name: 'Chandrasekharpur Hub', status: '79% LOAD', val: '118 MW' },
        { name: 'Vani Vihar Grid', status: '92% HIGH', val: '160 MW' },
      ],
    },
    WATER: {
      name: 'Water Supply',
      title: 'WATCO Municipal Water Intake & Distribution Forecast',
      subtitle: 'Hydraulic Pressure & Reservoir Storage Analytics Engine',
      peakBadge: 'PEAK INTAKE: 350 MLD (12:00)',
      accentColor: '#06B6D4',
      borderColor: 'border-[#06B6D4]',
      bgColor: 'bg-[#06B6D4]/10',
      textColor: 'text-[#06B6D4]',
      dataKey1: 'WaterMLD',
      name1: 'Intake Rate (MLD)',
      dataKey2: 'ReserveMLD',
      name2: 'Reservoir Buffer (MLD)',
      data: [
        { time: '00:00', WaterMLD: 180, ReserveMLD: 420 },
        { time: '04:00', WaterMLD: 160, ReserveMLD: 440 },
        { time: '08:00', WaterMLD: 320, ReserveMLD: 380 },
        { time: '12:00', WaterMLD: 350, ReserveMLD: 350 },
        { time: '16:00', WaterMLD: 340, ReserveMLD: 360 },
        { time: '20:00', WaterMLD: 310, ReserveMLD: 390 },
        { time: '23:59', WaterMLD: 220, ReserveMLD: 410 },
      ],
      nodes: [
        { name: 'Mahanadi Intake Pumping Plant', status: 'NOMINAL', val: '210 MLD' },
        { name: 'Saheed Nagar Water Tower', status: '94% FULL', val: '85 MLD' },
        { name: 'Khandagiri Booster Station', status: 'ACTIVE', val: '45 MLD' },
      ],
    },
    GAS: {
      name: 'Gas Pipeline',
      title: 'GAIL Natural Gas Pipeline Pressure Telemetry',
      subtitle: 'SCADA Linepack Pressure & Regulator Valve Control System',
      peakBadge: 'MAX PRESSURE: 6.4 BAR (08:00)',
      accentColor: '#F97316',
      borderColor: 'border-orange-400',
      bgColor: 'bg-orange-400/10',
      textColor: 'text-orange-400',
      dataKey1: 'GasBar',
      name1: 'Line Pressure (Bar)',
      dataKey2: 'FlowRate',
      name2: 'Flow Velocity (kM³/h)',
      data: [
        { time: '00:00', GasBar: 5.8, FlowRate: 4.2 },
        { time: '04:00', GasBar: 5.9, FlowRate: 3.8 },
        { time: '08:00', GasBar: 6.4, FlowRate: 8.8 },
        { time: '12:00', GasBar: 6.2, FlowRate: 8.2 },
        { time: '16:00', GasBar: 6.1, FlowRate: 7.6 },
        { time: '20:00', GasBar: 6.3, FlowRate: 9.0 },
        { time: '23:59', GasBar: 6.0, FlowRate: 5.2 },
      ],
      nodes: [
        { name: 'Rasulgarh City Gate Station', status: 'STABLE', val: '6.3 Bar' },
        { name: 'Infocity Industrial Line', status: 'NORMAL', val: '6.1 Bar' },
        { name: 'Kalpana Square Valve Station', status: 'BALANCED', val: '6.2 Bar' },
      ],
    },
    TELECOM: {
      name: 'Telecom Fiber',
      title: 'BSNL & Smart City Optical Fiber Network Latency',
      subtitle: 'DWDM Optical Backbone Latency & Bandwidth Telemetry',
      peakBadge: 'OPTIMAL LATENCY: 9.8 ms | TRAFFIC: 890 Gbps',
      accentColor: '#10B981',
      borderColor: 'border-emerald-400',
      bgColor: 'bg-emerald-400/10',
      textColor: 'text-emerald-400',
      dataKey1: 'LatencyMS',
      name1: 'Ping Latency (ms)',
      dataKey2: 'BandwidthGbps',
      name2: 'Traffic Load (Gbps x10)',
      data: [
        { time: '00:00', LatencyMS: 11.2, BandwidthGbps: 24.0 },
        { time: '04:00', LatencyMS: 9.8, BandwidthGbps: 18.0 },
        { time: '08:00', LatencyMS: 14.1, BandwidthGbps: 62.0 },
        { time: '12:00', LatencyMS: 13.5, BandwidthGbps: 71.0 },
        { time: '16:00', LatencyMS: 12.8, BandwidthGbps: 68.0 },
        { time: '20:00', LatencyMS: 15.6, BandwidthGbps: 89.0 },
        { time: '23:59', LatencyMS: 11.9, BandwidthGbps: 41.0 },
      ],
      nodes: [
        { name: 'Vani Vihar DWDM Node', status: 'OPERATIONAL', val: '10.4 ms' },
        { name: 'Master Canteen Core Ring', status: 'REROUTED', val: '14.2 ms' },
        { name: 'AIIMS Data Center Link', status: '0% LOSS', val: '11.1 ms' },
      ],
    },
    STREETLIGHTS: {
      name: 'Smart Lights',
      title: 'BSCL Smart Streetlight Luminaire & Power Consumption',
      subtitle: 'Photocell Solar Synchronization & Automatic Dimming Matrix',
      peakBadge: '32,410 LUMINAIRES ACTIVE (NIGHT MATRIX)',
      accentColor: '#C084FC',
      borderColor: 'border-purple-400',
      bgColor: 'bg-purple-400/10',
      textColor: 'text-purple-400',
      dataKey1: 'ActivePct',
      name1: 'Active Poles (%)',
      dataKey2: 'PowerKW',
      name2: 'Energy Draw (kW x10)',
      data: [
        { time: '00:00', ActivePct: 99.2, PowerKW: 68.0 },
        { time: '04:00', ActivePct: 99.1, PowerKW: 67.0 },
        { time: '08:00', ActivePct: 12.4, PowerKW: 8.5 },
        { time: '12:00', ActivePct: 5.1, PowerKW: 3.5 },
        { time: '16:00', ActivePct: 8.3, PowerKW: 6.0 },
        { time: '20:00', ActivePct: 98.4, PowerKW: 69.5 },
        { time: '23:59', ActivePct: 98.9, PowerKW: 68.8 },
      ],
      nodes: [
        { name: 'Kalinga Stadium Lighting Zone', status: '100% ON', val: '4,200 Poles' },
        { name: 'Airport Express Way Corridor', status: 'AUTO-DIM', val: '2,850 Poles' },
        { name: 'Old Town Heritage Circuit', status: 'SOLAR-SYNC', val: '1,920 Poles' },
      ],
    },
  };

  const currentConfig = utilityConfigs[selectedUtility];

  const outages = [
    { id: 'OUT-881', category: 'POWER', system: 'POWER (TPCODL)', location: 'Patia Phase II Transformer #4', status: 'CREW DISPATCHED', eta: '45 mins', affected: 1400 },
    { id: 'OUT-882', category: 'WATER', system: 'WATER (WATCO)', location: 'Laxmisagar Main Feeder Pipeline', status: 'UNDER REPAIR', eta: '90 mins', affected: 3200 },
    { id: 'OUT-883', category: 'TELECOM', system: 'TELECOM (BSNL)', location: 'Rasulgarh Fiber Loop Cut', status: 'INVESTIGATING', eta: '60 mins', affected: 890 },
    { id: 'OUT-884', category: 'GAS', system: 'GAS (GAIL)', location: 'Khandagiri Valve Station Line B', status: 'PRESSURE MONITORING', eta: '30 mins', affected: 450 },
    { id: 'OUT-885', category: 'STREETLIGHTS', system: 'LIGHTS (BSCL)', location: 'Cuttack Road Photocell Array #12', status: 'REPLACEMENT QUEUED', eta: '120 mins', affected: 210 },
  ];

  const filteredOutages = outages.filter((o) => o.category === selectedUtility);
  const displayedOutages = filteredOutages.length > 0 ? filteredOutages : outages;

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-yellow-400">
            <Zap className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Utilities — Power, Water, Gas &amp; Telecom
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            TPCODL Electrical Load, WATCO Water Distribution, GAIL Gas Telemetry & Smart Lighting
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setAutoLoadShedding(!autoLoadShedding)}
            className={`px-3 py-1.5 rounded border text-xs font-bold uppercase tracking-wider flex items-center space-x-2 transition-all ${
              autoLoadShedding
                ? 'bg-[#10B981]/20 border-[#10B981] text-[#10B981]'
                : 'bg-white/5 border-white/20 text-white/70 hover:text-white'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>{autoLoadShedding ? 'Auto-Load Shedding Active' : 'Enable Smart Load Shedding'}</span>
          </button>
        </div>
      </div>

      {/* Grid Telemetry Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div
          onClick={() => setSelectedUtility('POWER')}
          className={`p-3 rounded border transition-all cursor-pointer ${
            selectedUtility === 'POWER' ? 'bg-[#0A0A0A] border-yellow-400 shadow-[0_0_15px_rgba(234,179,8,0.2)] ring-1 ring-yellow-400/50' : 'bg-[#0A0A0A] border-white/10 hover:border-yellow-400/40'
          }`}
        >
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Power Grid</span>
            <Zap className={`w-4 h-4 ${selectedUtility === 'POWER' ? 'text-yellow-400 animate-pulse' : 'text-white/40'}`} />
          </div>
          <div className="text-lg font-bold text-yellow-400 mt-1">420 MW</div>
          <div className="text-white/40 text-[9px] mt-0.5">TPCODL Load (84%)</div>
        </div>

        <div
          onClick={() => setSelectedUtility('WATER')}
          className={`p-3 rounded border transition-all cursor-pointer ${
            selectedUtility === 'WATER' ? 'bg-[#0A0A0A] border-[#06B6D4] shadow-[0_0_15px_rgba(6,182,212,0.2)] ring-1 ring-[#06B6D4]/50' : 'bg-[#0A0A0A] border-white/10 hover:border-[#06B6D4]/40'
          }`}
        >
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Water Supply</span>
            <Droplets className={`w-4 h-4 ${selectedUtility === 'WATER' ? 'text-[#06B6D4] animate-pulse' : 'text-white/40'}`} />
          </div>
          <div className="text-lg font-bold text-[#06B6D4] mt-1">340 MLD</div>
          <div className="text-white/40 text-[9px] mt-0.5">WATCO Intake Rate</div>
        </div>

        <div
          onClick={() => setSelectedUtility('GAS')}
          className={`p-3 rounded border transition-all cursor-pointer ${
            selectedUtility === 'GAS' ? 'bg-[#0A0A0A] border-orange-400 shadow-[0_0_15px_rgba(249,115,22,0.2)] ring-1 ring-orange-400/50' : 'bg-[#0A0A0A] border-white/10 hover:border-orange-400/40'
          }`}
        >
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Gas Pipeline</span>
            <Flame className={`w-4 h-4 ${selectedUtility === 'GAS' ? 'text-orange-400 animate-pulse' : 'text-white/40'}`} />
          </div>
          <div className="text-lg font-bold text-orange-400 mt-1">6.2 Bar</div>
          <div className="text-white/40 text-[9px] mt-0.5">GAIL Pressure Nominal</div>
        </div>

        <div
          onClick={() => setSelectedUtility('TELECOM')}
          className={`p-3 rounded border transition-all cursor-pointer ${
            selectedUtility === 'TELECOM' ? 'bg-[#0A0A0A] border-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] ring-1 ring-emerald-400/50' : 'bg-[#0A0A0A] border-white/10 hover:border-emerald-400/40'
          }`}
        >
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Telecom Fiber</span>
            <Radio className={`w-4 h-4 ${selectedUtility === 'TELECOM' ? 'text-emerald-400 animate-pulse' : 'text-white/40'}`} />
          </div>
          <div className="text-lg font-bold text-emerald-400 mt-1">12 ms</div>
          <div className="text-white/40 text-[9px] mt-0.5">BSNL Optical Latency</div>
        </div>

        <div
          onClick={() => setSelectedUtility('STREETLIGHTS')}
          className={`p-3 rounded border transition-all cursor-pointer ${
            selectedUtility === 'STREETLIGHTS' ? 'bg-[#0A0A0A] border-purple-400 shadow-[0_0_15px_rgba(192,132,252,0.2)] ring-1 ring-purple-400/50' : 'bg-[#0A0A0A] border-white/10 hover:border-purple-400/40'
          }`}
        >
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Smart Lights</span>
            <Lightbulb className={`w-4 h-4 ${selectedUtility === 'STREETLIGHTS' ? 'text-purple-400 animate-pulse' : 'text-white/40'}`} />
          </div>
          <div className="text-lg font-bold text-purple-400 mt-1">98.4%</div>
          <div className="text-white/40 text-[9px] mt-0.5">BSCL Active Luminaires</div>
        </div>
      </div>

      {/* Main Grid: Chart + Node Status + Outage Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Dynamic Demand Forecast Chart */}
        <div className="lg:col-span-2 p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/5 pb-2 gap-2">
            <div>
              <div className="font-bold text-white text-xs uppercase flex items-center gap-2">
                <span>{currentConfig.title}</span>
                <span className={`text-[9px] px-1.5 py-0.5 rounded border ${currentConfig.borderColor} ${currentConfig.bgColor} ${currentConfig.textColor}`}>
                  ACTIVE SCADA
                </span>
              </div>
              <div className="text-white/40 text-[10px]">{currentConfig.subtitle}</div>
            </div>
            <span className={`text-[10px] font-bold ${currentConfig.textColor} bg-white/5 px-2 py-1 rounded border border-white/10 shrink-0`}>
              {currentConfig.peakBadge}
            </span>
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={currentConfig.data} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    borderColor: 'rgba(255,255,255,0.2)',
                    fontSize: '11px',
                    borderRadius: '6px',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey={currentConfig.dataKey1}
                  stroke={currentConfig.accentColor}
                  fill={currentConfig.accentColor}
                  fillOpacity={0.25}
                  name={currentConfig.name1}
                />
                <Area
                  type="monotone"
                  dataKey={currentConfig.dataKey2}
                  stroke="#64748B"
                  fill="#64748B"
                  fillOpacity={0.1}
                  name={currentConfig.name2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Substation / Node Telemetry Breakdown */}
          <div className="pt-2 border-t border-white/5">
            <div className="text-[10px] font-bold text-white/50 uppercase mb-2">
              {currentConfig.name} Sub-Nodes & Live Telemetry
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {currentConfig.nodes.map((node, i) => (
                <div key={i} className="p-2 bg-white/[0.02] border border-white/5 rounded flex justify-between items-center">
                  <div>
                    <div className="text-[10px] font-bold text-white truncate max-w-[110px]">{node.name}</div>
                    <div className="text-[8px] text-emerald-400 font-mono">{node.status}</div>
                  </div>
                  <div className={`text-xs font-bold ${currentConfig.textColor}`}>{node.val}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right 1 Col: Outages & Repairs */}
        <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <span>Field Repairs & Outages</span>
              <span className="text-[9px] px-1.5 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-400 font-mono">
                {displayedOutages.length} ACTIVE
              </span>
            </div>
            <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
          </div>

          <div className="space-y-2">
            {displayedOutages.map((out) => (
              <div key={out.id} className="p-2.5 bg-white/[0.02] border border-white/5 rounded space-y-1 hover:border-white/20 transition-all">
                <div className="flex justify-between items-start text-[10px]">
                  <span className="font-bold text-[#EF4444]">{out.id}</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#F59E0B]/20 text-[#F59E0B]">
                    {out.status}
                  </span>
                </div>

                <div className="font-bold text-white text-[10px]">{out.system}</div>
                <div className="text-[#06B6D4] text-[9px]">{out.location}</div>

                <div className="flex justify-between text-[9px] text-white/40 pt-1 border-t border-white/5">
                  <span>ETA: {out.eta}</span>
                  <span>{out.affected} Affected</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
