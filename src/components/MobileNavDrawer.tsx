import React from 'react';
import { NavItem, Agency } from '../types';
import { NAV_GROUPS } from './navConfig';
import { X } from 'lucide-react';

interface MobileNavDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: NavItem;
  setActiveTab: (tab: NavItem) => void;
  agencies: Agency[];
}

export const MobileNavDrawer: React.FC<MobileNavDrawerProps> = ({
  isOpen,
  onClose,
  activeTab,
  setActiveTab,
  agencies,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex md:hidden">
      {/* Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 bg-navy/40 backdrop-blur-[2px]"
      />

      {/* Slide-out drawer */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="relative w-[85%] max-w-xs bg-surface border-r border-line h-full flex flex-col z-10 shadow-lg"
      >
        {/* Drawer header */}
        <div className="flex items-center justify-between gap-3 px-4 py-3 bg-navy text-white shrink-0">
          <div className="min-w-0">
            <div className="text-[15px] font-bold tracking-tight">ARKA</div>
            <div className="text-[11px] text-white/70 truncate">
              Bhubaneswar Operations
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close navigation menu"
            className="w-11 h-11 rounded-md bg-white/10 hover:bg-white/20 flex items-center justify-center text-white shrink-0"
          >
            <X className="w-5 h-5" aria-hidden="true" />
          </button>
        </div>

        {/* Navigation (touch targets >= 44px) */}
        <nav
          aria-label="Primary navigation"
          className="flex-1 overflow-y-auto px-3 py-3"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-4 last:mb-0">
              <h2 className="gov-label px-2 mb-1.5">{group.title}</h2>
              <ul className="space-y-1">
                {group.items.map((item) => {
                  const isActive = activeTab === item.label;
                  const Icon = item.icon;
                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab(item.label);
                          onClose();
                        }}
                        aria-current={isActive ? 'page' : undefined}
                        className={`gov-nav-item min-h-[46px] text-[14px] ${
                          isActive ? 'is-active' : ''
                        }`}
                      >
                        <Icon
                          className={`w-5 h-5 shrink-0 ${
                            isActive ? 'text-accent' : 'text-ink-subtle'
                          }`}
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
        </nav>

        {/* Agency readiness footer */}
        <div className="border-t border-line px-3 py-3 shrink-0">
          <h2 className="gov-label px-1 mb-2">Agency readiness</h2>
          <div className="grid grid-cols-2 gap-1.5">
            {agencies.slice(0, 4).map((ag) => {
              const online = ag.status === 'ONLINE';
              return (
                <div
                  key={ag.id}
                  className="px-2 py-1.5 gov-inset flex items-center justify-between gap-1"
                >
                  <span className="text-[11px] font-semibold text-ink truncate">
                    {ag.shortName}
                  </span>
                  <span className={`gov-badge ${online ? 'is-low' : 'is-high'}`}>
                    {online ? 'Up' : 'Std'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
