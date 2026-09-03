/**
 * ARKA surfaces and page scaffolding.
 *
 * The information hierarchy of every module is expressed through these four
 * levels and nothing else:
 *
 *   Page   → title, subtitle, provenance, page-level actions
 *   Panel  → one subject, with its own header and data-state
 *   Inset  → a nested grouping inside a panel
 *   Row    → one record
 *
 * Also here: the three states every data surface must be able to render. A panel
 * that can only draw a populated list is a panel that will one day draw a
 * plausible-looking empty one, which is the failure the data-state contract in
 * `src/shared/dataState.ts` exists to prevent.
 */

import type { ReactNode } from 'react';
import { AlertTriangle, Inbox, RefreshCw, ShieldOff } from 'lucide-react';
import { cx } from './cx';
import { Button, Spinner } from './primitives';

// --- Page --------------------------------------------------------------------

export interface PageProps {
  children: ReactNode;
  className?: string;
  /** Set false for a page that manages its own scrolling (the map). */
  scroll?: boolean;
}

/** Root of a module page. Owns the page's scroll container and padding. */
export function Page({ children, className, scroll = true }: PageProps) {
  return (
    <div
      className={cx(
        'flex-1 min-h-0 min-w-0 bg-canvas text-ink flex flex-col',
        scroll ? 'overflow-y-auto ark-scroll' : 'overflow-hidden',
        className,
      )}
    >
      {children}
    </div>
  );
}

export interface PageHeaderProps {
  title: string;
  /** One line explaining what this module is for. Not marketing copy. */
  subtitle?: string;
  /** Data-state tags, feed health, last-updated — the provenance strip. */
  meta?: ReactNode;
  /** Right-aligned page actions. */
  actions?: ReactNode;
  /** Filter bar or tab strip, rendered below the title block. */
  toolbar?: ReactNode;
  /** Sticks to the top of the page's scroll container. */
  sticky?: boolean;
}

export function PageHeader({ title, subtitle, meta, actions, toolbar, sticky = true }: PageHeaderProps) {
  return (
    <header
      className={cx(
        'shrink-0 bg-canvas border-b border-line',
        sticky && 'sticky top-0 z-20',
      )}
    >
      <div className="flex items-start justify-between gap-4 px-4 pt-3 pb-2.5">
        <div className="min-w-0">
          <h1 className="ark-page-title truncate">{title}</h1>
          {subtitle && <p className="mt-0.5 text-[12px] text-ink-subtle max-w-2xl">{subtitle}</p>}
          {meta && <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">{meta}</div>}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      {toolbar && <div className="px-4 pb-2 flex flex-wrap items-center gap-2">{toolbar}</div>}
    </header>
  );
}

/** Body of a module page. Standard gutter and vertical rhythm. */
export function PageBody({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('flex-1 min-h-0 p-4 space-y-3', className)}>{children}</div>;
}

/** A labelled band inside a long page, for grouping panels under a heading. */
export function PageSection({
  title,
  hint,
  actions,
  children,
  className,
}: {
  title: string;
  hint?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('space-y-2', className)}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-2 min-w-0">
          <h2 className="ark-label">{title}</h2>
          {hint && <span className="text-[11px] text-ink-faint truncate">{hint}</span>}
        </div>
        {actions && <div className="flex items-center gap-1.5 shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}

// --- Panel -------------------------------------------------------------------

export interface PanelProps {
  children: ReactNode;
  className?: string;
  /** Removes the border, for a panel nested inside another surface. */
  flush?: boolean;
  /** Constrains height and scrolls the body. */
  scroll?: boolean;
}

export function Panel({ children, className, flush = false, scroll = false }: PanelProps) {
  return (
    <section
      className={cx(
        flush ? 'bg-surface' : 'ark-panel',
        'flex flex-col min-h-0',
        scroll && 'overflow-hidden',
        className,
      )}
    >
      {children}
    </section>
  );
}

export interface PanelHeadProps {
  title: string;
  /** Short qualifier after the title, e.g. a count or a scope. */
  count?: number | string | null;
  icon?: ReactNode;
  /** Data-state tag, age, source note. */
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PanelHead({ title, count, icon, meta, actions, className }: PanelHeadProps) {
  return (
    <div className={cx('ark-head shrink-0', className)}>
      <div className="flex items-center gap-2 min-w-0">
        {icon && <span className="text-ink-subtle shrink-0">{icon}</span>}
        <h3 className="ark-title truncate">{title}</h3>
        {count != null && count !== '' && (
          <span className="ark-mono text-[11px] text-ink-faint shrink-0">{count}</span>
        )}
        {meta && <div className="flex items-center gap-1.5 shrink-0">{meta}</div>}
      </div>
      {actions && <div className="flex items-center gap-1 shrink-0">{actions}</div>}
    </div>
  );
}

/** Scrolling body of a panel. */
export function PanelBody({
  children,
  className,
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div className={cx('flex-1 min-h-0 overflow-y-auto ark-scroll', pad && 'p-3', className)}>{children}</div>
  );
}

/** Footer of a panel, for a summary line or a single action. */
export function PanelFoot({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx('shrink-0 border-t border-line px-3 py-2 flex items-center gap-2', className)}>
      {children}
    </div>
  );
}

/** Nested grouping inside a panel. */
export function Inset({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cx('ark-inset p-2.5', className)}>{children}</div>;
}

// --- Rows and key/value pairs ------------------------------------------------

export interface RowProps {
  children: ReactNode;
  /** Adds a severity rail on the leading edge. */
  rail?: 'critical' | 'high' | 'medium' | 'low' | 'info' | 'neutral' | null;
  selected?: boolean;
  onClick?: () => void;
  className?: string;
}

export function Row({ children, rail, selected = false, onClick, className }: RowProps) {
  const cls = cx(
    'ark-row',
    rail && `ark-rail ark-rail-${rail}`,
    selected && 'is-selected',
    onClick && 'text-left w-full cursor-pointer',
    className,
  );
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-current={selected || undefined} className={cls}>
        {children}
      </button>
    );
  }
  return <div className={cls}>{children}</div>;
}

/**
 * A label/value pair.
 *
 * `value` accepts null to mean "the platform does not have this", which renders
 * as an explicit unknown rather than a zero or an em-dash.
 */
export function Field({
  label,
  value,
  hint,
  mono = false,
  className,
}: {
  label: string;
  value: ReactNode | null | undefined;
  hint?: string;
  mono?: boolean;
  className?: string;
}) {
  const empty = value == null || value === '';
  return (
    <div className={cx('min-w-0', className)}>
      <div className="ark-label" title={hint}>
        {label}
      </div>
      {empty ? (
        <div className="ark-unknown mt-0.5" title="No value reported by any connected source.">
          NOT REPORTED
        </div>
      ) : (
        <div className={cx('mt-0.5 text-[12.5px] text-ink truncate', mono && 'ark-mono')}>{value}</div>
      )}
    </div>
  );
}

/** Horizontal label/value line, for dense detail lists. */
export function FieldLine({
  label,
  value,
  hint,
  mono = true,
  className,
}: {
  label: string;
  value: ReactNode | null | undefined;
  /** Tooltip on the label: what this measures, or why it is unreported. */
  hint?: string;
  mono?: boolean;
  className?: string;
}) {
  const empty = value == null || value === '';
  return (
    <div className={cx('flex items-baseline justify-between gap-3 py-0.5', className)}>
      <span className="text-[11.5px] text-ink-subtle shrink-0" title={hint}>
        {label}
      </span>
      {empty ? (
        <span className="ark-unknown">NOT REPORTED</span>
      ) : (
        <span className={cx('text-[12px] text-ink text-right truncate', mono && 'ark-mono')}>{value}</span>
      )}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <hr className={cx('border-0 border-t border-line my-2', className)} />;
}

// --- The three states every data surface must render -------------------------

export interface EmptyStateProps {
  /** What is absent. A sentence, not a shrug. */
  title: string;
  /** Why it is absent, and what would make it appear. */
  detail?: string;
  icon?: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}

/**
 * Nothing to show, and that is a legitimate reading.
 *
 * Zero incidents means a quiet city. Distinct from `UnavailableState`, which
 * means ARKA could not find out.
 */
export function EmptyState({ title, detail, icon, action, compact = false }: EmptyStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center text-center gap-1.5',
        compact ? 'py-6 px-3' : 'py-12 px-6',
      )}
    >
      <span className="text-ink-faint" aria-hidden>
        {icon ?? <Inbox size={compact ? 18 : 24} strokeWidth={1.5} />}
      </span>
      <p className="text-[12.5px] font-semibold text-ink-muted">{title}</p>
      {detail && <p className="text-[11.5px] text-ink-faint max-w-sm leading-relaxed">{detail}</p>}
      {action && <div className="mt-1.5">{action}</div>}
    </div>
  );
}

