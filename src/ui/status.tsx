/**
 * ARKA status, severity and provenance vocabulary.
 *
 * The platform has exactly one way to say "this is critical", one way to say
 * "this camera is offline" and one way to say "this number came from a model, at
 * 09:14, and is four minutes old". They are all here.
 *
 * Colour is never the only channel. Every badge carries a word; severity also
 * carries a rail position on its row; provisional data states also carry a
 * dashed border. A control room has operators with colour-vision deficiency and
 * wall displays with washed-out gamma, and both have to be able to read it.
 */

import { memo, type ReactNode } from 'react';
import { AlertTriangle, Check, CircleDashed, Radio, RefreshCw, Wifi, WifiOff } from 'lucide-react';
import type { ConnectionStatus, Severity } from '../types';
import {
  DATA_STATE_HELP,
  DATA_STATE_LABEL,
  formatAge,
  formatClock,
  type DataError,
  type DataState,
  type SourceMeta,
} from '../shared/dataState';
import type { EntityHealth } from '../store/entities';
import type { FeedStatus } from '../store/ArkaStore';
import { HEALTH_COLOR } from './tokens';
import { useAge } from './hooks';
import { cx } from './cx';

// --- Severity ----------------------------------------------------------------

const SEVERITY_CLASS: Record<Severity, string> = {
  CRITICAL: 'is-critical',
  HIGH: 'is-high',
  MEDIUM: 'is-medium',
  LOW: 'is-low',
};

/** Rail modifier for a row carrying this severity. */
export const SEVERITY_RAIL: Record<Severity, 'critical' | 'high' | 'medium' | 'low'> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MEDIUM: 'medium',
  LOW: 'low',
};

export const SeverityBadge = memo(function SeverityBadge({
  severity,
  solid = false,
  className,
}: {
  severity: Severity;
  /** Filled treatment, for a single critical item that must dominate. */
  solid?: boolean;
  className?: string;
}) {
  const solidCritical = solid && severity === 'CRITICAL';
  return (
    <span
      className={cx('ark-badge', solidCritical ? 'is-solid-critical' : SEVERITY_CLASS[severity], className)}
    >
      {severity}
    </span>
  );
});

// --- Generic status badge ----------------------------------------------------

export type BadgeTone = 'critical' | 'high' | 'medium' | 'low' | 'success' | 'info' | 'accent' | 'neutral';

export const StatusBadge = memo(function StatusBadge({
  label,
  tone = 'neutral',
  icon,
  hint,
  className,
}: {
  label: string;
  tone?: BadgeTone;
  icon?: ReactNode;
  hint?: string;
  className?: string;
}) {
  return (
    <span className={cx('ark-badge', `is-${tone}`, className)} title={hint}>
      {icon}
      {label}
    </span>
  );
});

/**
 * Operational status of a record, mapped to a tone.
 *
 * One table, so an incident that is DISPATCHED reads identically wherever it
 * appears. Unknown strings fall through to neutral rather than guessing.
 */
const STATUS_TONE: Record<string, BadgeTone> = {
  // Incidents
  ACTIVE: 'critical',
  DISPATCHED: 'high',
  CONTAINED: 'medium',
  RESOLVED: 'success',
  // Field units and agencies
  AVAILABLE: 'success',
  ASSIGNED: 'info',
  EN_ROUTE: 'high',
  RETURNING: 'info',
  OFFLINE: 'neutral',
  ONLINE: 'success',
  STANDBY: 'info',
  BUSY: 'high',
  // Assets
  OPERATIONAL: 'success',
  NORMAL: 'success',
  READY: 'success',
  ALERT: 'critical',
  WARNING: 'high',
  MAINTENANCE: 'medium',
  CRITICAL_OUTAGE: 'critical',
  FULL: 'high',
  DIVERTING: 'high',
  DEPLOYED: 'info',
  // Workflow and agents
  IDLE: 'neutral',
  WAITING: 'medium',
  ERROR: 'critical',
  PENDING: 'neutral',
  NOTIFIED: 'info',
  ACKNOWLEDGED: 'success',
  FAILED: 'critical',
  RUNNING: 'accent',
  COMPLETED: 'success',
  AWAITING_CONFIRMATION: 'high',
  // Congestion
  CLEAR: 'success',
  SLOW: 'medium',
  MODERATE: 'medium',
  JAMMED: 'high',
  HEAVY: 'high',
  SEVERE: 'critical',
};

export function toneForStatus(status: string): BadgeTone {
  return STATUS_TONE[status] ?? 'neutral';
}

