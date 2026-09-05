/**
 * The application shell.
 *
 * Everything that is true on every destination lives here — the command bar,
 * the navigation rail, the palette, notifications, the source-health panel and
 * the global keyboard map — so a module renders only its own content and cannot
 * grow its own private copy of the chrome. That was the previous interface's
 * failure mode: three different header treatments and two navigation styles.
 *
 * The shell also owns ingestion. `startIngestion` is reference-counted and
 * cancels on unmount, which replaces the ad-hoc `setInterval` fetch loops that
 * used to sit in the page component and kept running across navigation.
 */

import { memo, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  Activity,
  BellOff,
  Command,
  Radio,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import type { NavItem, Severity } from '../types';
import { NAV_GROUPS } from '../components/navConfig';
import { refreshFeeds, startIngestion } from '../store/ingest';
import { useFeedList } from '../store/useArka';
import {
  CommandPalette,
  IconButton,
  cx,
  useHotkeys,
  useNotify,
  type CommandGroup,
  type CommandItem,
} from '../ui';
import { CommandBar, SessionChip } from './CommandBar';
import { NavRail, type NavCounts } from './NavRail';
import { SourceHealthDrawer } from './SourceHealthDrawer';

export interface AppShellProps {
  active: NavItem;
  onNavigate: (tab: NavItem) => void;
  /** Unresolved-work counts shown on the rail. */
  counts?: NavCounts;
  alertLevel: Severity;
  onAlertLevelChange: (level: Severity) => void;
  /**
   * Command groups contributed by the active module — "Toggle traffic layer",
   * "Escalate incident". Merged after the shell's own groups so navigation and
   * global actions stay at a stable position in the list.
   */
  commands?: readonly CommandGroup[];
  /** Full-width strip below the bar. Used by the map and dashboard for the ticker. */
  ticker?: ReactNode;
  /**
   * Full-width notice above the ticker — the offline banner, a degraded-mode
   * warning. Kept in the shell so it cannot be hidden behind a module's scroll.
   */
  banner?: ReactNode;
  /** The operating role. No identity provider is wired in; see `SessionChip`. */
  role?: string;
  children: ReactNode;
}

/**
 * A module's own commands are supplied as data rather than rendered, so the
 * palette stays one component with one keyboard model. `CommandGroup` is
 * re-exported for modules that build their groups in a separate file.
 */
export type { CommandGroup, CommandItem };

export const AppShell = memo(function AppShell({
  active,
  onNavigate,
  counts,
  alertLevel,
  onAlertLevelChange,
  commands,
  ticker,
  banner,
  role = 'Operator',
  children,
}: AppShellProps) {
  const feeds = useFeedList();
  const { pendingAck, clearTransient } = useNotify();

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [healthOpen, setHealthOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Ingestion belongs to the shell, not to a page: navigating between modules
  // must not restart the city's data sources. The disposer is reference-counted,
  // so StrictMode's double mount is safe.
  useEffect(() => startIngestion(), []);

  const openPalette = useCallback(() => setPaletteOpen(true), []);
  const closePalette = useCallback(() => setPaletteOpen(false), []);

  const refreshAll = useCallback(() => {
    setRefreshing(true);
    refreshFeeds();
    // The transports report their own state through the feed table; this flag
    // only debounces the button so a held key cannot queue a dozen polls.
    window.setTimeout(() => setRefreshing(false), 900);
  }, []);

  const navigate = useCallback(
    (tab: NavItem) => {
      onNavigate(tab);
      setNavOpen(false);
    },
    [onNavigate],
  );

  // --- Palette contents ------------------------------------------------------

  const groups = useMemo<CommandGroup[]>(() => {
    const navigation: CommandGroup = {
      id: 'navigation',
      label: 'Go to',
      items: NAV_GROUPS.flatMap((group) =>
        group.items.map<CommandItem>((item) => ({
          id: `nav:${item.label}`,
          // The section is part of the destination's name in the palette, so
          // "Cameras" is unambiguous next to a dozen other single-word rows.
          label: group.prefix == null ? item.label : `${group.title} → ${item.label}`,
          hint: item.hint,
          icon: <item.icon size={13} aria-hidden />,
          // `aliases` carries the pre-migration vocabulary. An operator typing
          // "traffic cameras" out of habit lands on Assets → Cameras rather
          // than on nothing, which is the difference between a rename and an
          // apparent removal.
          keywords: [group.title, item.route, ...(item.aliases ?? [])],
          disabled: item.label === active,
          run: () => navigate(item.label),
        })),
      ),
    };

    const operations: CommandGroup = {
      id: 'operations',
      label: 'Operations',
      items: [
        {
          id: 'op:health',
          label: 'Data source health',
          hint: 'Per-source state, last success and cadence',
          icon: <Activity size={13} aria-hidden />,
          keywords: ['feeds', 'diagnostics', 'ingestion', 'latency'],
          run: () => setHealthOpen(true),
        },
        {
          id: 'op:refresh',
          label: 'Re-poll all sources',
          hint: 'Fetch every connected source now',
          icon: <RefreshCw size={13} aria-hidden />,
          keywords: ['reload', 'sync'],
          run: refreshAll,
        },
        {
          id: 'op:clear-toasts',
          label: 'Dismiss transient notifications',
          hint: 'Leaves alerts that still require acknowledgement',
          icon: <BellOff size={13} aria-hidden />,
          keywords: ['clear', 'toast'],
          run: clearTransient,
        },
      ],
    };

    const posture: CommandGroup = {
      id: 'posture',
      label: 'City alert level',
      items: (['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map<CommandItem>((level) => ({
        id: `alert:${level}`,
        label: `Set alert level — ${level}`,
        icon: <ShieldAlert size={13} aria-hidden />,
        keywords: ['posture', 'threat', 'escalate'],
        disabled: level === alertLevel,
        run: () => onAlertLevelChange(level),
      })),
    };

    return [navigation, operations, posture, ...(commands ?? [])];
  }, [active, alertLevel, clearTransient, commands, navigate, onAlertLevelChange, refreshAll]);

  // --- Keyboard map ----------------------------------------------------------

  useHotkeys(
    useMemo(
      () => [
        { key: 'k', ctrlOrMeta: true, allowInInput: true, handler: openPalette, description: 'Command palette' },
        { key: '/', handler: openPalette, description: 'Search' },
        {
          key: 'h',
          ctrlOrMeta: true,
          shift: true,
          handler: () => setHealthOpen((open) => !open),
          description: 'Data source health',
        },
      ],
      [openPalette],
    ),
  );

  return (
    <div className="h-screen w-screen flex flex-col bg-canvas text-ink overflow-hidden">
      <CommandBar
        feeds={feeds}
        alertLevel={alertLevel}
        onAlertLevelChange={onAlertLevelChange}
        onOpenSearch={openPalette}
        onOpenHealth={() => setHealthOpen(true)}
        onRefreshAll={refreshAll}
        refreshing={refreshing}
        pendingAck={pendingAck}
        onOpenMobileNav={() => setNavOpen(true)}
        session={<SessionChip role={role} />}
      />

      {banner}
      {ticker}

      <div className="flex-1 flex min-h-0">
        <NavRail
          active={active}
          onNavigate={navigate}
          counts={counts}
          footer={
            <button
              type="button"
              onClick={openPalette}
              className="w-full flex items-center gap-1.5 text-[11px] text-ink-faint hover:text-ink-muted"
            >
              <Command size={11} aria-hidden />
              <span>Command palette</span>
              <kbd className="ark-kbd ml-auto">Ctrl K</kbd>
            </button>
          }
        />

        <MobileNav open={navOpen} active={active} onNavigate={navigate} onClose={() => setNavOpen(false)} />

        <main className="flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">{children}</main>
      </div>

      <CommandPalette
        open={paletteOpen}
        onClose={closePalette}
        groups={groups}
        placeholder="Search destinations, sources and actions"
        emptyHint="No command matches. Try a domain such as “mobility”, or a source such as “weather”."
      />

      <SourceHealthDrawer
        open={healthOpen}
        onClose={() => setHealthOpen(false)}
        feeds={feeds}
        onRefresh={refreshFeeds}
      />
    </div>
  );
});

/**
 * Navigation below `md`.
 *
 * Reads the same `NAV_GROUPS` as the rail, so labels, order and grouping cannot
 * drift between the two — a real hazard on the previous interface, where the
 * mobile menu was a separate hand-maintained list.
 */
const MobileNav = memo(function MobileNav({
  open,
  active,
  onNavigate,
  onClose,
}: {
  open: boolean;
  active: NavItem;
  onNavigate: (tab: NavItem) => void;
  onClose: () => void;
}) {
  if (!open) return null;
  return (
    <div className="md:hidden fixed inset-0 z-[900] flex">
      <div className="ark-scrim" onClick={onClose} aria-hidden />
      <nav
        aria-label="Primary navigation"
        className="relative h-full w-64 max-w-[85vw] bg-surface border-r border-line flex flex-col"
      >
        <div className="shrink-0 flex items-center justify-between px-3 h-11 border-b border-line">
          <span className="ark-label">Navigate</span>
          <IconButton label="Close navigation" icon={<X size={14} />} onClick={onClose} />
        </div>
        <div className="flex-1 overflow-y-auto ark-scroll px-1.5 py-2">
          {NAV_GROUPS.map((group) => (
            <div key={group.title} className="mb-3 last:mb-0">
              <h2 className="ark-label px-2 mb-1">{group.title}</h2>
              <ul className="space-y-px">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const isActive = item.label === active;
                  return (
                    <li key={item.label}>
                      <button
                        type="button"
                        onClick={() => onNavigate(item.label)}
                        aria-current={isActive ? 'page' : undefined}
                        className={cx('ark-nav-item', isActive && 'is-active')}
                      >
                        <Icon
                          size={15}
                          strokeWidth={1.7}
                          className={cx('shrink-0', isActive ? 'text-accent' : 'text-ink-subtle')}
                          aria-hidden
                        />
                        <span className="truncate">{item.label}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      </nav>
    </div>
  );
});

/**
 * The alert ticker: one line of the most recent operational events.
 *
 * Kept in the shell rather than the dashboard because an operator watching the
 * map still needs to know a feeder tripped. It scrolls on operator action only —
 * a marquee is a decorative animation and the brief rules those out.
 */
export const ShellTicker = memo(function ShellTicker({
  items,
  onSelect,
  right,
}: {
  items: ReadonlyArray<{
    id: string;
    label: string;
    tone?: 'critical' | 'warning' | 'success' | 'info' | 'neutral';
  }>;
  onSelect?: (id: string) => void;
  right?: ReactNode;
}) {
  if (items.length === 0) return null;
  return (
    <div
      className="shrink-0 border-b border-line bg-sunken flex items-center gap-3 px-3 overflow-hidden"
      style={{ height: 'var(--ark-ticker-h)' }}
    >
      <span className="ark-eyebrow flex items-center gap-1.5 shrink-0">
        <Radio size={10} aria-hidden />
        Live
      </span>
      <div className="flex-1 min-w-0 flex items-center gap-4 overflow-x-auto ark-scroll">
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={onSelect ? () => onSelect(item.id) : undefined}
            className={cx(
              'shrink-0 text-[11.5px] whitespace-nowrap',
              onSelect && 'hover:text-ink',
              item.tone === 'critical'
                ? 'text-critical'
                : item.tone === 'warning'
                  ? 'text-warning'
                  : item.tone === 'success'
                    ? 'text-success'
                    : item.tone === 'info'
                      ? 'text-ink-muted'
                      : 'text-ink-subtle',
            )}
          >
            {item.label}
          </button>
        ))}
      </div>
      {right && <div className="shrink-0 flex items-center gap-2">{right}</div>}
    </div>
  );
});
