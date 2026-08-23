/**
 * Resolved ARKA design tokens for map rendering.
 *
 * Leaflet writes SVG presentation attributes rather than CSS classes, so vector
 * styles cannot reference `var(--color-…)`. These are the resolved values of the
 * tokens declared in `src/index.css` `@theme`, plus a small set of desaturated
 * thematic hues chosen to sit correctly on the near-black canvas. Nothing here
 * introduces a colour the interface does not already use.
 *
 * Kept in its own module so every catalogue file and the Leaflet adapter share
 * one definition.
 */
export const PALETTE = {
  /** --color-accent */
  accent: '#4c8dd9',
  /** --color-accent-border */
  accentDim: '#2e4e73',
  /** --color-line-strong */
  line: '#384250',
  /** --color-ink-muted */
  ink: '#a9b4c2',
  water: '#3f7fa8',
  vegetation: '#4a7a5c',
  power: '#b0873f',
  transit: '#6f8fb5',
  civic: '#8a7fb0',

  // Thematic hues. Deliberately low-chroma: a POI layer must read as reference
  // cartography, never compete with ARKA's critical/warning incident colours.
  health: '#c07a7a',
  education: '#7a9ec0',
  government: '#9a8fb8',
  culture: '#b09a6f',
  religious: '#a8836f',
  tourism: '#8fae94',
  recreation: '#6f9f8a',
  parking: '#8f96a8',
  commerce: '#a89a7f',
} as const;

/**
 * Line styles that distinguish boundary classes at a glance.
 *
 * The requirement is that boundary types are visually separable without reading
 * the legend, so each administrative tier gets its own dash signature rather
 * than only its own colour — colour alone fails for a colour-blind operator and
 * on a projector.
 */
export const BOUNDARY_DASH = {
  /** Municipal corporation outer limit — solid, heaviest. */
  municipal: undefined as string | undefined,
  /** Development authority limit — long dash. */
  authority: '10 5',
  /** Zone within an authority — medium dash. */
  zone: '6 4',
  /** Ward — short dash. */
  ward: '4 3',
  /** Revenue/village — fine dot. */
  revenue: '2 3',
  /** Statutory overlay (TP scheme, constituency, jurisdiction) — dash-dot. */
  statutory: '8 3 2 3',
} as const;
