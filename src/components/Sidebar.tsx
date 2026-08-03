import React from 'react';
import { NavItem, Agency } from '../types';
import {
  Activity,
  Map,
  Rss,
  AlertTriangle,
  Car,
  CloudRain,
  Building2,
  Zap,
  Radio,
  Video,
  BarChart3,
  FileText,
  Settings,
  ShieldAlert,
  Flame,
  HeartPulse,
  CheckCircle2,
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  agencies: Agency[];
  onAgencyClick?: (agency: Agency) => void;
}

const NAV_ITEMS: { label: NavItem; icon: React.ReactNode }[] = [
  { label: 'Dashboard', icon: <Activity className="w-4 h-4" /> },
  { label: 'Live Map', icon: <Map className="w-4 h-4" /> },
  { label: 'Intelligence Feed', icon: <Rss className="w-4 h-4" /> },
  { label: 'Incident Center', icon: <AlertTriangle className="w-4 h-4" /> },
  { label: 'Traffic Management', icon: <Car className="w-4 h-4" /> },
  { label: 'Weather & Disaster', icon: <CloudRain className="w-4 h-4" /> },
  { label: 'Infrastructure', icon: <Building2 className="w-4 h-4" /> },
  { label: 'Utilities', icon: <Zap className="w-4 h-4" /> },
  { label: 'Resource Tracker', icon: <Radio className="w-4 h-4" /> },
  { label: 'Drone Feed', icon: <Video className="w-4 h-4" /> },
  { label: 'Analytics', icon: <BarChart3 className="w-4 h-4" /> },
  { label: 'Reports', icon: <FileText className="w-4 h-4" /> },
  { label: 'Settings', icon: <Settings className="w-4 h-4" /> },
];

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  agencies,
  onAgencyClick,
}) => {
  const getAgencyIcon = (iconName: string) => {
    switch (iconName) {
      case 'Building2': return <Building2 className="w-3.5 h-3.5 text-[#06B6D4]" />;
      case 'ShieldAlert': return <ShieldAlert className="w-3.5 h-3.5 text-[#10B981]" />;
      case 'Flame': return <Flame className="w-3.5 h-3.5 text-[#F59E0B]" />;
      case 'AlertTriangle': return <AlertTriangle className="w-3.5 h-3.5 text-[#EF4444]" />;
      case 'HeartPulse': return <HeartPulse className="w-3.5 h-3.5 text-rose-400" />;
      case 'Car': return <Car className="w-3.5 h-3.5 text-indigo-400" />;
      case 'Zap': return <Zap className="w-3.5 h-3.5 text-yellow-400" />;
      default: return <Activity className="w-3.5 h-3.5 text-[#10B981]" />;
    }
  };

  return (
    <aside className="w-60 flex-shrink-0 h-full bg-[#0A0A0A] border-r border-white/10 flex flex-col p-4 shrink-0 select-none">
      {/* Top Header: Branding */}
      <div className="mb-6">
        <h1 className="text-xl font-bold tracking-tighter text-white">
          ARKA<span className="text-[#06B6D4] font-light">.OS</span>
        </h1>
        <p className="text-[8px] text-white/40 uppercase tracking-[0.3em] mt-1">
          Geospatial Kinetic Analysis
        </p>
      </div>

      {/* Middle Navigation Menu */}
      <nav className="flex-1 overflow-y-auto pr-1 space-y-1">
        <div className="text-[9px] font-bold text-white/30 uppercase tracking-widest mb-3">
          Navigation
        </div>
        {NAV_ITEMS.map((item) => {
          const isActive = activeTab === item.label;
          return (
            <button
              key={item.label}
              onClick={() => setActiveTab(item.label)}
              className={`w-full flex items-center gap-3 px-3 py-2 text-[11px] transition-colors ${
                isActive
                  ? 'bg-white/5 border-l-2 border-[#06B6D4] text-white rounded-r font-medium'
                  : 'text-white/60 hover:text-white'
              }`}
            >
              <span className={isActive ? 'text-[#06B6D4]' : 'text-white/40'}>{item.icon}</span>
              <span className="truncate uppercase font-mono">{item.label}</span>
            </button>
          );
        })}

        {/* Agency Status Section */}
        <div className="pt-4 text-[9px] font-bold text-white/30 uppercase tracking-widest mb-3">
          Agency Status
        </div>
        <div className="space-y-2 px-1">
          {agencies.map((agency) => (
            <div
              key={agency.id}
              onClick={() => onAgencyClick && onAgencyClick(agency)}
              className="flex items-center justify-between cursor-pointer hover:bg-white/5 p-1.5 rounded transition-colors"
            >
              <div className="flex items-center space-x-2 truncate">
                {getAgencyIcon(agency.icon)}
                <span className="text-[10px] uppercase text-white/70 font-mono truncate">{agency.shortName}</span>
              </div>
              <div
                className={`w-2 h-2 rounded-full ${
                  agency.status === 'ONLINE' ? 'bg-[#10B981]' : 'bg-[#F59E0B]'
                }`}
              />
            </div>
          ))}
        </div>
      </nav>

      <button className="mt-4 w-full py-2.5 bg-[#10B981]/10 border border-[#10B981]/40 rounded text-[#10B981] text-[10px] font-bold uppercase tracking-widest hover:bg-[#10B981]/20 transition-all flex items-center justify-center space-x-2">
        <div className="w-1.5 h-1.5 rounded-full bg-[#10B981] animate-pulse" />
        <span>All Systems Nominal</span>
      </button>
    </aside>
  );
};
