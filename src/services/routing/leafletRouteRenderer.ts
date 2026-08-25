/**
 * Leaflet renderer for calculated routes.
 *
 * Draws what the routing engine returned. Nothing more: this file contains no
 * coordinate arithmetic, no interpolation, no fallback shape, and no default
 * geometry. If it is handed nothing, it draws nothing — which is the correct
 * appearance for "no valid route available".
 *
 * Colour follows the ARKA convention already used across the map, and each
 * colour now means something calculated rather than decorative:
 *
 *   cyan   — the recommended, validated route
 *   amber  — a valid alternate, ranked lower
 *   red    — a route the intelligence layer marked blocked or high risk
 *
 * Routes live in their own pane above the overlay pane, so they read clearly over
 * corridor lines and city GIS layers while every ARKA marker stays on top.
 */

import L from 'leaflet';
import type { RankedRoute } from './RouteIntelligence';

export const ROUTE_PANE = 'arka-route-pane';
const ROUTE_PANE_Z = 410;

const COLOUR = {
  PRIMARY: '#06B6D4',
  ALTERNATE: '#F59E0B',
  BLOCKED: '#EF4444',
} as const;

export interface RouteRenderEntry {
  /** Stable key for this route slot, e.g. `police-dispatch`. */
  key: string;
  /** Operator-facing name for the movement, e.g. `PCR dispatch`. */
  label: string;
  ranked: RankedRoute;
  /** Draw alternates for this entry as well as the recommendation. */
  showAlternate?: boolean;
  onClick?: () => void;
}

function fmt(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export class LeafletRouteRenderer {
  private readonly map: L.Map;
  private readonly group: L.LayerGroup;

  constructor(map: L.Map) {
    this.map = map;

    if (!map.getPane(ROUTE_PANE)) {
      const pane = map.createPane(ROUTE_PANE);
      pane.style.zIndex = String(ROUTE_PANE_Z);
    }

    this.group = L.layerGroup([], { pane: ROUTE_PANE }).addTo(map);
  }

  /** Re-assert the pane after a basemap swap re-orders the DOM. */
  refreshPane(): void {
    const pane = this.map.getPane(ROUTE_PANE);
    if (pane) pane.style.zIndex = String(ROUTE_PANE_Z);
  }

  clear(): void {
    this.group.clearLayers();
  }

  dispose(): void {
    this.group.clearLayers();
    this.map.removeLayer(this.group);
  }

  /** Replace everything currently drawn with `entries`. */
  render(entries: readonly RouteRenderEntry[]): void {
    this.group.clearLayers();

    for (const entry of entries) {
      this.drawRoute(entry, entry.ranked);
    }
  }

  private drawRoute(entry: RouteRenderEntry, ranked: RankedRoute): void {
    const coordinates = ranked.candidate.coordinates;
    if (coordinates.length < 2) return;

    const colour = COLOUR[ranked.display];
    const isPrimary = ranked.display === 'PRIMARY';

    // Dark casing first, so a cyan route stays legible over pale GIS imagery.
    L.polyline(coordinates, {
      pane: ROUTE_PANE,
      color: '#04070b',
      weight: isPrimary ? 9 : 7,
      opacity: 0.55,
      lineCap: 'round',
      lineJoin: 'round',
      interactive: false,
    }).addTo(this.group);

    const line = L.polyline(coordinates, {
      pane: ROUTE_PANE,
      color: colour,
      weight: isPrimary ? 5 : 3.5,
      opacity: isPrimary ? 0.95 : 0.8,
      dashArray: ranked.display === 'BLOCKED' ? '10, 7' : isPrimary ? undefined : '7, 6',
      lineCap: 'round',
      lineJoin: 'round',
    }).addTo(this.group);

    line.bindTooltip(this.tooltip(entry, ranked), { sticky: true, opacity: 0.97 });
    if (entry.onClick) line.on('click', entry.onClick);

    // Snap markers: show where the raw coordinate was pulled onto the network,
    // and how far it moved. Silently starting a route 60 m from a vehicle is the
    // kind of quiet inaccuracy that erodes trust in the whole map.
    this.drawSnapMarker(coordinates[0], colour, 'Start', ranked.candidate.start.distanceM, ranked.candidate.start.street);
    this.drawSnapMarker(
      coordinates[coordinates.length - 1],
      colour,
      'Destination',
      ranked.candidate.end.distanceM,
      ranked.candidate.end.street,
    );
  }

  private drawSnapMarker(
    point: [number, number],
    colour: string,
    role: string,
    snapDistanceM: number,
    street: string | null,
  ): void {
    const marker = L.circleMarker(point, {
      pane: ROUTE_PANE,
      radius: 4,
      color: colour,
      weight: 2,
      fillColor: '#04070b',
      fillOpacity: 1,
    }).addTo(this.group);

    marker.bindTooltip(
      `<div class="font-mono text-[10px] bg-[#0A0A0A] text-white px-2 py-1 border border-white/20 rounded">
        <div class="font-bold" style="color:${colour}">${escapeHtml(role.toUpperCase())} — SNAPPED TO ROAD</div>
        <div class="text-white/70">${escapeHtml(street ?? 'Unnamed road segment')}</div>
        <div class="text-white/50">${Math.round(snapDistanceM)} m from the requested coordinate</div>
      </div>`,
      { sticky: true },
    );
  }

  private tooltip(entry: RouteRenderEntry, ranked: RankedRoute): string {
    const c = ranked.candidate;
    const colour = COLOUR[ranked.display];

    const streets = c.steps
      .filter((s) => s.street)
      .slice(0, 4)
      .map((s) => escapeHtml(s.street as string))
      .join(' → ');

    const factorRows = ranked.factors
      .slice(0, 3)
      .map(
        (f) =>
          `<div class="text-white/60">· ${escapeHtml(f.label)} <span class="text-white/35">[${escapeHtml(f.sourceState)}]</span></div>`,
      )
      .join('');

    return `
      <div class="font-mono text-[10px] bg-[#0A0A0A] text-white p-2 border rounded shadow-2xl" style="border-color:${colour}66">
        <div class="font-bold uppercase" style="color:${colour}">${escapeHtml(entry.label)} — ${escapeHtml(ranked.display)}</div>
        <div class="text-white/50 text-[9px] uppercase">${escapeHtml(c.objectiveLabel)} · ${c.legs.length} road segments</div>
        <div class="mt-1 flex justify-between space-x-3">
          <span>DISTANCE: <strong style="color:${colour}">${fmt(c.lengthM)}</strong></span>
          <span class="text-white/40">DIRECT: ${fmt(c.straightLineM)} (${c.detourRatio.toFixed(2)}×)</span>
        </div>
        <div class="text-white/40">ETA: UNAVAILABLE — no speed attribute published</div>
        ${streets ? `<div class="mt-1 text-white/70">${streets}</div>` : ''}
        ${factorRows ? `<div class="mt-1">${factorRows}</div>` : ''}
        <div class="mt-1 text-[9px] text-emerald-400">ROUTE STATUS: ${escapeHtml(c.validation.status)} · ${c.validation.checks.filter((k) => k.passed).length}/${c.validation.checks.length} checks passed</div>
      </div>
    `;
  }
}