/** Status badge that derives its tone from the status string itself. */
export const OperationalBadge = memo(function OperationalBadge({
  status,
  className,
}: {
  status: string;
  className?: string;
}) {
  return (
    <span className={cx('ark-badge', `is-${toneForStatus(status)}`, className)}>{status.replace(/_/g, ' ')}</span>
  );
});

// --- Health dot --------------------------------------------------------------

const HEALTH_LABEL: Record<EntityHealth, string> = {
  nominal: 'Nominal',
  attention: 'Needs attention',
  critical: 'Critical',
  offline: 'Offline — no telemetry',
  resolved: 'Resolved',
};

/**
 * A 7px status dot.
 *
 * `offline` is drawn hollow, not grey-filled: an asset ARKA has lost contact
 * with must not look like an asset ARKA has confirmed is fine.
 */
export const HealthDot = memo(function HealthDot({
  health,
  size = 7,
  live = false,
  className,
}: {
  health: EntityHealth;
  size?: number;
  /** Adds the slow heartbeat, for a source that is actively updating. */
  live?: boolean;
  className?: string;
}) {
  const hollow = health === 'offline';
  return (
    <span
      role="img"
      aria-label={HEALTH_LABEL[health]}
      title={HEALTH_LABEL[health]}
      className={cx('inline-block rounded-full shrink-0', live && !hollow && 'ark-live-dot', className)}
      style={{
        width: size,
        height: size,
        backgroundColor: hollow ? 'transparent' : HEALTH_COLOR[health],
        border: hollow ? `1.5px solid ${HEALTH_COLOR.offline}` : undefined,
      }}
    />
  );
});

// --- Data-state tag ----------------------------------------------------------

const STATE_CLASS: Record<DataState, string> = {
  LIVE: 'is-live',
  CACHED: 'is-cached',
  SEED: 'is-seed',
  SIMULATED: 'is-simulated',
  FALLBACK: 'is-fallback',
  UNAVAILABLE: 'is-unavailable',
};

/**
 * The badge that says where a value came from.
 *
 * Mandatory on any panel showing operational values. The tooltip carries the
 * provider, the caveat the provider requires, and the cadence — everything an
 * operator needs to decide how much weight to put on the number.
 */
export const DataStateTag = memo(function DataStateTag({
  state,
  source,
  ageSeconds,
  error,
  className,
}: {
  state: DataState;
  source?: SourceMeta | null;
  /** Age in seconds. Appended to the tag when supplied. */
  ageSeconds?: number | null;
  error?: DataError | null;
  className?: string;
}) {
  const parts = [DATA_STATE_HELP[state]];
  if (source) {
    parts.push(`Source: ${source.provider} (${source.kind}).`);
    if (source.note) parts.push(source.note);
    if (source.cadenceSeconds) parts.push(`Publishes about every ${source.cadenceSeconds}s.`);
  }
  if (error) parts.push(`${error.code}: ${error.message}`);

  return (
    <span className={cx('ark-tag', STATE_CLASS[state], className)} title={parts.join(' ')}>
      {state === 'LIVE' && <Radio size={8} aria-hidden />}
      {DATA_STATE_LABEL[state]}
      {ageSeconds != null && <span className="opacity-70">· {formatAge(ageSeconds)}</span>}
    </span>
  );
});

// --- Age and clock -----------------------------------------------------------

/**
 * Self-updating relative age.
 *
 * Renders an explicit "no timestamp" when the source did not supply one, because
 * a missing publication time silently rendered as blank is how a three-day-old
 * bulletin ends up read as breaking news.
 */
export const Age = memo(function Age({
  iso,
  prefix,
  className,
}: {
  iso: string | null | undefined;
  /** e.g. "Updated". */
  prefix?: string;
  className?: string;
}) {
  const age = useAge(iso);
  if (age == null) {
    return (
      <span className={cx('ark-unknown', className)} title="The source did not supply a timestamp.">
        NO TIMESTAMP
      </span>
    );
  }
  return (
    <span className={cx('ark-mono text-[10.5px] text-ink-subtle', className)} title={iso ?? undefined}>
      {prefix ? `${prefix} ` : ''}
      {formatAge(age)}
    </span>
  );
});

/** Absolute local clock time, for audit lines where the exact moment matters. */
export const Clock = memo(function Clock({ iso, className }: { iso: string | null | undefined; className?: string }) {
  return (
    <span className={cx('ark-mono text-[10.5px] text-ink-subtle', className)} title={iso ?? undefined}>
      {formatClock(iso ?? null)}
    </span>
  );
});