export interface UnavailableStateProps {
  /** Which source could not be reached. */
  source: string;
  /** The reason, verbatim from the feed where possible. */
  reason?: string;
  /** Retry handler, when a manual refresh is meaningful. */
  onRetry?: () => void;
  /** Set when the integration was never configured, as opposed to having failed. */
  notConfigured?: boolean;
  compact?: boolean;
}

/**
 * ARKA could not establish the value.
 *
 * Deliberately visually distinct from `EmptyState`: an operator must be able to
 * tell "there are no flooded wards" from "the drainage telemetry is down" from
 * across a room.
 */
export function UnavailableState({
  source,
  reason,
  onRetry,
  notConfigured = false,
  compact = false,
}: UnavailableStateProps) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center text-center gap-1.5 border border-dashed border-line-strong rounded-[3px]',
        compact ? 'py-5 px-3' : 'py-10 px-6',
      )}
    >
      <span className="text-critical" aria-hidden>
        {notConfigured ? (
          <ShieldOff size={compact ? 18 : 22} strokeWidth={1.5} />
        ) : (
          <AlertTriangle size={compact ? 18 : 22} strokeWidth={1.5} />
        )}
      </span>
      <p className="text-[12.5px] font-semibold text-ink">
        {notConfigured ? 'Integration not configured' : 'Data unavailable'}
      </p>
      <p className="ark-mono text-[10.5px] text-ink-subtle uppercase tracking-wider">{source}</p>
      {reason && <p className="text-[11.5px] text-ink-faint max-w-sm leading-relaxed">{reason}</p>}
      {onRetry && (
        <Button size="xs" variant="outline" icon={<RefreshCw size={11} />} onClick={onRetry} className="mt-1.5">
          Retry
        </Button>
      )}
    </div>
  );
}

/** In flight. Used for a first fetch or a lazily-loaded chunk. */
export function LoadingState({ label = 'Loading', compact = false }: { label?: string; compact?: boolean }) {
  return (
    <div
      className={cx(
        'flex flex-col items-center justify-center gap-2 text-ink-subtle',
        compact ? 'py-5' : 'py-12',
      )}
      role="status"
      aria-live="polite"
    >
      <Spinner size={compact ? 14 : 18} />
      <span className="ark-label">{label}</span>
    </div>
  );
}
