/**
 * Metrics.
 *
 * A metric is the smallest honest statement ARKA can make: one number, one
 * label, one provenance. The API forces `value: number | string | null` because
 * the null case is the common one — the previous interface papered over missing
 * telemetry with `?? 98` and `|| 14.2`, and every one of those reads to an
 * operator as a measurement.
 *
 * Deltas are separated from tone on purpose. "Up" is good for water pressure and
 * bad for reservoir turbidity, so direction and judgement are different props.
 */

import { memo, type ReactNode } from 'react';
import { ArrowDownRight, ArrowRight, ArrowUpRight } from 'lucide-react';
import { cx } from './cx';

export type MetricTone = 'default' | 'accent' | 'critical' | 'high' | 'medium' | 'success' | 'info';
export type TrendDirection = 'up' | 'down' | 'flat';
/** Whether the movement is good news, bad news, or neither. */
export type TrendSense = 'good' | 'bad' | 'neutral';

const TONE_TEXT: Record<MetricTone, string> = {
  default: 'text-ink',
  accent: 'text-accent',
  critical: 'text-critical',
  high: 'text-warning',
  medium: 'text-caution',
  success: 'text-success',
  info: 'text-info',
};

const SENSE_TEXT: Record<TrendSense, string> = {
  good: 'text-success',
  bad: 'text-critical',
  neutral: 'text-ink-subtle',
};

export interface MetricProps {
  label: string;
  /** Null when no connected source reported it. Renders as an explicit unknown. */
  value: number | string | null | undefined;
  /** Unit suffix, rendered smaller and dimmer. */
  unit?: string;
  tone?: MetricTone;
  /** Change since the comparison window, pre-formatted, e.g. "+3" or "12%". */
  delta?: string | null;
  trend?: TrendDirection;
  /** How to read the trend. Defaults to neutral, which is the honest default. */
  sense?: TrendSense;
  /** What the comparison is against, e.g. "vs 1 h ago". Required with `delta`. */
  deltaLabel?: string;
  /** Data-state tag or age, rendered under the value. */
  meta?: ReactNode;
  /** Tooltip: what exactly this counts, and how. */
  hint?: string;
  icon?: ReactNode;
  size?: 'sm' | 'md';
  onClick?: () => void;
  className?: string;
}

export const Metric = memo(function Metric({
  label,
  value,
  unit,
  tone = 'default',
  delta,
  trend,
  sense = 'neutral',
  deltaLabel,
  meta,
  hint,
  icon,
  size = 'md',
  onClick,
  className,
}: MetricProps) {
  const missing = value == null || value === '';
  const TrendIcon = trend === 'up' ? ArrowUpRight : trend === 'down' ? ArrowDownRight : ArrowRight;

  const body = (
    <>
      <div className="flex items-center gap-1.5 min-w-0">
        {icon && (
          <span className="text-ink-faint shrink-0" aria-hidden>
            {icon}
          </span>
        )}
        <span className="ark-label truncate">{label}</span>
      </div>

      {missing ? (
        <div className="ark-unknown mt-1" title="No connected source reported this value.">
          NOT REPORTED
        </div>
      ) : (
        <div className="mt-1 flex items-baseline gap-1 min-w-0">
          <span className={cx(size === 'sm' ? 'ark-metric-sm' : 'ark-metric', TONE_TEXT[tone])}>{value}</span>
          {unit && <span className="text-[11px] text-ink-subtle shrink-0">{unit}</span>}
        </div>
      )}

      {(delta || meta) && (
        <div className="mt-1 flex items-center gap-2 flex-wrap min-w-0">
          {delta && !missing && (
            <span className={cx('inline-flex items-center gap-0.5 text-[11px]', SENSE_TEXT[sense])}>
              {trend && <TrendIcon size={11} aria-hidden />}
              <span className="ark-mono">{delta}</span>
              {deltaLabel && <span className="text-ink-faint ml-0.5">{deltaLabel}</span>}
            </span>
          )}
          {meta}
        </div>
      )}
    </>
  );

  const shell = cx('ark-inset p-2.5 min-w-0 flex flex-col justify-start', className);

  if (onClick) {
    return (
      <button type="button" onClick={onClick} title={hint} className={cx(shell, 'text-left ark-inset-interactive')}>
        {body}
      </button>
    );
  }
  return (
    <div className={shell} title={hint}>
      {body}
    </div>
  );
});

/**
 * Responsive metric row.
 *
 * `columns` is the count at the widest breakpoint; narrower viewports step down
 * to two and then one. Fixed template strings rather than computed Tailwind
 * classes, because Tailwind cannot see a class it did not read in source.
 */
export function MetricGrid({
  columns = 4,
  children,
  className,
}: {
  columns?: 2 | 3 | 4 | 5 | 6;
  children: ReactNode;
  className?: string;
}) {
  const cols: Record<number, string> = {
    2: 'grid-cols-1 sm:grid-cols-2',
    3: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-2 lg:grid-cols-4',
    5: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-5',
    6: 'grid-cols-2 md:grid-cols-3 xl:grid-cols-6',
  };
  return <div className={cx('grid gap-2', cols[columns], className)}>{children}</div>;
}

/**
 * A count with a label, for a header strip: `12 ACTIVE`.
 *
 * Distinct from `Metric` because it carries no provenance of its own — it counts
 * records already on screen, so its trustworthiness is the panel's.
 */
export const Tally = memo(function Tally({
  count,
  label,
  tone = 'default',
  className,
}: {
  count: number;
  label: string;
  tone?: MetricTone;
  className?: string;
}) {
  return (
    <span className={cx('inline-flex items-baseline gap-1', className)}>
      <span className={cx('ark-mono text-[13px] font-semibold', TONE_TEXT[tone])}>{count}</span>
      <span className="ark-label">{label}</span>
    </span>
  );
});
