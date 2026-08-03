import React from 'react';
import { Incident, TrafficCorridor, WeatherData } from '../../types';
import {
  BarChart3,
  TrendingUp,
  Activity,
  PieChart as PieIcon,
  Sparkles,
  Award,
  Download,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from 'recharts';

interface AnalyticsViewProps {
  incidents: Incident[];
  trafficCorridors: TrafficCorridor[];
  weather: WeatherData;
}

export const AnalyticsView: React.FC<AnalyticsViewProps> = ({
  incidents,
  trafficCorridors,
  weather,
}) => {
  // Category Breakdown Data
  const catCounts: Record<string, number> = {};
  incidents.forEach((i) => {
    catCounts[i.category] = (catCounts[i.category] || 0) + 1;
  });

  const pieData = Object.keys(catCounts).map((cat) => ({
    name: cat,
    value: catCounts[cat],
  }));

  const COLORS = ['#06B6D4', '#EF4444', '#F59E0B', '#10B981', '#8B5CF6', '#EC4899'];

  // Agency Response Time Efficiency Metrics Data
  const agencyData = [
    { agency: 'COMMISSIONERATE POLICE', responseMins: 3.8, targetMins: 5.0, dispatches: 42 },
    { agency: 'ODISHA FIRE & DISASTER', responseMins: 4.2, targetMins: 6.0, dispatches: 28 },
    { agency: 'BMC URBAN ADVISORY', responseMins: 6.5, targetMins: 10.0, dispatches: 19 },
    { agency: 'TPCODL GRID CONTROL', responseMins: 8.1, targetMins: 12.0, dispatches: 14 },
    { agency: 'WATCO WATER AUTHORITY', responseMins: 9.0, targetMins: 15.0, dispatches: 11 },
  ];

  // AI Confidence & Risk Score Time-Series Data
  const aiTrendData = [
    { hour: '06:00', Confidence: 91, RiskScore: 45 },
    { hour: '08:00', Confidence: 94, RiskScore: 68 },
    { hour: '10:00', Confidence: 97, RiskScore: 82 },
    { hour: '12:00', Confidence: 96, RiskScore: 88 },
    { hour: '14:00', Confidence: 95, RiskScore: 74 },
    { hour: '16:00', Confidence: 98, RiskScore: 62 },
  ];

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#06B6D4]">
            <BarChart3 className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Executive Operational Analytics & AI Performance
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            Bayesian Risk Score Distributions, Multi-Agency Response Efficiency & Predictive AI Accuracy
          </p>
        </div>

        <button className="px-3 py-1.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase flex items-center space-x-2 transition-all">
          <Download className="w-3.5 h-3.5" />
          <span>Export Analytics Dataset</span>
        </button>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Mean Response Time</div>
          <div className="text-lg font-bold text-[#10B981] mt-0.5">4.2 Minutes</div>
          <div className="text-[#10B981] text-[9px] mt-1">-1.4 min faster than target</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Gemini AI Precision</div>
          <div className="text-lg font-bold text-[#06B6D4] mt-0.5">96.4% Accuracy</div>
          <div className="text-white/40 text-[9px] mt-1">Multi-modal Bayesian Fusion</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Incident Containment</div>
          <div className="text-lg font-bold text-[#F59E0B] mt-0.5">92.8% Rate</div>
          <div className="text-white/40 text-[9px] mt-1">First-responder dispatch</div>
        </div>

        <div className="p-3 bg-white/[0.02] border border-white/10 rounded">
          <div className="text-white/40 text-[9px] uppercase">Traffic Delay Reduction</div>
          <div className="text-lg font-[#10B981] font-bold mt-0.5">-18% Bottleneck</div>
          <div className="text-emerald-400 text-[9px] mt-1">Adaptive Signal Loop</div>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Chart 1: Incident Categories Breakdown */}
        <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex justify-between">
            <span>Incident Category Distribution</span>
            <PieIcon className="w-4 h-4 text-[#06B6D4]" />
          </div>

          <div className="h-56 w-full flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent || 0) * 100).toFixed(0)}%`}
                >
                  {pieData.map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
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
          </div>
        </div>

        {/* Chart 2: Agency Response Times */}
        <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex justify-between">
            <span>Agency Response Efficiency (Minutes)</span>
            <Award className="w-4 h-4 text-[#10B981]" />
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={agencyData} margin={{ top: 5, right: 10, left: -20, bottom: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="agency" stroke="rgba(255,255,255,0.4)" fontSize={7} interval={0} angle={-15} textAnchor="end" />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={8} unit="m" />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    fontSize: '10px',
                    borderRadius: '4px',
                  }}
                />
                <Bar dataKey="responseMins" fill="#10b981" radius={[2, 2, 0, 0]} name="Actual Mins" />
                <Bar dataKey="targetMins" fill="rgba(255,255,255,0.1)" radius={[2, 2, 0, 0]} name="Target Mins" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 3: AI Model Accuracy & Risk Score Trend */}
        <div className="lg:col-span-2 p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex justify-between">
            <span>AI Bayesian Model Confidence % vs City Risk Score</span>
            <Sparkles className="w-4 h-4 text-[#06B6D4]" />
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={aiTrendData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hour" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    fontSize: '10px',
                    borderRadius: '4px',
                  }}
                />
                <Line type="monotone" dataKey="Confidence" stroke="#06b6d4" strokeWidth={2} name="AI Confidence %" />
                <Line type="monotone" dataKey="RiskScore" stroke="#ef4444" strokeWidth={2} name="City Risk Index" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
};
