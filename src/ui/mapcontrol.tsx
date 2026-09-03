/**
 * Map chrome.
 *
 * The map is the primary operational interface in ARKA v2, which means its
 * controls are first-class components rather than markup improvised inside the
 * map view. Everything that floats over the canvas is here: control stacks, the
 * layer panel, the legend and the coordinate readout.
 *
 * Two things this file is careful about.
 *
 * **Layers are independently toggleable, and heavy ones are opt-in.** The layer
 * control states the weight of a layer *before* it is switched on, and shows its
 * load lifecycle after — so an operator who enables 3D buildings on a laptop knows
 * why the canvas paused, and an operator whose satellite key is missing sees that
 * rather than an empty basemap.
 *
 * **The readout reports the pointer, not a decoration.** The previous map printed
 * a fixed coordinate, altitude and drainage figure in its corner that never
 * changed as the cursor moved. A readout with no pointer over the canvas says so.
 */

import { memo, type ReactNode } from 'react';
import { ChevronDown, ChevronUp, Layers } from 'lucide-react';
import { cx } from './cx';
import { Spinner, Toggle } from './primitives';
import { StatusBadge } from './status';
import { useStoredState } from './hooks';

// --- Control stacks ----------------------------------------------------------

export type MapCorner = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

const CORNER_CLASS: Record<MapCorner, string> = {
  'top-left': 'top-2 left-2',
  'top-right': 'top-2 right-2',
  'bottom-left': 'bottom-2 left-2',
  'bottom-right': 'bottom-2 right-2',
};

/**
 * Absolutely-positioned cluster over the map canvas.
 *
 * `pointer-events-none` on the wrapper with `auto` on the children, so the gaps
 * between two control groups still pan the map — dead zones around the chrome are
 * one of the things that makes a web map feel unlike a GIS tool.
 */
export function MapOverlay({
  corner,
  children,
  className,
}: {
  corner: MapCorner;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        'absolute z-[400] flex flex-col gap-1.5 pointer-events-none [&>*]:pointer-events-auto',
        CORNER_CLASS[corner],
        corner.endsWith('right') && 'items-end',
        className,
      )}
    >
      {children}
    </div>
  );
}

/** A joined run of map buttons. Vertical by default, `row` for a toolbar. */
export function MapButtonGroup({
  children,
  row = false,
  className,
}: {
  children: ReactNode;
  row?: boolean;
  className?: string;
}) {
  return <div className={cx('ark-map-group', row && 'is-row', className)}>{children}</div>;
}

export interface MapButtonProps {
  /** Accessible name. Required — every map control is icon-first. */
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  /** Tooltip. Defaults to `label`; use it to explain a disabled control. */
  hint?: string;
  /** Optional visible text after the icon, for a wide toolbar button. */
  children?: ReactNode;
  className?: string;
}

