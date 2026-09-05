/**
 * Recharts implementation, loaded on demand.
 *
 * This module is the only place in ARKA that imports `recharts`. It is reached
 * exclusively through `React.lazy` in `src/ui/chart.tsx`, so the charting library
 * — the single largest dependency in the bundle after the map — is not in the
 * initial payload and is never fetched on a page that has no chart on screen.
 *
 * Nothing here decides what to plot. Colours come from the token mirror, and the
 * caller supplies the series; a chart cannot invent a series the data does not
 * contain.
 */

import { memo } from 'react';
import {
  Area,
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { CHART_THEME, SERIES } from '../tokens';
import type { ChartProps, ChartSeries } from '../chartTypes';

interface TooltipEntry {
  dataKey?: string | number;
  name?: string;
  value?: number | string;
  color?: string;
}

/** The one tooltip treatment. Flat panel, hairline border, tabular figures. */
function ArkaTooltip({
  active,
  label,
  payload,
  labelFormat,
  valueFormat,
}: {
  active?: boolean;
  label?: string | number;
  payload?: TooltipEntry[];
  labelFormat?: (value: string | number) => string;
  valueFormat?: (value: number) => string;
}) {
  if (!active || !payload || payload.length === 0) return null;
  return (
    <div
      style={{
        backgroundColor: CHART_THEME.tooltip.background,
        border: `1px solid ${CHART_THEME.tooltip.border}`,
        borderRadius: 3,
        padding: '5px 7px',
        fontSize: 11,
        lineHeight: 1.45,
        color: CHART_THEME.tooltip.ink,
        boxShadow: '0 4px 14px rgba(0, 0, 0, 0.45)',
      }}
    >
      {label != null && (
        <div style={{ fontWeight: 600, marginBottom: 2 }}>
          {labelFormat ? labelFormat(label) : String(label)}
        </div>
      )}
      {payload.map((entry) => (
        <div
          key={String(entry.dataKey ?? entry.name)}
          style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'space-between' }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <span
              style={{
                width: 7,
                height: 2,
                backgroundColor: entry.color,
                display: 'inline-block',
              }}
            />
            <span style={{ color: CHART_THEME.tooltip.inkMuted }}>{entry.name}</span>
          </span>
          <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums' }}>
            {entry.value == null
              ? 'n/r'
              : typeof entry.value === 'number' && valueFormat
                ? valueFormat(entry.value)
                : String(entry.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function colourFor(series: ChartSeries, index: number): string {
  return series.color ?? SERIES[index % SERIES.length];
}

const AXIS_PROPS = {
  stroke: CHART_THEME.axis,
  tick: CHART_THEME.axisTick,
  tickLine: false,
} as const;

/**
 * Composed cartesian chart.
 *
 * One component covers line, area and bar because ARKA routinely needs them
 * mixed — measured load as bars with a forecast band as an area behind it — and
 * three separate wrappers would diverge within a week.
 */
const ChartImpl = memo(function ChartImpl({
  data,
  xKey,
  series,
  stacked = false,
  showGrid = true,
  showLegend = false,
  yDomain,
  yTickFormat,
  xTickFormat,
  tooltipValueFormat,
  referenceLines,
  yWidth = 34,
}: ChartProps) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <ComposedChart data={data as object[]} margin={{ top: 4, right: 6, bottom: 0, left: 0 }}>
        {showGrid && <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="2 3" vertical={false} />}
        <XAxis
          dataKey={xKey}
          {...AXIS_PROPS}
          axisLine={{ stroke: CHART_THEME.axis }}
          tickFormatter={xTickFormat}
          minTickGap={18}
        />
        <YAxis
          {...AXIS_PROPS}
          axisLine={false}
          width={yWidth}
          domain={yDomain}
          tickFormatter={yTickFormat}
        />
        <Tooltip
          cursor={{ stroke: CHART_THEME.axis, strokeWidth: 1 }}
          content={
            <ArkaTooltip labelFormat={xTickFormat} valueFormat={tooltipValueFormat} />
          }
        />
        {showLegend && (
          <Legend
            iconSize={7}
            iconType="plainline"
            wrapperStyle={{ fontSize: 10.5, color: CHART_THEME.legendInk, paddingTop: 4 }}
          />
        )}

        {referenceLines?.map((line) => (
          <ReferenceLine
            key={`${line.label}-${line.y}`}
            y={line.y}
            stroke={line.color ?? CHART_THEME.axis}
            strokeDasharray="3 3"
            label={{
              value: line.label,
              position: 'insideTopRight',
              fill: CHART_THEME.legendInk,
              fontSize: 9.5,
            }}
          />
        ))}

        {series.map((entry, index) => {
          const colour = colourFor(entry, index);
          const stackId = stacked ? 'stack' : undefined;
          if (entry.kind === 'bar') {
            return (
              <Bar
                key={entry.key}
                dataKey={entry.key}
                name={entry.label}
                fill={colour}
                stackId={stackId}
                radius={[1, 1, 0, 0]}
                maxBarSize={22}
                isAnimationActive={false}
              />
            );
          }
          if (entry.kind === 'line') {
            return (
              <Line
                key={entry.key}
                type="monotone"
                dataKey={entry.key}
                name={entry.label}
                stroke={colour}
                strokeWidth={1.6}
                strokeDasharray={entry.dashed ? '4 3' : undefined}
                dot={false}
                activeDot={{ r: 2.5, fill: colour, stroke: 'none' }}
                connectNulls={false}
                isAnimationActive={false}
              />
            );
          }
          return (
            <Area
              key={entry.key}
              type="monotone"
              dataKey={entry.key}
              name={entry.label}
              stroke={colour}
              strokeWidth={1.4}
              strokeDasharray={entry.dashed ? '4 3' : undefined}
              fill={colour}
              fillOpacity={0.14}
              stackId={stackId}
              dot={false}
              activeDot={{ r: 2.5, fill: colour, stroke: 'none' }}
              connectNulls={false}
              isAnimationActive={false}
            />
          );
        })}
      </ComposedChart>
    </ResponsiveContainer>
  );
});

export default ChartImpl;
