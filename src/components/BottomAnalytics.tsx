import React, { useState } from 'react';
import { Incident, ResourceUnit, WeatherData, Severity, TrafficCorridor, TrafficSummary } from '../types';
import { LiveNewsPanel } from './LiveNewsPanel';
import {
  PieChart as PieIcon,
  BarChart2,
  CloudRain,
  Radio,
  Flame,
  Shield,
  HeartPulse,
  Activity,
  AlertTriangle,
  Car,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';

interface BottomAnalyticsProps {
  incidents: Incident[];
  resources: ResourceUnit[];
  weather: WeatherData;
  trafficCorridors?: TrafficCorridor[];
  trafficSummary?: TrafficSummary;
}

export const BottomAnalytics: React.FC<BottomAnalyticsProps> = ({
  incidents,
  resources,
  weather,
  trafficCorridors = [],
  trafficSummary,
}) => {
  const [widget2Mode, setWidget2Mode] = useState<'TRAFFIC' | 'TIMELINE'>('TRAFFIC');
  const [timelineFilter, setTimelineFilter] = useState<'TODAY' | '1HR' | '24HR'>('TODAY');

  // Compute Incident Distribution Data
  const criticalCount = incidents.filter((i) => i.priority === 'CRITICAL').length;
  const highCount = incidents.filter((i) => i.priority === 'HIGH').length;
  const mediumCount = incidents.filter((i) => i.priority === 'MEDIUM').length;
  const lowCount = incidents.filter((i) => i.priority === 'LOW').length;
  const resolvedCount = incidents.filter((i) => i.status === 'RESOLVED').length;

  const donutData = [
    { name: 'Critical', value: criticalCount || 1, color: '#ef4444' },
    { name: 'High', value: highCount || 2, color: '#f59e0b' },
    { name: 'Medium', value: mediumCount || 3, color: '#eab308' },
    { name: 'Low', value: lowCount || 1, color: '#10b981' },
    { name: 'Resolved', value: resolvedCount || 4, color: '#06b6d4' },
  ];

  // Traffic Corridor Speeds for BarChart
  const trafficChartData = trafficCorridors.map((c) => ({
    name: c.name.replace(' Corridor', '').replace(' Express Arterial', '').replace(' Administrative Axis', ''),
    Speed: c.avgSpeedKmh,
    FreeFlow: c.freeFlowSpeedKmh,
  }));

  // Timeline Mock Hourly Data
  const timelineData = [
    { time: '06:00', Critical: 0, High: 1, Medium: 2 },
    { time: '08:00', Critical: 1, High: 2, Medium: 1 },
    { time: '10:00', Critical: 2, High: 3, Medium: 2 },
    { time: '12:00', Critical: 1, High: 2, Medium: 3 },
    { time: '14:00', Critical: 0, High: 1, Medium: 2 },
    { time: '16:00', Critical: 1, High: 2, Medium: 1 },
  ];

  return (
    <div className="w-full h-44 border-t border-white/10 bg-[#0A0A0A] grid grid-cols-4 gap-3 p-3 shrink-0 select-none overflow-hidden font-mono">
      {/* Widget 1: Incident Distribution */}
      <div className="border border-white/10 bg-white/[0.02] rounded p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[9px] font-bold uppercase tracking-widest">
          <span className="text-white/40">Incident Distribution</span>
          <span className="text-[#06B6D4]">TOTAL: {incidents.length}</span>
        </div>

        <div className="flex items-center justify-between flex-1">
          <div className="w-20 h-20 relative flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={donutData}
                  cx="50%"
                  cy="50%"
                  innerRadius={18}
                  outerRadius={34}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {donutData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    fontSize: '10px',
                    borderRadius: '4px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex items-center justify-center font-bold text-xs text-white">
              {incidents.length}
            </div>
          </div>

          <div className="space-y-1 text-[9px]">
            {donutData.map((d) => (
              <div key={d.name} className="flex items-center justify-between space-x-2">
                <div className="flex items-center space-x-1">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: d.color }} />
                  <span className="text-white/60">{d.name}</span>
                </div>
                <span className="text-white font-bold">{d.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Widget 2: Traffic Flow & Corridor Speeds / Incident Timeline */}
      <div className="border border-white/10 bg-white/[0.02] rounded p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[9px] font-bold uppercase tracking-widest">
          <div className="flex items-center space-x-1">
            <button
              onClick={() => setWidget2Mode('TRAFFIC')}
              className={`px-1.5 py-0.5 rounded transition-all ${
                widget2Mode === 'TRAFFIC' ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-bold' : 'text-white/40 hover:text-white'
              }`}
            >
              TRAFFIC FLOW
            </button>
            <button
              onClick={() => setWidget2Mode('TIMELINE')}
              className={`px-1.5 py-0.5 rounded transition-all ${
                widget2Mode === 'TIMELINE' ? 'bg-[#06B6D4]/20 text-[#06B6D4] font-bold' : 'text-white/40 hover:text-white'
              }`}
            >
              TIMELINE
            </button>
          </div>
          <span className="text-[#10B981] text-[8px] font-bold">
            {widget2Mode === 'TRAFFIC' ? `${trafficSummary?.cityAvgSpeedKmh || 25} KM/H AVG` : `${timelineFilter}`}
          </span>
        </div>

        <div className="flex-1 w-full pt-1">
          {widget2Mode === 'TRAFFIC' ? (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={trafficChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="name" stroke="rgba(255,255,255,0.3)" fontSize={7} tickLine={false} interval={0} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={8} tickLine={false} unit="k" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    fontSize: '10px',
                    borderRadius: '4px',
                  }}
                />
                <Bar dataKey="Speed" fill="#06b6d4" radius={[2, 2, 0, 0]} />
                <Bar dataKey="FreeFlow" fill="rgba(255,255,255,0.1)" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={timelineData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.3)" fontSize={8} tickLine={false} />
                <YAxis stroke="rgba(255,255,255,0.3)" fontSize={8} tickLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    fontSize: '10px',
                    borderRadius: '4px',
                  }}
                />
                <Bar dataKey="Critical" stackId="a" fill="#ef4444" radius={[2, 2, 0, 0]} />
                <Bar dataKey="High" stackId="a" fill="#f59e0b" radius={[2, 2, 0, 0]} />
                <Bar dataKey="Medium" stackId="a" fill="#eab308" radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      {/* Widget 3: Live Odia News Stream */}
      <LiveNewsPanel />

      {/* Widget 4: Resource Status Availability */}
      <div className="border border-white/10 bg-white/[0.02] rounded p-2 flex flex-col justify-between">
        <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[9px] font-bold uppercase tracking-widest">
          <span className="text-white/40">Resource Fleet</span>
          <span className="text-[#10B981]">ONLINE</span>
        </div>

        <div className="space-y-1 flex-1 overflow-y-auto pr-1 pt-1 text-[9px]">
          {resources.map((res) => {
            const pct = Math.round((res.available / res.total) * 100);
            return (
              <div key={res.id} className="space-y-0.5">
                <div className="flex justify-between text-white/70">
                  <span className="truncate max-w-[120px]">{res.name}</span>
                  <span className="text-white/40">
                    <strong className="text-[#10B981]">{res.available}</strong>/{res.total}
                  </span>
                </div>
                <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-white/10">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${
                      pct > 70 ? 'bg-[#10B981]' : pct > 40 ? 'bg-[#F59E0B]' : 'bg-[#EF4444]'
                    }`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
