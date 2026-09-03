/**
 * The command bar.
 *
 * One row across the top of every module: identity, jurisdiction, the global
 * search entry point, the clock, source health, the city alert level, and the
 * operator's session. Nothing else earns a permanent slot.
 *
 * What was removed from the previous header, deliberately:
 *
 * - The glass/blur treatment. Translucency over a moving satellite basemap is
 *   unreadable, and the token file has no `backdrop-filter` for that reason.
 * - The hardcoded "Systems normal" pill, which was styled green unconditionally
 *   and only switched its *icon* when streams were degraded.
 * - The weather popover's `|| 14.2`, `?? 98` and `?? 18` fallbacks, which
 *   printed invented wind speed, confidence and latency whenever the feed was
 *   silent. Weather is a module; a bar is the wrong place to assert its values.
 *
 * Source health here is the real feed table rolled up by `summariseFeeds`, and
 * it reads `unknown` — not green — when no feed has registered.
 */

import { memo, type ReactNode } from 'react';
import { AlertTriangle, Bell, Menu, RefreshCw, Search, ShieldAlert } from 'lucide-react';
import type { Severity } from '../types';
import type { FeedStatus } from '../store/ArkaStore';
import {
  Button,
  IconButton,
  Kbd,
  Segmented,
  SystemHealthIndicator,
  cx,
  summariseFeeds,
  useClock,
} from '../ui';

const IST = 'Asia/Kolkata';

const CLOCK_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  hour12: false,
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
});

const DATE_FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: IST,
  weekday: 'short',
  day: '2-digit',
  month: 'short',
});

const ALERT_LEVELS: ReadonlyArray<{ value: Severity; label: string; hint: string }> = [
  { value: 'LOW', label: 'LOW', hint: 'Routine posture. Normal staffing.' },
  { value: 'MEDIUM', label: 'MED', hint: 'Elevated watch. Duty officer informed.' },
  { value: 'HIGH', label: 'HIGH', hint: 'Heightened readiness. Agencies on standby.' },
  { value: 'CRITICAL', label: 'CRIT', hint: 'City-wide emergency posture. All agencies mobilised.' },
];

export interface CommandBarProps {
  /** Real feed table from the store. Empty is a legitimate state, not an error. */
  feeds: readonly FeedStatus[];
  alertLevel: Severity;
  onAlertLevelChange: (level: Severity) => void;
  /** Opens the command palette. The bar shows the shortcut; the shell binds it. */
  onOpenSearch: () => void;
  /** Opens the source-health panel. */
  onOpenHealth: () => void;
  onRefreshAll: () => void;
  refreshing?: boolean;
  /** Unacknowledged alert count from the notification queue. */
  pendingAck?: number;
  onOpenAlerts?: () => void;
  onOpenMobileNav?: () => void;
  /** Session and role chip, supplied by the shell. */
  session?: ReactNode;
}

