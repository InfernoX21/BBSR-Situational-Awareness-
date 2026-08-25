import React, { useState } from 'react';
import { NavItem, Agency } from '../types';
import { NAV_GROUPS } from './navConfig';
import {
  Activity,
  Building2,
  Car,
  Flame,
  HeartPulse,
  ShieldAlert,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

interface SidebarProps {
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  agencies: Agency[];
  onAgencyClick?: (agency: Agency) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  agencies,
  onAgencyClick,
}) => {
  const [isAgencyExpanded, setIsAgencyExpanded] = useState(false);

  const getAgencyIcon = (iconName: string) => {
    const cls = 'w-4 h-4 text-ink-subtle';
    switch (iconName) {
      case 'Building2': return <Building2 className={cls} />;
      case 'ShieldAlert': return <ShieldAlert className={cls} />;
      case 'Flame': return <Flame className={cls} />;
      case 'AlertTriangle': return <AlertTriangle className={cls} />;
      case 'HeartPulse': return <HeartPulse className={cls} />;
      case 'Car': return <Car className={cls} />;
      case 'Zap': return <Zap className={cls} />;
      default: return <Activity className={cls} />;
    }
  };

  const offlineAgencies = agencies.filter((a) => a.status !== 'ONLINE');

  return (
    <aside
      aria-label="Primary navigation"
      className="hidden md:flex w-52 lg:w-56 xl:w-64 shrink-0 h-full bg-surface border-r border-line flex-col min-h-0 transition-all duration-300 select-none"
    >
      {/* Navigation & Agency Status (Single Scrollable Container) */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 gov-scroll-thin min-h-0">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-5 last:mb-0">
            <h2 className="gov-label px-2 mb-1.5">{group.title}</h2>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = activeTab === item.label;
                const Icon = item.icon;
                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => setActiveTab(item.label)}
                      title={item.hint}
                      aria-current={isActive ? 'page' : undefined}
                      className={`gov-nav-item ${isActive ? 'is-active' : ''}`}
                    >
                      <Icon
                        className={`w-4 h-4 shrink-0 ${isActive ? 'text-accent' : 'text-ink-subtle'}`}
                        aria-hidden="true"
                      />
                      <span className="truncate">{item.label}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        {/* Agency status */}
        <div className="border-t border-line px-1 py-3 mt-4">
          <button
            type="button"
            onClick={() => setIsAgencyExpanded(!isAgencyExpanded)}
            className="w-full flex items-center justify-between px-1 mb-2 text-left group cursor-pointer focus:outline-none focus:ring-1 focus:ring-accent/50 rounded py-0.5"
            aria-expanded={isAgencyExpanded}
            aria-label="Toggle Agency Status section"
          >
            <div className="flex items-center gap-2 min-w-0">
              <h2 className="gov-label mb-0 cursor-pointer select-none group-hover:text-ink transition-colors">
                Agency status
              </h2>
              {!isAgencyExpanded && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded font-mono font-medium ${
                    offlineAgencies.length === 0
                      ? 'bg-success-soft text-success'
                      : 'bg-warning-soft text-warning'
                  }`}
                >
                  {offlineAgencies.length === 0
                    ? 'All Online'
                    : `${agencies.length - offlineAgencies.length}/${agencies.length}`}
                </span>
              )}
            </div>
            {isAgencyExpanded ? (
              <ChevronDown
                className="w-3.5 h-3.5 text-ink-subtle group-hover:text-ink transition-colors shrink-0"
                aria-hidden="true"
              />
            ) : (
              <ChevronRight
                className="w-3.5 h-3.5 text-ink-subtle group-hover:text-ink transition-colors shrink-0"
                aria-hidden="true"
              />
            )}
          </button>

          {isAgencyExpanded && (
            <div className="space-y-3">
              <ul className="space-y-0.5">
                {agencies.map((agency) => {
                  const online = agency.status === 'ONLINE';
                  return (
                    <li key={agency.id}>
                      <button
                        type="button"
                        onClick={() => onAgencyClick && onAgencyClick(agency)}
                        title={`${agency.name} — ${agency.activeUnits} active units`}
                        className="w-full flex items-center justify-between gap-2 px-1.5 py-1.5 rounded-md hover:bg-sunken transition-colors text-left"
                      >
                        <span className="flex items-center gap-2 min-w-0">
                          {getAgencyIcon(agency.icon)}
                          <span className="text-[12px] font-medium text-ink truncate">
                            {agency.shortName}
                          </span>
                        </span>
                        <span
                          className={`gov-badge ${online ? 'is-low' : 'is-high'}`}
                          aria-label={`${agency.shortName} is ${online ? 'online' : 'on standby'}`}
                        >
                          {online ? 'Online' : 'Standby'}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>

              {/* System status summary */}
              <div
                role="status"
                className={`px-3 py-2 rounded-md border flex items-center gap-2 text-[12px] font-semibold ${
                  offlineAgencies.length === 0
                    ? 'bg-success-soft border-success-border text-success'
                    : 'bg-warning-soft border-warning-border text-warning'
                }`}
              >
                {offlineAgencies.length === 0 ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                ) : (
                  <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
                )}
                <span>
                  {offlineAgencies.length === 0
                    ? 'All agency links operational'
                    : `${offlineAgencies.length} agency link${
                        offlineAgencies.length > 1 ? 's' : ''
                      } on standby`}
                </span>
              </div>
            </div>
          )}
        </div>
      </nav>
    </aside>
  );
};