// --- Provenance strip --------------------------------------------------------

/**
 * The standard "where this came from" line under a panel header.
 *
 * Composes the state tag, the provider name and the age into one element so no
 * page has to decide the order, and so a panel cannot ship with two of the three.
 */
export const Provenance = memo(function Provenance({
  state,
  source,
  fetchedAt,
  error,
  showProvider = true,
  className,
}: {
  state: DataState;
  source?: SourceMeta | null;
  fetchedAt?: string | null;
  error?: DataError | null;
  showProvider?: boolean;
  className?: string;
}) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 min-w-0', className)}>
      <DataStateTag state={state} source={source} error={error} />
      {showProvider && source && source.kind !== 'none' && (
        <span className="text-[10.5px] text-ink-faint truncate" title={source.note}>
          {source.provider}
        </span>
      )}
      {fetchedAt !== undefined && <Age iso={fetchedAt} />}
    </span>
  );
});

// --- Model confidence --------------------------------------------------------

/**
 * A model's confidence in its own output.
 *
 * Shown only when the record shows its working. `basis` is the list of signals
 * the model consumed; with an empty basis this renders UNSCORED rather than a
 * number, matching the rule already enforced in `src/store/ingest/incidents.ts`:
 * a percentage with nothing behind it is a figure, not a confidence.
 *
 * The tag is deliberately neutral-toned. Colouring it would put it on the
 * severity ramp, and "how sure the model is" is not "how bad it is".
 */
export const Confidence = memo(function Confidence({
  /** Percentage, 0–100. */
  value,
  /** Signals the model used. Empty or absent means the score is unsupported. */
  basis,
  className,
}: {
  value: number | null | undefined;
  basis?: readonly string[];
  className?: string;
}) {
  const supported = (basis?.length ?? 0) > 0;
  if (value == null || !Number.isFinite(value) || value <= 0 || !supported) {
    return (
      <span
        className={cx('ark-unknown', className)}
        title={
          supported
            ? 'The model did not report a confidence for this record.'
            : 'No evidence sources or reasoning are attached, so any score would be unsupported.'
        }
      >
        UNSCORED
      </span>
    );
  }
  const pct = Math.round(Math.min(100, value > 1 ? value : value * 100));
  return (
    <span
      className={cx('ark-tag', className)}
      title={`Model confidence ${pct}%. Basis: ${basis!.join(', ')}.`}
    >
      CONF {pct}%
    </span>
  );
});

// --- Meter -------------------------------------------------------------------

/**
 * A proportion bar.
 *
 * `value` is null when the quantity is genuinely unknown, which draws an empty
 * track rather than a zero-width bar — a full-looking meter at 0% and an unknown
 * meter must not look the same.
 */
export const Meter = memo(function Meter({
  value,
  tone = 'accent',
  className,
}: {
  value: number | null;
  tone?: 'accent' | 'critical' | 'high' | 'medium' | 'low' | 'info';
  className?: string;
}) {
  const pct = value == null ? 0 : Math.max(0, Math.min(100, value));
  const colour =
    tone === 'accent'
      ? 'var(--color-accent)'
      : tone === 'critical'
        ? 'var(--color-critical-fill)'
        : tone === 'high'
          ? 'var(--color-warning-fill)'
          : tone === 'medium'
            ? 'var(--color-caution-fill)'
            : tone === 'low'
              ? 'var(--color-success-fill)'
              : 'var(--color-info-fill)';
  return (
    <div
      className={cx('ark-meter', className)}
      role="meter"
      aria-valuenow={value ?? undefined}
      aria-valuemin={0}
      aria-valuemax={100}
      title={value == null ? 'Not reported' : `${Math.round(pct)}%`}
    >
      <span style={{ width: `${pct}%`, backgroundColor: colour }} />
    </div>
  );
});

/** Meter whose colour is chosen by threshold. For load, occupancy, congestion. */
export const LoadMeter = memo(function LoadMeter({
  value,
  className,
}: {
  value: number | null;
  className?: string;
}) {
  const tone = value == null ? 'info' : value >= 90 ? 'critical' : value >= 75 ? 'high' : value >= 55 ? 'medium' : 'low';
  return <Meter value={value} tone={tone} className={className} />;
});

// --- Connection status -------------------------------------------------------

const CONNECTION: Record<ConnectionStatus, { label: string; tone: BadgeTone }> = {
  CONNECTED: { label: 'Connected', tone: 'success' },
  SYNCING: { label: 'Syncing', tone: 'info' },
  OFFLINE: { label: 'Offline', tone: 'critical' },
  RETRYING: { label: 'Retrying', tone: 'high' },
  AWAITING_FEED: { label: 'Awaiting feed', tone: 'medium' },
  UNAVAILABLE: { label: 'Unavailable', tone: 'neutral' },
};

