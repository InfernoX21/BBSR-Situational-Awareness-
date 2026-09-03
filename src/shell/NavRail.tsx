/**
 * The primary navigation rail.
 *
 * Replaces the previous sidebar, which mixed two unrelated jobs — routing and
 * agency telemetry — into one scrolling column, so the fifteen modules competed
 * for attention with a list of agency badges. Agency status is operational data
 * and now lives where operational data lives: in a panel, on the dashboard.
 *
 * Three things the rail does that the old sidebar did not:
 *
 * 1. **Collapses to icons.** On the map — the primary interface — 232px of
 *    labels is 232px of city the operator cannot see. The state persists, so an
 *    operator who works collapsed stays collapsed across reloads.
 *
 * 2. **Carries counts.** A module with unresolved work says so on the rail.
 *    The count is the real number from the store, and absent rather than zero
 *    when the platform has not established one.
 *
 * 3. **Marks the active module by position as well as colour** — a 2px bar at
 *    the rail edge, via `.ark-nav-item.is-active::before`. A wall display with
 *    washed-out gamma still shows it.
 */

import { memo, type ReactNode } from 'react';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import type { NavItem } from '../types';
import { NAV_GROUPS } from '../components/navConfig';
import { cx, IconButton, useStoredState } from '../ui';

/**
 * Unresolved-work counts per module.
 *
 * Deliberately `number | null | undefined`: null means "this module tracks a
 * count and it is genuinely zero", undefined means "no count applies here".
 * Zero renders nothing — a badge reading 0 is noise on fifteen rows.
 */
export type NavCounts = Partial<Record<NavItem, number | null>>;

export interface NavRailProps {
  active: NavItem;
  onNavigate: (tab: NavItem) => void;
  counts?: NavCounts;
  /** Rendered at the foot of the rail: the session and role indicator. */
  footer?: ReactNode;
}

export const NavRail = memo(function NavRail({ active, onNavigate, counts = {}, footer }: NavRailProps) {
  const [collapsed, setCollapsed] = useStoredState<boolean>('shell.rail.collapsed', false);

  return (
    <nav
      aria-label="Primary navigation"
      className="hidden md:flex shrink-0 h-full bg-surface border-r border-line flex-col min-h-0 select-none"
      style={{ width: collapsed ? 'var(--ark-rail-w-collapsed)' : 'var(--ark-rail-w)' }}
    >
      <div className="flex-1 overflow-y-auto ark-scroll min-h-0 px-1.5 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mb-3 last:mb-0">
            {/* Collapsed, a group heading would wrap to four unreadable lines.
                The hairline keeps the grouping without the words. */}
            {collapsed ? (
              <hr className="border-0 border-t border-line mx-1.5 my-1.5 first:hidden" />
            ) : (
              <h2 className="ark-label px-2 mb-1">{group.title}</h2>
            )}

            <ul className="space-y-px">
              {group.items.map((item) => {
                const isActive = active === item.label;
                const Icon = item.icon;
                const count = counts[item.label];
                return (
                  <li key={item.label}>
                    <button
                      type="button"
                      onClick={() => onNavigate(item.label)}
                      title={collapsed ? `${item.label} — ${item.hint}` : item.hint}
                      aria-current={isActive ? 'page' : undefined}
                      className={cx('ark-nav-item', isActive && 'is-active', collapsed && 'justify-center px-0')}
                    >
                      <Icon
                        size={15}
                        strokeWidth={1.7}
                        className={cx('shrink-0', isActive ? 'text-accent' : 'text-ink-subtle')}
                        aria-hidden
                      />
                      {!collapsed && <span className="truncate flex-1">{item.label}</span>}
                      {count != null && count > 0 && (
                        <span
                          className={cx(
                            'ark-mono shrink-0 text-[10px] tabular-nums',
                            collapsed
                              ? 'absolute top-0.5 right-0.5 text-accent'
                              : 'px-1 py-px rounded-[2px] bg-sunken-strong text-ink-muted',
                          )}
                          aria-label={`${count} unresolved`}
                        >
                          {count > 99 ? '99+' : count}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>

      {footer && !collapsed && <div className="shrink-0 border-t border-line p-2">{footer}</div>}

      <div className={cx('shrink-0 border-t border-line p-1.5 flex', collapsed ? 'justify-center' : 'justify-end')}>
        <IconButton
          label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          hint={collapsed ? 'Expand navigation rail' : 'Collapse to icons — more map'}
          icon={collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
          onClick={() => setCollapsed(!collapsed)}
        />
      </div>
    </nav>
  );
});
