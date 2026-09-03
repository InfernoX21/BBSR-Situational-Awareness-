/**
 * Chart shell.
 *
 * The brief's performance rule for charts, enforced structurally: `recharts` lives
 * behind `React.lazy`, and the lazy component is not even referenced until the
 * container has entered the viewport. A dashboard with six charts below the fold
 * loads none of them; scrolling to one loads the library once and every chart
 * after that is free.
 *
 * The shell also owns the honest states. A chart with no data draws an empty
 * frame with an explanation, and a chart whose source failed draws the
 * unavailable treatment — never an axis pair with nothing between them, which
 * reads as "measured zero".
 */

import { Suspense, lazy, type ReactNode } from 'react';
import { cx } from './cx';
import { useHasBeenVisible } from './hooks';
import { EmptyState, UnavailableState } from './surfaces';
import { Skeleton } from './primitives';
import type { ChartProps } from './chartTypes';

export type { ChartKind, ChartProps, ChartSeries, ChartReferenceLine } from './chartTypes';

const ChartImpl = lazy(() => import('./charts/ChartImpl'));

export interface ChartFrameProps extends ChartProps {
  height?: number;
  /** Set when the series could not be fetched. Takes precedence over emptiness. */
  unavailable?: { source: string; reason?: string; onRetry?: () => void } | null;
  /** Explanation for a legitimately empty series, e.g. "No rainfall this window". */
  emptyTitle?: string;
  emptyDetail?: string;
  className?: string;
  /** Accessible summary. A chart is an image to a screen reader without one. */
  label: string;
  /** Rendered under the plot: legend notes, units, provenance. */
  footer?: ReactNode;
}

export function Chart({
  height = 160,
  unavailable = null,
  emptyTitle = 'No data in this window',
  emptyDetail,
  className,
  label,
  footer,
  ...chart
}: ChartFrameProps) {
  const { ref, visible } = useHasBeenVisible<HTMLDivElement>('120px');

  let body: ReactNode;
  if (unavailable) {
    body = (
      <UnavailableState
        compact
        source={unavailable.source}
        reason={unavailable.reason}
        onRetry={unavailable.onRetry}
      />
    );
  } else if (chart.data.length === 0) {
    body = <EmptyState compact title={emptyTitle} detail={emptyDetail} />;
  } else if (!visible) {
    // Reserve the exact final height so arrival does not reflow the page.
    body = <Skeleton className="w-full h-full" />;
  } else {
    body = (
      <Suspense fallback={<Skeleton className="w-full h-full" />}>
        <ChartImpl {...chart} />
      </Suspense>
    );
  }

  return (
    <figure className={cx('min-w-0', className)} aria-label={label}>
      <div ref={ref} style={{ height }} className="w-full min-w-0">
        {body}
      </div>
      {footer && <figcaption className="mt-1.5 text-[10.5px] text-ink-faint">{footer}</figcaption>}
    </figure>
  );
}

// --- Sparkline ---------------------------------------------------------------

/**
 * Inline trend, drawn as a plain SVG polyline.
 *
 * Deliberately not Recharts: a sparkline in a table cell must cost nothing, and a
 * table of two hundred rows must not mount two hundred chart contexts. Nulls
 * break the line rather than interpolating across them, so a gap in telemetry
 * looks like a gap.
 */
export function Sparkline({
  values,
  width = 64,
  height = 18,
  color = 'var(--color-accent)',
  label,
  className,
}: {
  values: ReadonlyArray<number | null>;
  width?: number;
  height?: number;
  color?: string;
  /** Accessible description, e.g. "Load over the last hour". */
  label: string;
  className?: string;
}) {
  const present = values.filter((value): value is number => value != null);
  if (present.length < 2) {
    return <span className={cx('ark-unknown', className)}>NO SERIES</span>;
  }

  const min = Math.min(...present);
  const max = Math.max(...present);
  const span = max - min || 1;
  const stepX = values.length > 1 ? width / (values.length - 1) : width;

  // Build one polyline per contiguous run so telemetry gaps are visible as gaps.
  const runs: string[] = [];
  let current: string[] = [];
  values.forEach((value, index) => {
    if (value == null) {
      if (current.length > 1) runs.push(current.join(' '));
      current = [];
      return;
    }
    const x = index * stepX;
    const y = height - ((value - min) / span) * (height - 2) - 1;
    current.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  if (current.length > 1) runs.push(current.join(' '));

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={label}
      className={cx('shrink-0', className)}
    >
      {runs.map((points) => (
        <polyline
          key={points.slice(0, 24)}
          points={points}
          fill="none"
          stroke={color}
          strokeWidth={1.2}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      ))}
    </svg>
  );
}

// --- Distribution bar --------------------------------------------------------

/**
 * A single stacked bar showing composition.
 *
 * Used where a pie would otherwise appear. A 6px bar is readable at a glance,
 * survives being one of twelve panels on a wall display, and needs no legend
 * geometry — which a pie of five slices at this scale does not.
 */
export function DistributionBar({
  segments,
  label,
  showLegend = true,
  className,
}: {
  segments: ReadonlyArray<{ label: string; value: number; color: string }>;
  label: string;
  showLegend?: boolean;
  className?: string;
}) {
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  if (total <= 0) {
    return <span className={cx('ark-unknown', className)}>NO RECORDS</span>;
  }
  return (
    <div className={cx('min-w-0', className)}>
      <div
        className="flex h-1.5 w-full overflow-hidden rounded-full bg-sunken-strong"
        role="img"
        aria-label={`${label}: ${segments.map((s) => `${s.label} ${s.value}`).join(', ')}`}
      >
        {segments.map((segment) =>
          segment.value <= 0 ? null : (
            <span
              key={segment.label}
              style={{ width: `${(segment.value / total) * 100}%`, backgroundColor: segment.color }}
              title={`${segment.label}: ${segment.value}`}
            />
          ),
        )}
      </div>
      {showLegend && (
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
          {segments.map((segment) => (
            <span key={segment.label} className="inline-flex items-center gap-1 text-[10.5px] text-ink-subtle">
              <span
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ backgroundColor: segment.color }}
                aria-hidden
              />
              {segment.label}
              <span className="ark-mono text-ink">{segment.value}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