export const ConnectionBadge = memo(function ConnectionBadge({
  status,
  detail,
  className,
}: {
  status: ConnectionStatus;
  detail?: string;
  className?: string;
}) {
  const { label, tone } = CONNECTION[status];
  return (
    <span className={cx('ark-badge', `is-${tone}`, className)} title={detail}>
      {status === 'CONNECTED' ? <Wifi size={9} aria-hidden /> : status === 'OFFLINE' ? <WifiOff size={9} aria-hidden /> : null}
      {label}
    </span>
  );
});

// --- Feed and system health --------------------------------------------------

export type SystemHealth = 'nominal' | 'degraded' | 'down' | 'unknown';

/**
 * Aggregates the feed table into one verdict.
 *
 * `down` requires *every* feed to be failing — if one source is out, the
 * platform is degraded, not down, and saying otherwise would send an operator
 * looking for a network fault that is not there.
 */
export function summariseFeeds(feeds: readonly FeedStatus[]): {
  health: SystemHealth;
  live: number;
  total: number;
  failing: FeedStatus[];
} {
  if (feeds.length === 0) return { health: 'unknown', live: 0, total: 0, failing: [] };
  const failing = feeds.filter((feed) => feed.state === 'UNAVAILABLE');
  const live = feeds.filter((feed) => feed.state === 'LIVE').length;
  const health: SystemHealth =
    failing.length === 0 ? 'nominal' : failing.length === feeds.length ? 'down' : 'degraded';
  return { health, live, total: feeds.length, failing };
}

const SYSTEM_HEALTH: Record<SystemHealth, { label: string; tone: BadgeTone; icon: ReactNode }> = {
  nominal: { label: 'All sources nominal', tone: 'success', icon: <Check size={10} aria-hidden /> },
  degraded: { label: 'Sources degraded', tone: 'high', icon: <AlertTriangle size={10} aria-hidden /> },
  down: { label: 'No sources reachable', tone: 'critical', icon: <WifiOff size={10} aria-hidden /> },
  unknown: { label: 'No sources registered', tone: 'neutral', icon: <CircleDashed size={10} aria-hidden /> },
};

/** The command-bar system-health control. Compact by design; detail lives in a panel. */
export const SystemHealthIndicator = memo(function SystemHealthIndicator({
  health,
  live,
  total,
  className,
}: {
  health: SystemHealth;
  live: number;
  total: number;
  className?: string;
}) {
  const { label, tone, icon } = SYSTEM_HEALTH[health];
  return (
    <span className={cx('ark-badge', `is-${tone}`, className)} title={label}>
      {icon}
      <span className="ark-mono">
        {live}/{total}
      </span>
    </span>
  );
});

/** One line in the data-source health list. */
export const FeedHealthRow = memo(function FeedHealthRow({
  feed,
  onRefresh,
}: {
  feed: FeedStatus;
  onRefresh?: (id: string) => void;
}) {
  const age = useAge(feed.lastSuccessAt);
  return (
    <div className="flex items-center gap-2 py-1.5 px-2 border-b border-line last:border-b-0">
      <DataStateTag state={feed.state} source={feed.source} error={feed.error} />
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-ink truncate">{feed.label}</div>
        <div className="text-[10.5px] text-ink-faint truncate">
          {feed.error ? feed.error.message : feed.source.provider}
        </div>
      </div>
      <div className="hidden sm:flex flex-col items-end shrink-0">
        <span className="ark-mono text-[10px] text-ink-subtle uppercase">{feed.transport}</span>
        <span className="ark-mono text-[10px] text-ink-faint">
          {feed.latencyMs != null ? `${feed.latencyMs} ms` : '—'}
        </span>
      </div>
      <div className="shrink-0 w-20 text-right">
        {age == null ? (
          <span className="ark-unknown">NEVER</span>
        ) : (
          <span className="ark-mono text-[10px] text-ink-subtle">{formatAge(age)}</span>
        )}
      </div>
      {onRefresh && (
        <button
          type="button"
          className="ark-icon-btn"
          aria-label={`Refresh ${feed.label}`}
          title={`Refresh ${feed.label}`}
          onClick={() => onRefresh(feed.id)}
        >
          <RefreshCw size={12} aria-hidden />
        </button>
      )}
    </div>
  );
});
