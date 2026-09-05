/**
 * Chart contract.
 *
 * Separated from both the wrapper and the implementation so importing the *types*
 * does not pull `recharts` into a chunk. A page can describe its chart at module
 * scope and still not pay for the library until the chart scrolls into view.
 */

export type ChartKind = 'line' | 'area' | 'bar';

export interface ChartSeries {
  /** Field on each datum. */
  key: string;
  /** Legend and tooltip label. */
  label: string;
  kind?: ChartKind;
  /** Overrides the palette slot. Use for series with a fixed meaning, e.g. severity. */
  color?: string;
  /** Dashed stroke. The platform convention for forecast or modelled series. */
  dashed?: boolean;
}

export interface ChartReferenceLine {
  y: number;
  /** What the threshold is: "Design capacity", "Alert level". */
  label: string;
  color?: string;
}

export interface ChartProps {
  data: readonly Record<string, unknown>[];
  /** Field holding the category or timestamp. */
  xKey: string;
  series: readonly ChartSeries[];
  stacked?: boolean;
  showGrid?: boolean;
  showLegend?: boolean;
  yDomain?: [number | 'auto' | 'dataMin' | 'dataMax', number | 'auto' | 'dataMin' | 'dataMax'];
  yTickFormat?: (value: number) => string;
  xTickFormat?: (value: string | number) => string;
  tooltipValueFormat?: (value: number) => string;
  referenceLines?: readonly ChartReferenceLine[];
  /** Y axis gutter. Widen for six-figure readings. */
  yWidth?: number;
}
