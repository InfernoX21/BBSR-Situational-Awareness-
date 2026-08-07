import React from 'react';
import { NavItem, Agency } from '../types';
import {
  Activity,
  Bot,
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
  X,
  ShieldAlert,
  Flame,
  HeartPulse,
} from 'lucide-react';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  agencies: Agency[];
}

const NAV_ITEMS: { label: NavItem; icon: React.ReactNode }[] = [
  { label: 'Dashboard', icon: <Activity className="w-5 h-5 text-blue-400" /> },
  { label: 'AI Operations', icon: <Bot className="w-5 h-5 text-[#06B6D4]" /> },
  { label: 'Live Map', icon: <Map className="w-5 h-5 text-emerald-400" /> },
  { label: 'Intelligence Feed', icon: <Rss className="w-5 h-5 text-purple-400" /> },
  { label: 'Incident Center', icon: <AlertTriangle className="w-5 h-5 text-red-400" /> },
  { label: 'Traffic Management', icon: <Car className="w-5 h-5 text-amber-400" /> },
  { label: 'Traffic Cameras', icon: <Video className="w-5 h-5 text-[#06B6D4]" /> },
  { label: 'Weather & Disaster', icon: <CloudRain className="w-5 h-5 text-cyan-400" /> },
  { label: 'Infrastructure', icon: <Building2 className="w-5 h-5 text-[#10B981]" /> },
  { label: 'Utilities', icon: <Zap className="w-5 h-5 text-yellow-400" /> },
  { label: 'Resource Tracker', icon: <Radio className="w-5 h-5 text-orange-400" /> },
  { label: 'Drone Feed', icon: <Video className="w-5 h-5 text-indigo-400" /> },
  { label: 'Analytics', icon: <BarChart3 className="w-5 h-5 text-pink-400" /> },
  { label: 'Reports', icon: <FileText className="w-5 h-5 text-slate-300" /> },
  { label: 'Settings', icon: <Settings className="w-5 h-5 text-slate-400" /> },
];

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  agencies,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden font-mono select-none">
      {/* Backdrop */}
      <div
        onClick={onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-sm transition-opacity"
      />

      {/* Slide-out Drawer Panel */}
      <div className="relative w-4/5 max-w-xs bg-[#090D16] border-r border-white/15 h-full flex flex-col p-4 z-10 shadow-2xl overflow-y-auto">
        {/* Drawer Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-4 mb-4">
          <div>
            <h1 className="text-xl font-bold tracking-tighter text-white">
              ARKA<span className="text-[#06B6D4] font-light">.OS</span>
            </h1>
            <p className="text-[9px] text-white/40 uppercase tracking-[0.25em] mt-0.5">
              Mobile EOC Command
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close navigation menu"
            className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center text-white/70 active:bg-white/20 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Navigation Items (Touch Target Size >= 48px) */}
        <nav className="flex-1 space-y-1.5 overflow-y-auto pr-1">
          <div className="text-[10px] font-bold text-white/40 uppercase tracking-widest px-2 mb-2">
            Command Center Modules
          </div>
          {NAV_ITEMS.map((item) => {
            const isActive = activeTab === item.label;
            return (
              <button
                key={item.label}
                onClick={() => {
                  setActiveTab(item.label);
                  onClose();
                }}
                className={`w-full min-h-[48px] px-3 py-2.5 rounded-lg flex items-center space-x-3.5 transition-all text-xs font-bold ${
                  isActive
                    ? 'bg-blue-600/30 border border-blue-400 text-white shadow-[0_0_12px_#3b82f6]'
                    : 'bg-white/5 border border-white/5 text-white/70 active:bg-white/10 active:text-white'
                }`}
              >
                <span>{item.icon}</span>
                <span className="truncate uppercase tracking-wider">{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Agency Readiness Footer */}
        <div className="border-t border-white/10 pt-3 mt-4 space-y-2">
          <div className="text-[9px] font-bold text-white/40 uppercase tracking-widest px-1">
            Emergency Agency Readiness
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {agencies.slice(0, 4).map((ag) => (
              <div
                key={ag.id}
                className="p-1.5 bg-white/5 rounded border border-white/5 flex items-center justify-between text-[9px]"
              >
                <span className="text-white/80 font-bold truncate">{ag.shortName}</span>
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