export const MapButton = memo(function MapButton({
  label,
  icon,
  onClick,
  active = false,
  disabled = false,
  hint,
  children,
  className,
}: MapButtonProps) {
  return (
    <button
      type="button"
      className={cx('ark-map-btn', active && 'is-active', className)}
      aria-label={label}
      aria-pressed={active || undefined}
      title={hint ?? label}
      disabled={disabled}
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
});

// --- Floating panel ----------------------------------------------------------

export interface MapPanelProps {
  title: string;
  icon?: ReactNode;
  /** Right-aligned header controls, e.g. "Clear all". */
  actions?: ReactNode;
  children: ReactNode;
  /** Panel width in px. Layer lists want ~240; an inspector wants more. */
  width?: number;
  /** Caps the body height and scrolls it, so a long layer list cannot eat the map. */
  maxBodyHeight?: number;
  collapsible?: boolean;
  defaultCollapsed?: boolean;
  /** Persists the collapsed state across sessions. Defaults to the title. */
  storageKey?: string;
  /** Footer note: a source caveat, a count, a projection. */
  footer?: ReactNode;
  className?: string;
}

/** The one panel treatment for anything docked over the map canvas. */
export function MapPanel({
  title,
  icon,
  actions,
  children,
  width = 240,
  maxBodyHeight = 320,
  collapsible = true,
  defaultCollapsed = false,
  storageKey,
  footer,
  className,
}: MapPanelProps) {
  const [collapsed, setCollapsed] = useStoredState<boolean>(
    `map.panel.${storageKey ?? title}`,
    defaultCollapsed,
  );
  const open = collapsible ? !collapsed : true;

  return (
    <section className={cx('ark-map-panel overflow-hidden', className)} style={{ width }}>
      <header className="flex items-center gap-2 h-8 px-2 border-b border-line">
        <span className="text-ink-subtle shrink-0" aria-hidden>
          {icon ?? <Layers size={12} />}
        </span>
        <h3 className="ark-label flex-1 truncate">{title}</h3>
        {actions && (
          <div className="flex items-center gap-1 shrink-0" onClick={(event) => event.stopPropagation()}>
            {actions}
          </div>
        )}
        {collapsible && (
          <button
            type="button"
            className="ark-icon-btn shrink-0"
            aria-expanded={open}
            aria-label={open ? `Collapse ${title}` : `Expand ${title}`}
            onClick={() => setCollapsed(open)}
          >
            {open ? <ChevronUp size={12} aria-hidden /> : <ChevronDown size={12} aria-hidden />}
          </button>
        )}
      </header>
      {open && (
        <div className="overflow-y-auto ark-scroll" style={{ maxHeight: maxBodyHeight }}>
          {children}
        </div>
      )}
      {open && footer && (
        <footer className="border-t border-line px-2 py-1.5 text-[10.5px] text-ink-faint">{footer}</footer>
      )}
    </section>
  );
}

// --- Layer control -----------------------------------------------------------

/** Cost of switching a layer on. Drives whether it loads eagerly. */
export type LayerWeight = 'light' | 'heavy';

/** Lifecycle of a lazily-loaded layer. */
export type LayerLoadState = 'idle' | 'loading' | 'ready' | 'failed';

export interface LayerControlItem {
  id: string;
  label: string;
  /** Feature count. Null while the layer has never loaded, so 0 stays meaningful. */
  count?: number | null;
  enabled: boolean;
  /** 'heavy' layers (3D buildings, satellite imagery, dense markers) load on demand. */
  weight?: LayerWeight;
  load?: LayerLoadState;
  /** What the layer shows and where it comes from. */
  hint?: string;
  disabled?: boolean;
  /** Why it cannot be enabled. Shown instead of a silently dead switch. */
  disabledReason?: string;
  /** Legend key, so the panel doubles as the legend. */
  swatch?: { color: string; shape?: 'dot' | 'diamond' | 'line' };
}

function Swatch({ color, shape = 'dot' }: { color: string; shape?: 'dot' | 'diamond' | 'line' }) {
  if (shape === 'line') {
    return <span className="map-legend-line shrink-0" style={{ borderTopColor: color }} aria-hidden />;
  }
  return (
    <span
      className="map-legend-swatch shrink-0"
      style={{
        backgroundColor: color,
        transform: shape === 'diamond' ? 'rotate(45deg)' : undefined,
        borderRadius: shape === 'diamond' ? 1 : undefined,
      }}
      aria-hidden
    />
  );
}

const LOAD_NOTE: Record<LayerLoadState, string> = {
  idle: 'Not loaded yet. Enabling this layer fetches it.',
  loading: 'Fetching layer data.',
  ready: 'Loaded.',
  failed: 'The layer source could not be reached.',
};

/**
 * One layer row.
 *
 * The count is deliberately null-aware: a layer that has never loaded shows no
 * number rather than a zero, because "0 drones" and "we have not asked about
 * drones" are different operational facts.
 */
export const LayerToggle = memo(function LayerToggle({
  item,
  onToggle,
}: {
  item: LayerControlItem;
  onToggle: (id: string, next: boolean) => void;
}) {
  const load = item.load ?? 'ready';
  const heavy = item.weight === 'heavy';

  return (
    <div
      className={cx(
        'flex items-center gap-2 px-2 py-1.5 border-b border-line last:border-b-0',
        item.disabled && 'opacity-50',
      )}
      title={item.disabled ? (item.disabledReason ?? 'Unavailable') : item.hint}
    >
      {item.swatch && <Swatch color={item.swatch.color} shape={item.swatch.shape} />}
      <div className="min-w-0 flex-1">
        <div className="text-[12px] text-ink truncate">{item.label}</div>
        {(heavy || load === 'failed' || item.disabled) && (
          <div className="mt-0.5 flex items-center gap-1">
            {item.disabled ? (
              <span className="text-[10px] text-ink-faint truncate">{item.disabledReason ?? 'Unavailable'}</span>
            ) : load === 'failed' ? (
              <StatusBadge label="LOAD FAILED" tone="critical" hint={LOAD_NOTE.failed} />
            ) : (
              <span className="ark-tag" title="Loaded only when enabled, to keep the canvas responsive.">
                ON DEMAND
              </span>
            )}
          </div>
        )}
      </div>
      {load === 'loading' ? (
        <Spinner size={11} className="text-accent shrink-0" />
      ) : item.count != null ? (
        <span className="ark-mono text-[10.5px] text-ink-subtle shrink-0 tabular-nums">{item.count}</span>
      ) : (
        <span className="ark-mono text-[10.5px] text-ink-faint shrink-0" title={LOAD_NOTE[load]}>
          —
        </span>
      )}
      <Toggle
        checked={item.enabled}
        onChange={(next) => onToggle(item.id, next)}
        label={item.label}
        disabled={item.disabled}
        hint={item.hint}
      />
    </div>
  );
});

/** A titled run of layer rows — 'Operations', 'Infrastructure', 'Environment'. */
export function LayerGroup({
  title,
  items,
  onToggle,
  className,
}: {
  title: string;
  items: readonly LayerControlItem[];
  onToggle: (id: string, next: boolean) => void;
  className?: string;
}) {
  if (items.length === 0) return null;
  return (
    <div className={className}>
      <div className="px-2 py-1 bg-sunken border-b border-line">
        <span className="ark-label">{title}</span>
      </div>
      {items.map((item) => (
        <LayerToggle key={item.id} item={item} onToggle={onToggle} />
      ))}
    </div>
  );
}

// --- Legend ------------------------------------------------------------------

export interface LegendEntry {
  label: string;
  color: string;
  shape?: 'dot' | 'diamond' | 'line';
  /** What the symbol means. Not the label repeated. */
  hint?: string;
}

/**
 * Symbol key for the active layers.
 *
 * Separate from the layer panel because a legend answers "what is this shape on
 * the canvas" while the layer panel answers "what am I showing" — an operator
 * reading an unfamiliar marker should not have to open a control to find out.
 */
export const MapLegend = memo(function MapLegend({
  entries,
  columns = 1,
  className,
}: {
  entries: readonly LegendEntry[];
  columns?: 1 | 2;
  className?: string;
}) {
  if (entries.length === 0) return null;
  return (
    <div className={cx('grid gap-x-3 gap-y-1 px-2 py-1.5', columns === 2 ? 'grid-cols-2' : 'grid-cols-1', className)}>
      {entries.map((entry) => (
        <span
          key={entry.label}
          className="flex items-center gap-1.5 text-[11px] text-ink-muted min-w-0"
          title={entry.hint}
        >
          <Swatch color={entry.color} shape={entry.shape} />
          <span className="truncate">{entry.label}</span>
        </span>
      ))}
    </div>
  );
});

// --- Readout -----------------------------------------------------------------

export interface MapReadoutProps {
  /** Pointer position over the canvas. Null when the cursor has left the map. */
  cursor: { lat: number; lng: number } | null;
  zoom: number | null;
  /** Metres-per-pixel scale note, when the engine reports one. */
  scale?: string | null;
  /** Coordinate reference system, e.g. 'WGS 84'. */
  crs?: string;
  /** Extra fields: selected asset, active basemap, feature count. */
  children?: ReactNode;
  className?: string;
}

/**
 * The strip along the map's lower edge.
 *
 * Every field can be absent and says so. This replaces a corner block of fixed
 * numbers that looked like telemetry and tracked nothing.
 */
export const MapReadout = memo(function MapReadout({
  cursor,
  zoom,
  scale,
  crs = 'WGS 84',
  children,
  className,
}: MapReadoutProps) {
  return (
    <div className={cx('ark-map-readout overflow-x-auto', className)} role="status" aria-live="off">
      <span className="text-ink-faint">{crs}</span>
      {cursor ? (
        <span title="Pointer position">
          {cursor.lat.toFixed(5)}, {cursor.lng.toFixed(5)}
        </span>
      ) : (
        <span className="text-ink-faint" title="The pointer is not over the map canvas.">
          NO POINTER
        </span>
      )}
      <span title="Zoom level">Z {zoom != null ? zoom.toFixed(1) : '—'}</span>
      {scale && <span title="Approximate scale">{scale}</span>}
      {children}
    </div>
  );
});