export const CommandBar = memo(function CommandBar({
  feeds,
  alertLevel,
  onAlertLevelChange,
  onOpenSearch,
  onOpenHealth,
  onRefreshAll,
  refreshing = false,
  pendingAck = 0,
  onOpenAlerts,
  onOpenMobileNav,
  session,
}: CommandBarProps) {
  // Quantised to the second, so the bar re-renders once per tick rather than on
  // every store mutation that happens to pass through.
  const now = useClock(1);
  const health = summariseFeeds(feeds);

  return (
    <header
      className="shrink-0 bg-surface border-b border-line flex items-center gap-2 px-2 sm:px-3 relative z-[300]"
      style={{ height: 'var(--ark-bar-h)' }}
    >
      {onOpenMobileNav && (
        <IconButton
          label="Open navigation"
          icon={<Menu size={15} />}
          onClick={onOpenMobileNav}
          className="md:hidden"
        />
      )}

      {/* --- Identity ---------------------------------------------------- */}
      <div className="flex items-baseline gap-1.5 shrink-0 select-none">
        <span className="text-[15px] font-semibold tracking-tight text-ink">ARKA</span>
        <span className="ark-eyebrow hidden sm:inline">City Operating System</span>
      </div>

      <span className="hidden lg:block h-4 w-px bg-line-strong shrink-0" aria-hidden />

      <span
        className="hidden lg:flex items-baseline gap-1.5 shrink-0 text-[11.5px]"
        title="Jurisdiction covered by this deployment"
      >
        <span className="text-ink-faint">Jurisdiction</span>
        <span className="text-ink-muted font-medium">Bhubaneswar · BMC · Odisha</span>
      </span>

      {/* --- Global search ------------------------------------------------ */}
      {/* A button rather than an input: the palette owns the query, and an empty
          field in the bar invites typing into something that cannot search. */}
      <button
        type="button"
        onClick={onOpenSearch}
        className="ark-input flex-1 min-w-0 max-w-md mx-auto flex items-center gap-2 text-left cursor-pointer hover:border-line-bright"
        aria-label="Search modules, assets, incidents and actions"
      >
        <Search size={13} className="text-ink-faint shrink-0" aria-hidden />
        <span className="flex-1 truncate text-ink-faint text-[12px]">Search or run a command</span>
        <Kbd keys={['Ctrl', 'K']} />
      </button>

      <div className="flex items-center gap-1.5 shrink-0 ml-auto">
        {/* --- Clock ----------------------------------------------------- */}
        <span className="hidden md:flex items-baseline gap-1.5" title="Indian Standard Time">
          <span className="ark-mono text-[10.5px] text-ink-faint">{DATE_FORMAT.format(now)}</span>
          <span className="ark-mono text-[12px] text-ink tabular-nums">{CLOCK_FORMAT.format(now)}</span>
          <span className="ark-eyebrow">IST</span>
        </span>

        <span className="hidden md:block h-4 w-px bg-line-strong" aria-hidden />

        {/* --- Source health -------------------------------------------- */}
        <button
          type="button"
          onClick={onOpenHealth}
          className="flex items-center gap-1.5 cursor-pointer"
          aria-label={`Data source health: ${health.live} of ${health.total} live. Open diagnostics.`}
          title="Open data-source health and ingestion diagnostics"
        >
          <SystemHealthIndicator health={health.health} live={health.live} total={health.total} />
          <span className="hidden xl:inline text-[11.5px] text-ink-muted">Sources</span>
        </button>

        {/* --- City alert level ----------------------------------------- */}
        <div className="hidden sm:flex items-center gap-1.5" title="City-wide alert posture">
          <ShieldAlert
            size={13}
            className={cx('shrink-0', alertLevel === 'CRITICAL' ? 'text-critical' : 'text-ink-subtle')}
            aria-hidden
          />
          <Segmented
            label="City alert level"
            value={alertLevel}
            options={ALERT_LEVELS}
            onChange={onAlertLevelChange}
          />
        </div>

        {/* --- Unacknowledged alerts ------------------------------------ */}
        {onOpenAlerts && (
          <button
            type="button"
            onClick={onOpenAlerts}
            className="ark-icon-btn relative"
            aria-label={
              pendingAck > 0
                ? `${pendingAck} alert${pendingAck === 1 ? '' : 's'} awaiting acknowledgement`
                : 'Alerts — none awaiting acknowledgement'
            }
            title={pendingAck > 0 ? `${pendingAck} awaiting acknowledgement` : 'No alerts awaiting acknowledgement'}
          >
            {pendingAck > 0 ? <AlertTriangle size={14} className="text-warning" /> : <Bell size={14} />}
            {pendingAck > 0 && (
              <span className="absolute -top-0.5 -right-0.5 ark-mono text-[9px] leading-none px-1 py-0.5 rounded-[2px] bg-warning-fill text-ink-inverse font-semibold">
                {pendingAck > 9 ? '9+' : pendingAck}
              </span>
            )}
          </button>
        )}

        <IconButton
          label="Refresh all sources"
          hint="Re-poll every connected source now"
          icon={<RefreshCw size={13} className={cx(refreshing && 'ark-spin')} />}
          onClick={onRefreshAll}
          disabled={refreshing}
        />

        {session}
      </div>
    </header>
  );
});

/**
 * The session and role indicator.
 *
 * Government-grade requirement from the brief, and honest about what this build
 * knows: there is no authentication service wired in, so it states the role the
 * interface is operating *as* rather than implying a verified identity.
 */
export const SessionChip = memo(function SessionChip({
  role,
  onOpen,
}: {
  role: string;
  onOpen?: () => void;
}) {
  const content = (
    <>
      <span className="w-1.5 h-1.5 rounded-full bg-success shrink-0" aria-hidden />
      <span className="ark-mono text-[10.5px] text-ink-muted uppercase tracking-wide">{role}</span>
    </>
  );
  const className = 'flex items-center gap-1.5 px-1.5 py-1 rounded-[3px] border border-line bg-surface shrink-0';
  const hint = `Interface is operating with ${role} permissions. No identity provider is configured in this deployment.`;

  if (!onOpen) {
    return (
      <span className={className} title={hint}>
        {content}
      </span>
    );
  }
  return (
    <Button variant="quiet" size="xs" onClick={onOpen} title={hint} className="shrink-0">
      {content}
    </Button>
  );
});
