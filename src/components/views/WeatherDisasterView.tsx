import React, { useState } from 'react';
import { WeatherData } from '../../types';
import {
  CloudRain,
  Wind,
  Droplets,
  Eye,
  Thermometer,
  ShieldAlert,
  AlertTriangle,
  Activity,
  Waves,
  Navigation,
  CheckCircle,
  FileText,
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

interface WeatherDisasterViewProps {
  weather: WeatherData;
  onJumpToMap?: () => void;
}

export const WeatherDisasterView: React.FC<WeatherDisasterViewProps> = ({
  weather,
  onJumpToMap,
}) => {
  const [activeAlertFilter, setActiveAlertFilter] = useState<string>('ALL');

  // ConvLSTM Time-Series Flood Risk Forecast Mock Data
  const floodForecastData = [
    { time: '06:00', DayaWaterLevel: 2.1, RainGauge: 1.2, InundationRisk: 25 },
    { time: '09:00', DayaWaterLevel: 2.4, RainGauge: 2.8, InundationRisk: 42 },
    { time: '12:00', DayaWaterLevel: 2.9, RainGauge: 4.2, InundationRisk: 74 },
    { time: '15:00', DayaWaterLevel: 3.2, RainGauge: 5.8, InundationRisk: 88 },
    { time: '18:00', DayaWaterLevel: 2.8, RainGauge: 3.1, InundationRisk: 62 },
    { time: '21:00', DayaWaterLevel: 2.5, RainGauge: 1.5, InundationRisk: 38 },
  ];

  const shelters = [
    { name: 'Capital High School Emergency Shelter', location: 'Unit-3, Forest Park', capacity: 1200, occupied: 140, status: 'READY' },
    { name: 'KIIT Indoor Stadium Cyclone Center', location: 'Patia IT Corridor', capacity: 2500, occupied: 0, status: 'READY' },
    { name: 'Bhubaneswar Railway Station Multipurpose Hall', location: 'Master Canteen', capacity: 800, occupied: 45, status: 'READY' },
    { name: 'BMS High School Shelter', location: 'Old Town', capacity: 600, occupied: 20, status: 'READY' },
  ];

  const getRiskBadge = (level: WeatherData['floodRiskLevel']) => {
    switch (level) {
      case 'CRITICAL':
        return <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#EF4444] text-white animate-pulse">CRITICAL FLOOD RISK</span>;
      case 'HIGH':
        return <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#F59E0B] text-black">HIGH FLOOD RISK</span>;
      case 'MODERATE':
        return <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-yellow-500/20 text-yellow-400 border border-yellow-500/40">MODERATE RISK</span>;
      default:
        return <span className="px-2.5 py-1 rounded text-[10px] font-bold bg-[#10B981] text-black">NORMAL</span>;
    }
  };

  return (
    <div className="flex-1 h-full bg-[#050505] p-6 overflow-y-auto font-mono text-xs flex flex-col space-y-6">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between border-b border-white/10 pb-4 gap-4">
        <div>
          <div className="flex items-center space-x-2 text-[#06B6D4]">
            <CloudRain className="w-5 h-5 animate-pulse" />
            <h1 className="text-lg font-bold uppercase tracking-wider text-white">
              Environmental Intelligence & Disaster Response
            </h1>
          </div>
          <p className="text-white/40 text-[11px] mt-0.5">
            IMD Radar Ingestion, Daya River Basin Flood Inundation Model & Cyclone Preparedness
          </p>
        </div>

        {onJumpToMap && (
          <button
            onClick={onJumpToMap}
            className="px-3 py-1.5 rounded bg-[#06B6D4]/10 border border-[#06B6D4]/40 hover:bg-[#06B6D4]/20 text-[#06B6D4] font-bold text-xs uppercase flex items-center space-x-2 transition-all"
          >
            <Navigation className="w-3.5 h-3.5" />
            <span>Map Weather Overlays</span>
          </button>
        )}
      </div>

      {/* Main Environmental Telemetry Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="p-3 bg-[#0A0A0A] border border-white/10 rounded">
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Temperature</span>
            <Thermometer className="w-3.5 h-3.5 text-orange-400" />
          </div>
          <div className="text-xl font-bold text-white mt-1">{weather.temperature}°C</div>
          <div className="text-white/40 text-[9px] mt-0.5">Heat Index: {weather.temperature + 3}°C</div>
        </div>

        <div className="p-3 bg-[#0A0A0A] border border-white/10 rounded">
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Rainfall Rate</span>
            <CloudRain className="w-3.5 h-3.5 text-[#06B6D4]" />
          </div>
          <div className="text-xl font-bold text-[#06B6D4] mt-1">{weather.rainIntensity} <span className="text-[10px] text-white/50">mm/h</span></div>
          <div className="text-white/40 text-[9px] mt-0.5">Downpour Intensity</div>
        </div>

        <div className="p-3 bg-[#0A0A0A] border border-white/10 rounded">
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Relative Humidity</span>
            <Droplets className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="text-xl font-bold text-blue-400 mt-1">{weather.humidity}%</div>
          <div className="text-white/40 text-[9px] mt-0.5">Saturation Level</div>
        </div>

        <div className="p-3 bg-[#0A0A0A] border border-white/10 rounded">
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Wind Telemetry</span>
            <Wind className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1">{weather.windSpeed} <span className="text-[10px] text-white/50">km/h</span></div>
          <div className="text-white/40 text-[9px] mt-0.5">Direction: {weather.windDirection}</div>
        </div>

        <div className="p-3 bg-[#0A0A0A] border border-white/10 rounded">
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Visibility</span>
            <Eye className="w-3.5 h-3.5 text-yellow-400" />
          </div>
          <div className="text-xl font-bold text-yellow-400 mt-1">{weather.visibility} <span className="text-[10px] text-white/50">km</span></div>
          <div className="text-white/40 text-[9px] mt-0.5">Radar Clear</div>
        </div>

        <div className="p-3 bg-[#0A0A0A] border border-white/10 rounded">
          <div className="flex items-center justify-between text-white/40 text-[9px] uppercase">
            <span>Air Quality (AQI)</span>
            <Activity className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold text-emerald-400 mt-1">58 AQI</div>
          <div className="text-emerald-400 text-[9px] mt-0.5">Good Air Quality</div>
        </div>
      </div>

      {/* ConvLSTM Flood Prediction & Disaster Advisory */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Inundation Risk Forecast Chart */}
        <div className="lg:col-span-2 p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
          <div className="flex items-center justify-between border-b border-white/5 pb-2">
            <div>
              <div className="font-bold text-white text-xs uppercase">Daya Basin Flood Inundation Forecast</div>
              <div className="text-white/40 text-[10px]">ConvLSTM Neural Network Time-Series Hydrological Model</div>
            </div>
            {getRiskBadge(weather.floodRiskLevel)}
          </div>

          <div className="h-56 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={floodForecastData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="time" stroke="rgba(255,255,255,0.4)" fontSize={9} />
                <YAxis stroke="rgba(255,255,255,0.4)" fontSize={9} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0a0a0a',
                    borderColor: 'rgba(255,255,255,0.1)',
                    fontSize: '10px',
                    borderRadius: '4px',
                  }}
                />
                <Area type="monotone" dataKey="InundationRisk" stroke="#ef4444" fill="#ef4444" fillOpacity={0.2} name="Flood Risk %" />
                <Area type="monotone" dataKey="RainGauge" stroke="#06b6d4" fill="#06b6d4" fillOpacity={0.1} name="Rain mm/h" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Right 1 Col: Emergency Shelter Grid */}
        <div className="p-4 bg-[#0A0A0A] border border-white/10 rounded space-y-3">
          <div className="font-bold text-white text-xs uppercase border-b border-white/5 pb-2 flex items-center justify-between">
            <span>Cyclone Shelters Status</span>
            <ShieldAlert className="w-4 h-4 text-[#10B981]" />
          </div>

          <div className="space-y-2">
            {shelters.map((shelter) => (
              <div key={shelter.name} className="p-2.5 bg-white/[0.02] border border-white/5 rounded space-y-1">
                <div className="flex justify-between items-start text-[10px]">
                  <span className="font-bold text-white max-w-[180px] leading-tight">{shelter.name}</span>
                  <span className="px-1.5 py-0.5 rounded text-[8px] font-bold bg-[#10B981]/20 text-[#10B981]">
                    {shelter.status}
                  </span>
                </div>

                <div className="flex justify-between text-[9px] text-white/40">
                  <span>{shelter.location}</span>
                  <span>{shelter.occupied} / {shelter.capacity} Beds</span>
                </div>

                <div className="w-full h-1 bg-black rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-[#10B981] rounded-full"
                    style={{ width: `${(shelter.occupied / shelter.capacity) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
