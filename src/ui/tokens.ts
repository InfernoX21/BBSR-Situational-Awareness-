/**
 * TypeScript mirror of the design tokens in `index.css`.
 *
 * Two consumers cannot read a CSS custom property: Leaflet, which builds marker
 * markup as an HTML string outside React, and Recharts, which needs concrete
 * colour values as props. Both would otherwise hardcode hexes at the call site,
 * which is how the previous interface ended up with nine different reds.
 *
 * These values must stay in step with `@theme`. They are grouped by role rather
 * than by hue so that a call site asks for "the colour of a critical incident"
 * and not "the orange one".
 */

/** Surfaces and structure. */
export const SURFACE = {
  canvas: '#08090a',
  panel: '#0e0f11',
  raised: '#15171a',
  high: '#1b1e22',
  sunken: '#0a0b0c',
  sunkenStrong: '#16181b',
  mapVoid: '#060708',
  line: '#1c1e22',
  lineStrong: '#292c31',
  lineBright: '#3a3e45',
} as const;

/** Text. */
export const INK = {
  base: '#f1f3f5',
  muted: '#a4aab4',
  subtle: '#7b828d',
  faint: '#565c66',
  inverse: '#08090a',
} as const;

/** Interaction accent. Never used to encode status. */
export const ACCENT = {
  base: '#e2662c',
  hover: '#f07a40',
  press: '#c25320',
  soft: '#1e1109',
  softStrong: '#2b1710',
  border: '#4d2613',
  ink: '#120802',
} as const;

/** Operational status ramp. */
export const STATUS = {
  critical: '#f0554d',
  criticalFill: '#d93a30',
  criticalDeep: '#a82a22',
  high: '#e9a13b',
  highFill: '#d0861f',
  medium: '#d9cc4f',
  mediumFill: '#bdb032',
  low: '#43b888',
  lowFill: '#2f9b70',
  info: '#6ba3db',
  infoFill: '#3f7fbd',
  neutral: '#7b828d',
  offline: '#565c66',
} as const;

/** Severity → marker / rail / chart colour. */
export const SEVERITY_COLOR = {
  CRITICAL: STATUS.criticalFill,
  HIGH: STATUS.highFill,
  MEDIUM: STATUS.mediumFill,
  LOW: STATUS.lowFill,
} as const;

/** Entity health → marker / dot colour. */
export const HEALTH_COLOR = {
  nominal: STATUS.lowFill,
  attention: STATUS.highFill,
  critical: STATUS.criticalFill,
  offline: STATUS.offline,
  resolved: STATUS.infoFill,
} as const;

/**
 * Congestion ramp for corridors and camera analytics.
 *
 * Deliberately the same four steps as severity: an operator should not have to
 * learn a second colour language for roads.
 */
export const CONGESTION_COLOR = {
  CLEAR: STATUS.lowFill,
  SLOW: STATUS.mediumFill,
  JAMMED: STATUS.highFill,
  SEVERE: STATUS.criticalFill,
} as const;

/**
 * Categorical series colours for charts, in application order.
 *
 * Six steps, chosen to stay distinguishable under the two most common forms of
 * colour-vision deficiency by varying lightness as well as hue. Charts that need
 * more than six series are the wrong chart.
 */
export const SERIES = [
  '#e2662c', // accent
  '#6ba3db', // steel
  '#43b888', // green
  '#d9cc4f', // yellow
  '#a884d8', // violet
  '#8b939e', // grey
] as const;

/** Axis, grid and tooltip styling shared by every chart. */
export const CHART_THEME = {
  grid: SURFACE.line,
  axis: INK.faint,
  /** Passed straight to Recharts' `tick` prop. */
  axisTick: { fill: INK.subtle, fontSize: 10 },
  legendInk: INK.subtle,
  /** Individual colours rather than a style object, so the tooltip can compose. */
  tooltip: {
    background: SURFACE.raised,
    border: SURFACE.lineStrong,
    ink: INK.base,
    inkMuted: INK.subtle,
  },
} as const;

/**
 * Event tone → colour, for the event stream, ticker and timeline.
 *
 * `low` is the informational step, not a mild-problem step, and `resolved` is the
 * good-news step — which is why one is steel and the other green rather than both
 * sitting on the severity ramp.
 */
export const EVENT_TONE_HEX = {
  critical: STATUS.criticalFill,
  high: STATUS.highFill,
  medium: STATUS.mediumFill,
  low: STATUS.infoFill,
  resolved: STATUS.lowFill,
} as const;

/** Map marker geometry, so the map and the legend agree on sizes. */
export const MARKER = {
  /** Point asset diameter, in px. */
  dot: 12,
  /** Larger point asset (hospital, substation) diameter. */
  dotLarge: 15,
  /** Incident diamond edge length. */
  diamond: 13,
  /** Selection ring diameter. */
  ring: 26,
  /** Corridor polyline weight. */
  corridorWeight: 4,
  /** Route polyline weight. */
  routeWeight: 5,
} as const;
