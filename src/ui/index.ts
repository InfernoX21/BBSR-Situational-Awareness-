/**
 * The ARKA design system.
 *
 * One import for the whole vocabulary: `import { Panel, DataTable, Metric } from '@/ui'`.
 * A page that needs a control which is not here should add a variant to the
 * relevant module rather than writing a local one — the brief's rule, and the
 * reason the previous interface ended up with eleven button treatments.
 *
 * Two things are deliberately *not* re-exported:
 *
 * - `./charts/ChartImpl` — the only module that imports `recharts`. It is reached
 *   solely through `React.lazy` in `./chart`, and naming it here would pull the
 *   charting library back into the initial bundle.
 * - `./chartTypes` — already re-exported by `./chart`, which is where callers
 *   should reach for it.
 */

// Foundations
export { cx } from './cx';
export * from './tokens';
export * from './hooks';

// Structure and state
export * from './surfaces';

// Controls
export * from './primitives';
export * from './filters';
export * from './tabs';

// Vocabulary
export * from './status';
export * from './metrics';

// Data display
export * from './table';
export * from './virtual';
export * from './chart';
export * from './timeline';

// Records
export * from './cards';

// Chrome and overlays
export * from './overlays';
export * from './palette';
export * from './toast';
export * from './mapcontrol';
