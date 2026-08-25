/**
 * Dynamic map legend.
 *
 * Lists exactly the base GIS layers that are on the map right now — nothing that
 * is merely available, and nothing that failed. Each swatch is drawn from the
 * same style record the map renders with, including the dash pattern, so a
 * boundary that reads as long-dash on the map reads as long-dash here. A legend
 * that is redrawn by hand is a legend that eventually lies about the map.
 *
 * Layers still loading are listed with a spinner rather than held back, because
 * an operator watching a slow city-wide layer needs to know it is coming.
 */

import React from 'react';
import { ChevronDown, Loader2 } from 'lucide-react';
import {
  GIS_CATEGORY_LABEL,
  type GISLayerDef,
  type GISLayerRuntime,
} from '../../services/gis/types';
import type { GISMapActions } from './gisMapActions';

interface GISLegendProps {
  layers: GISLayerDef[];
  runtime: Record<string, GISLayerRuntime>;
  actions: GISMapActions;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * One legend swatch, drawn from the layer's own style.
 *
 * Lines use an inline SVG rather than a CSS border because ARKA's boundary layers
 * are distinguished by dash pattern — `10 5` for an authority boundary, `4 3` for
 * a ward — and `border-top-style: dashed` cannot express a specific pattern.
 */
export const LegendSwatch: React.FC<{ layer: GISLayerDef }> = ({ layer }) => {
  const style = layer.style;

  // Server-rendered layers carry no ARKA styling; show a filled block so the
  // legend does not imply a colour the map is not using.
  if (!style) {
    return (
      <span
        aria-hidden="true"
        className="shrink-0 w-4 h-3 rounded-sm border border-line-strong bg-sunken-strong"
      />
    );
  }

  if (style.pointRadius != null) {
    return (
      <span
        aria-hidden="true"
        className="shrink-0 w-4 h-4 grid place-items-center"
      >
        <span
          className="block rounded-full"
          style={{
            width: 9,
            height: 9,
            backgroundColor: style.fillColor ?? style.color,
            border: `1.5px solid ${style.color}`,
          }}
        />
      </span>
    );
  }

  const weight = Math.min(4, Math.max(1.5, style.weight ?? 2));

  return (
    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" className="shrink-0">
      {style.fillColor && (style.fillOpacity ?? 0) > 0 && (
        <rect
          x="1"
          y="4"
          width="14"
          height="8"
          fill={style.fillColor}
          fillOpacity={style.fillOpacity ?? 0.15}
        />
      )}
      <line
        x1="1"
        y1="8"
        x2="15"
        y2="8"
        stroke={style.color}
        strokeWidth={weight}
        strokeDasharray={style.dashArray}
        strokeLinecap="butt"
      />
    </svg>
  );
};

export const GISLegend: React.FC<GISLegendProps> = ({
  layers,
  runtime,
  actions,
  collapsed,
  onToggleCollapsed,
}) => {
  const active = layers
    .filter((layer) => runtime[layer.id]?.visible)
    .sort((a, b) => b.order - a.order);

  if (active.length === 0) return null;

  return (
    <div className="gov-map-card w-[218px] max-w-[calc(100vw-2rem)]">
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-expanded={!collapsed}
        className="flex items-center gap-1.5 w-full px-2 py-1.5 text-left"
      >
        <span className="gov-label flex-1">Legend</span>
        <span className="gov-mono text-[10px] text-ink-subtle">{active.length}</span>
        <ChevronDown
          className={`w-3.5 h-3.5 text-ink-subtle transition-transform ${collapsed ? '-rotate-90' : ''}`}
        />
      </button>

      {!collapsed && (
        <div className="gov-scroll-thin max-h-[36vh] overflow-y-auto border-t border-line px-2 py-1.5 space-y-0.5">
          {active.map((layer) => {
            const state = runtime[layer.id];
            return (
              <button
                key={layer.id}
                type="button"
                onClick={() => void actions.zoomToLayer(layer.id)}
                title={`${GIS_CATEGORY_LABEL[layer.category]} — zoom to extent`}
                className="flex items-center gap-2 w-full py-0.5 text-left group"
              >
                <LegendSwatch layer={layer} />
                <span className="min-w-0 flex-1 text-[11px] text-ink-muted group-hover:text-ink truncate">
                  {layer.label}
                </span>
                {state?.sourceState === 'loading' && (
                  <Loader2 className="w-3 h-3 shrink-0 animate-spin text-accent" />
                )}
                {state?.sourceState === 'no-data' && (
                  <span className="gov-mono text-[9px] shrink-0 text-ink-subtle">0</span>
                )}
                {state?.truncated && (
                  <span
                    className="gov-mono text-[9px] shrink-0 text-caution"
                    title="Showing a capped subset of this layer"
                  >
                    subset
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
