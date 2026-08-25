import React, { useState } from 'react';
import { Incident, ResourceUnit, WeatherData, Severity, TrafficCorridor, TrafficSummary } from '../types';
import { LiveNewsPanel } from './LiveNewsPanel';
import { LiveTrafficCameraPanel } from './LiveTrafficCameraPanel';
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
    <div className="w-full h-40 sm:h-44 md:h-48 lg:h-52 xl:h-56 border-t border-white/10 bg-[#0A0A0A] grid grid-cols-2 md:grid-cols-4 gap-2 xl:gap-3 p-2 xl:p-3 shrink-0 select-none overflow-hidden font-mono min-w-0 min-h-0">
      {/* Widget 1: Incident Distribution */}
      <div className="gov-glass rounded-md p-2 flex flex-col justify-between min-w-0 min-h-0">
        <div className="flex items-center justify-between border-b border-white/5 pb-1 text-[8.5px] sm:text-[9px] font-bold uppercase tracking-widest gap-1">
          <span className="text-white/40 truncate">Incident Distribution</span>
          <span className="text-[#06B6D4] shrink-0">TOTAL: {incidents.length}</span>
        </div>

        <div className="flex items-center justify-between flex-1 min-w-0 min-h-0">
          <div className="w-14 h-14 sm:w-16 sm:h-16 md:w-20 md:h-20 relative flex items-center justify-center shrink-0">
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
      <div className="gov-glass rounded-md p-2 flex flex-col justify-between min-w-0 min-h-0">
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

      {/* Widget 4: Live Traffic Camera Stream */}
      <LiveTrafficCameraPanel />
    </div>
  );
};
