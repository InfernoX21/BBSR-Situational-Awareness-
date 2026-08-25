/**
 * Leaflet adapter for ARKA's base GIS tier.
 *
 * This is the only file that knows both Leaflet and the GIS provider. It owns
 * three things:
 *
 *  - `ArcGISDynamicTileLayer`, an `L.TileLayer` subclass that turns each tile's
 *    Web Mercator bounds into a server-rendered `export` request. Tiled caches
 *    on the source deployment are single-fused and cannot isolate a sublayer, so
 *    dynamic export is what keeps every category independently controllable.
 *  - a GeoJSON layer factory that styles features with ARKA's own palette and
 *    binds popups built from verified field names.
 *  - `BaseGISMapController`, which reconciles the provider's runtime state onto
 *    a live map: add, remove, reorder, set opacity, report load and error.
 *
 * Everything is drawn into two dedicated panes that sit *below* Leaflet's
 * `overlayPane`, so ARKA's existing incident, traffic, drone and sensor overlays
 * keep drawing on top without any change to how they are rendered.
 */

import L from 'leaflet';
import type {
  CityGISProvider,
  GISBounds,
  GISLayerDef,
  GISVectorStyle,
} from './types';
import { formatValue as sharedFormatValue } from './formatAttributes';
import { GISLayerRegistry } from './GISLayerRegistry';

/**
 * Pane z-indexes. Leaflet puts `tilePane` at 200 and `overlayPane` at 400;
 * base GIS occupies the gap so it can never cover an ARKA overlay.
 *
 * Within that gap the order is raster cartography, then vector features, then
 * the selection highlight — so a highlighted ward outline is never buried under
 * the layer that produced it, while ARKA's incidents and units still draw above
 * everything.
 */
const PANE_RASTER = 'arka-gis-raster';
const PANE_VECTOR = 'arka-gis-vector';
const PANE_SELECT = 'arka-gis-select';
const PANE_RASTER_Z = 250;
const PANE_VECTOR_Z = 350;
const PANE_SELECT_Z = 380;

/** Half the Web Mercator circumference, in metres. */
const WEB_MERCATOR_EXTENT = 20037508.342789244;

/** Cap the GeoJSON fetched per layer. The provider's own limit is 1,000. */
const MAX_FEATURES_PER_LAYER = 1000;

/** Extra room around the viewport, so a small pan does not trigger a refetch. */
const VIEWPORT_PAD = 0.25;

/**
 * Point count at which a layer switches to clustered rendering.
 *
 * Below this, individual markers stay readable and clustering only gets in the
 * way. Above it — 354 schools or 355 anganwadi centres at city zoom — the
 * markers merge into an unreadable mass, and a cluster bubble carrying the real
 * count is both faster to draw and more informative.
 */
const CLUSTER_MIN_POINTS = 120;

/** Grid cell used for clustering, in screen pixels at the current zoom. */
const CLUSTER_CELL_PX = 58;

// ---------------------------------------------------------------------------
// Raster: dynamic export as tiles
// ---------------------------------------------------------------------------

interface DynamicTileOptions extends L.TileLayerOptions {
  buildUrl: (bbox: [number, number, number, number], widthPx: number, heightPx: number) => string;
  onTileError?: (message: string) => void;
  onTileLoad?: () => void;
}

/**
 * Requests one server-rendered image per tile.
 *
 * `L.TileLayer` normally substitutes `{z}/{x}/{y}` into a template; here the
 * tile coordinate is converted to a Web Mercator bounding box and handed to the
 * provider's `export` builder instead. Leaflet's tile pyramid, caching, pruning
 * and retina handling all still apply.
 */
const ArcGISDynamicTileLayer = L.TileLayer.extend({
  initialize(this: L.TileLayer, options: DynamicTileOptions) {
    L.setOptions(this, options);
    // The URL is computed per tile, so the template is unused. Leaflet requires
    // the field to exist.
    (this as unknown as { _url: string })._url = '';
  },

  getTileUrl(this: L.TileLayer, coords: L.Coords): string {
    const options = this.options as DynamicTileOptions;
    const size = this.getTileSize();
    // World span at this zoom, in Web Mercator metres per tile.
    const span = (2 * WEB_MERCATOR_EXTENT) / Math.pow(2, coords.z);

    const west = -WEB_MERCATOR_EXTENT + coords.x * span;
    const east = west + span;
    // Tile rows count south from the top of the world.
    const north = WEB_MERCATOR_EXTENT - coords.y * span;
    const south = north - span;

    const scale = (options.detectRetina && L.Browser.retina ? 2 : 1);
    return options.buildUrl([west, south, east, north], size.x * scale, size.y * scale);
  },

  createTile(this: L.TileLayer, coords: L.Coords, done: L.DoneCallback): HTMLElement {
    const options = this.options as DynamicTileOptions;
    const tile = document.createElement('img');

    // Nothing on this endpoint needs credentials; sending none keeps the
    // request anonymous and cacheable.
    tile.crossOrigin = 'anonymous';
    tile.alt = '';
    // A GIS overlay is decoration for the basemap beneath it; announcing every
    // tile would flood a screen reader.
    tile.setAttribute('role', 'presentation');

    L.DomEvent.on(tile, 'load', () => {
      options.onTileLoad?.();
      done(undefined, tile);
    });

    L.DomEvent.on(tile, 'error', () => {
      options.onTileError?.('One or more map tiles failed to render on the city GIS server.');
      done(new Error('GIS tile failed to load'), tile);
    });

    tile.src = this.getTileUrl(coords);
    return tile;
  },
});

function createDynamicTileLayer(options: DynamicTileOptions): L.TileLayer {
  // `L.Class.extend` is untyped, so this is the one cast the adapter needs.
  const factory = ArcGISDynamicTileLayer as unknown as new (o: DynamicTileOptions) => L.TileLayer;
  return new factory(options);
}

// ---------------------------------------------------------------------------
// Vector: styling and popups
// ---------------------------------------------------------------------------

/** Translate a catalogue style into Leaflet path options. */
function toPathStyle(style: GISVectorStyle | undefined, opacity: number): L.PathOptions {
  const base = style ?? { color: '#4c8dd9' };
  return {
    color: base.color,
    weight: base.weight ?? 1,
    opacity,
    fillColor: base.fillColor ?? base.color,
    fillOpacity: (base.fillOpacity ?? 0) * opacity,
    dashArray: base.dashArray,
  };
}

/**
 * Visit every drawable path in a layer tree.
 *
 * A vector layer may be a plain `L.GeoJSON`, or — once clustering kicks in — a
 * group mixing circle markers, cluster icons and a nested GeoJSON layer for the
 * non-point features. Restyling and reordering have to reach the paths inside
 * either shape, so the walk is recursive rather than a single `eachLayer`.
 */
function eachPath(layer: L.Layer, visit: (path: L.Path) => void): void {
  if (layer instanceof L.Path) {
    visit(layer);
    return;
  }
  if (layer instanceof L.LayerGroup) {
    layer.eachLayer((child) => eachPath(child, visit));
  }
}

/**
 * Style for the selection highlight.
 *
 * Deliberately brighter and heavier than any catalogue style, and drawn in its
 * own pane, so a selected feature reads as selected regardless of which layer it
 * came from. The fill stays light: the point is to outline the feature, not to
 * hide the cartography underneath it.
 */
const HIGHLIGHT_STYLE: L.PathOptions = {
  color: '#6ba3e4',
  weight: 3,
  opacity: 1,
  fillColor: '#4c8dd9',
  fillOpacity: 0.14,
  dashArray: undefined,
};

/** Highlight radius for point features, large enough to ring a 4px marker. */
const HIGHLIGHT_POINT_RADIUS = 11;

/** One cluster of nearby point features, plus the members it stands for. */
interface PointCluster {
  lat: number;
  lng: number;
  members: GeoJSON.Feature[];
}

/**
 * Group point features into screen-space cells at the current zoom.
 *
 * Clustering is done in projected pixels rather than degrees so cells stay
 * square and consistent on screen. Projecting at an explicit zoom (rather than
 * using `latLngToLayerPoint`) keeps the result independent of where the map is
 * currently panned, so the same features always cluster the same way.
 */
function clusterPoints(map: L.Map, features: GeoJSON.Feature[], zoom: number): PointCluster[] {
  const cells = new Map<string, { sumLat: number; sumLng: number; members: GeoJSON.Feature[] }>();

  for (const feature of features) {
    const geometry = feature.geometry;
    if (!geometry || geometry.type !== 'Point') continue;
    const [lng, lat] = geometry.coordinates as [number, number];
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;

    const projected = map.project(L.latLng(lat, lng), zoom);
    const key = `${Math.floor(projected.x / CLUSTER_CELL_PX)}:${Math.floor(projected.y / CLUSTER_CELL_PX)}`;

    const cell = cells.get(key);
    if (cell) {
      cell.sumLat += lat;
      cell.sumLng += lng;
      cell.members.push(feature);
    } else {
      cells.set(key, { sumLat: lat, sumLng: lng, members: [feature] });
    }
  }

  const clusters: PointCluster[] = [];
  for (const cell of cells.values()) {
    clusters.push({
      lat: cell.sumLat / cell.members.length,
      lng: cell.sumLng / cell.members.length,
      members: cell.members,
    });
  }
  return clusters;
}

/**
 * Icon for a cluster bubble.
 *
 * The number is the exact count of features ARKA holds in that cell — not an
 * estimate and not a density score. Size scales in three coarse steps so a
 * dense cell is visibly larger without the label becoming unreadable.
 */
function clusterIcon(count: number, colour: string): L.DivIcon {
  const size = count >= 100 ? 40 : count >= 25 ? 34 : 28;
  const label = count > 999 ? '999+' : String(count);

  return L.divIcon({
    className: 'arka-gis-cluster',
    html:
      `<span class="arka-gis-cluster-dot" style="width:${size}px;height:${size}px;` +
      `border-color:${colour};background:color-mix(in srgb, ${colour} 26%, transparent)">${label}</span>`,
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

/** Format a popup value using the field's declared unit. */
const formatValue = sharedFormatValue;

/** Minimal HTML escape — feature attributes are third-party text. */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Build a popup for one feature.
 *
 * Styling uses ARKA's design tokens so a GIS popup is visually identical to the
 * rest of the interface. The provider is named in the footer: an operator must
 * always be able to see that this is third-party reference data, not an ARKA
 * observation.
 */
function buildPopupHtml(layer: GISLayerDef, properties: Record<string, unknown>, providerName: string): string {
  const rows: string[] = [];

  for (const field of layer.popupFields ?? []) {
    const formatted = formatValue(properties[field.field], field);
    if (formatted === null) continue;
    rows.push(
      `<div class="flex gap-2 py-[3px] border-b border-line last:border-0">` +
        `<dt class="shrink-0 w-[104px] text-[11px] uppercase tracking-wide text-ink-subtle">${escapeHtml(field.label)}</dt>` +
        `<dd class="min-w-0 flex-1 text-[12px] text-ink whitespace-pre-line break-words">${escapeHtml(formatted)}</dd>` +
        `</div>`,
    );
  }

  const body = rows.length
    ? `<dl class="mt-1.5">${rows.join('')}</dl>`
    : `<p class="mt-1.5 text-[12px] text-ink-muted">This feature carries no published attributes.</p>`;

  const caveat = layer.caveat
    ? `<p class="mt-2 pt-2 border-t border-line text-[11px] text-caution">${escapeHtml(layer.caveat)}</p>`
    : '';

  return (
    `<div class="min-w-[240px] max-w-[320px]">` +
      `<div class="flex items-center justify-between gap-2">` +
        `<span class="text-[11px] uppercase tracking-wide text-ink-subtle">${escapeHtml(layer.label)}</span>` +
        `<span class="gov-tag">Reference</span>` +
      `</div>` +
      body +
      caveat +
      `<p class="mt-2 text-[10px] text-ink-subtle">Source: ${escapeHtml(providerName)}</p>` +
    `</div>`
  );
}

// ---------------------------------------------------------------------------
// Controller
// ---------------------------------------------------------------------------

interface ManagedLayer {
  /** What is on the map. */
  leafletLayer: L.Layer;
  /** Signature of the request that produced it, so refetch can be skipped. */
  signature: string;
  /** In-flight request, aborted when the layer is hidden or refetched. */
  abort: AbortController | null;
}

/** Geometry handed to `showHighlight`, with an optional label for a tooltip. */
export interface GISHighlightTarget {
  geometry: GeoJSON.Geometry;
  label?: string;
}

/** Called when an operator clicks a rendered GIS feature. */
export type GISFeatureClickHandler = (
  layer: GISLayerDef,
  properties: Record<string, unknown>,
  geometry: GeoJSON.Geometry | null,
) => void;

/**
 * Reject an extent that cannot be a WGS84 box.
 *
 * Provider metadata is third-party input. A service that reports its extent in
 * Web Mercator instead of degrees would otherwise throw the map somewhere in the
 * Atlantic; refusing to fit is the safer failure.
 */
function isPlausibleExtent(extent: [number, number, number, number]): boolean {
  const [west, south, east, north] = extent;
  return (
    [west, south, east, north].every((v) => Number.isFinite(v)) &&
    Math.abs(west) <= 180 &&
    Math.abs(east) <= 180 &&
    Math.abs(south) <= 85 &&
    Math.abs(north) <= 85 &&
    east > west &&
    north > south
  );
}

/**
 * Reconciles base GIS layers onto a Leaflet map.
 *
 * The controller is intentionally imperative and idempotent: `sync()` can be
 * called on every state change, and it adds, removes and updates only what
 * differs. That keeps it cheap to call from a React effect without the effect
 * needing to know anything about Leaflet.
 */
export class BaseGISMapController {
  private readonly map: L.Map;
  private readonly registry: GISLayerRegistry;
  private readonly provider: CityGISProvider;
  private readonly managed = new Map<string, ManagedLayer>();
  private disposed = false;
  private onFeatureClick?: GISFeatureClickHandler;

  /** Current selection outline. Replaced wholesale, never patched. */
  private highlight: L.GeoJSON | null = null;

  /**
   * Serialises reconciliation.
   *
   * A layer toggle notifies the registry, which triggers a `sync()` from React,
   * while the click handler that caused it may also call `sync()` directly. Left
   * concurrent, both would see an empty slot and both would fetch. Chaining means
   * the second call observes the first one's signature and skips the request.
   */
  private syncChain: Promise<void> = Promise.resolve();

  constructor(
    map: L.Map,
    registry: GISLayerRegistry,
    options: { onFeatureClick?: GISFeatureClickHandler } = {},
  ) {
    this.map = map;
    this.registry = registry;
    this.provider = registry.getProvider();
    this.onFeatureClick = options.onFeatureClick;
    this.ensurePanes();
  }

  /**
   * Create the base GIS panes if they do not exist.
   *
   * All three sit between Leaflet's `tilePane` (200) and `overlayPane` (400),
   * which is what structurally guarantees ARKA's own overlays stay on top.
   */
  private ensurePanes(): void {
    if (!this.map.getPane(PANE_RASTER)) {
      const pane = this.map.createPane(PANE_RASTER);
      pane.style.zIndex = String(PANE_RASTER_Z);
      // Raster is backdrop cartography; clicks belong to whatever is above it.
      pane.style.pointerEvents = 'none';
    }
    if (!this.map.getPane(PANE_VECTOR)) {
      const pane = this.map.createPane(PANE_VECTOR);
      pane.style.zIndex = String(PANE_VECTOR_Z);
    }
    if (!this.map.getPane(PANE_SELECT)) {
      const pane = this.map.createPane(PANE_SELECT);
      pane.style.zIndex = String(PANE_SELECT_Z);
      // The highlight marks what is already selected; clicks must fall through
      // to the feature beneath it so the next selection still works.
      pane.style.pointerEvents = 'none';
    }
  }

  /** True when the pane exists and holds nothing — used by the map's guards. */
  hasAnyLayer(): boolean {
    return this.managed.size > 0;
  }

  /**
   * Re-assert the pane stack.
   *
   * Called after ARKA swaps its basemap. Panes themselves survive a tile-layer
   * swap, so today this is idempotent — it exists so that a future change to the
   * map's own layer handling cannot silently leave city geography drawing above
   * ARKA's operational overlays.
   */
  refreshPanes(): void {
    this.ensurePanes();
  }

  /** Reconcile the map against current registry state. */
  sync(): Promise<void> {
    this.syncChain = this.syncChain.then(() => this.syncNow()).catch(() => undefined);
    return this.syncChain;
  }

  private async syncNow(): Promise<void> {
    if (this.disposed) return;

    const wanted = new Set(this.registry.visibleLayerIds());

    // Remove what is no longer wanted, before adding, so a busy map does not
    // briefly hold both.
    for (const layerId of [...this.managed.keys()]) {
      if (!wanted.has(layerId)) this.remove(layerId);
    }

    const tasks: Promise<void>[] = [];
    for (const layerId of wanted) {
      const def = this.provider.getLayer(layerId);
      if (!def) continue;
      tasks.push(def.kind === 'vector' ? this.syncVector(def) : this.syncRaster(def));
    }

    await Promise.all(tasks);
    this.applyOrdering();
  }

  /**
   * Show a layer and move the map so its data is actually in view.
   *
   * This is the click-to-display path: activating a layer from the panel must put
   * geography on the map, not merely tick a checkbox. The fit happens *before*
   * the fetch on purpose — vector layers are queried by viewport, so fitting
   * first means the request asks for the area the operator is about to be looking
   * at rather than the one they are leaving.
   *
   * Returns false when the provider published no usable extent, in which case
   * the layer is still shown at the current view.
   */
  async activateLayer(layerId: string): Promise<boolean> {
    const def = this.provider.getLayer(layerId);
    if (!def) return false;

    const fitted = this.registry.isVisible(layerId) ? false : await this.zoomToLayer(layerId);
    this.registry.setVisible(layerId, true);
    await this.sync();
    return fitted;
  }

  /** Hide a layer and drop it from the map. */
  async deactivateLayer(layerId: string): Promise<void> {
    this.registry.setVisible(layerId, false);
    await this.sync();
  }

  /** Re-run vector queries for the new viewport. Raster tiles handle this natively. */
  refreshViewport(): Promise<void> {
    this.syncChain = this.syncChain.then(() => this.refreshViewportNow()).catch(() => undefined);
    return this.syncChain;
  }

  private async refreshViewportNow(): Promise<void> {
    if (this.disposed) return;

    const tasks: Promise<void>[] = [];
    for (const layerId of this.registry.visibleLayerIds()) {
      const def = this.provider.getLayer(layerId);
      if (def?.kind === 'vector') tasks.push(this.syncVector(def));
    }
    await Promise.all(tasks);
  }

  /** Apply an opacity change without refetching. */
  setOpacity(layerId: string, opacity: number): void {
    const managed = this.managed.get(layerId);
    const def = this.provider.getLayer(layerId);
    if (!managed || !def) return;

    if (def.kind === 'vector') {
      const style = toPathStyle(def.style, opacity);
      // `CircleMarker.setStyle` preserves its own radius when the patch omits
      // one, so the marker size stays as the catalogue set it.
      eachPath(managed.leafletLayer, (path) => path.setStyle(style));
    } else {
      (managed.leafletLayer as L.TileLayer).setOpacity(opacity);
    }
  }

  /** Fit the map to a layer's published extent, if it has a usable one. */
  async zoomToLayer(layerId: string): Promise<boolean> {
    const description = await this.provider.describeLayer(layerId).catch(() => null);
    const extent = description?.extent;
    if (!extent || !isPlausibleExtent(extent)) return false;

    const [west, south, east, north] = extent;
    this.map.fitBounds(
      L.latLngBounds(L.latLng(south, west), L.latLng(north, east)),
      { padding: [24, 24] },
    );
    return true;
  }

  /**
   * Fit the map to whatever a layer currently has drawn.
   *
   * Preferred over `zoomToLayer` once features are on screen: the published
   * extent covers the whole service, while this covers the features ARKA
   * actually holds. Falls back to the published extent when nothing is drawn or
   * the drawn bounds are degenerate.
   */
  async zoomToLayerData(layerId: string): Promise<boolean> {
    const managed = this.managed.get(layerId);
    if (managed?.leafletLayer instanceof L.FeatureGroup) {
      const bounds = managed.leafletLayer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [32, 32], maxZoom: 17 });
        return true;
      }
    }
    return this.zoomToLayer(layerId);
  }

  /**
   * Fit the map to the combined extent of several layers.
   *
   * Used when a whole theme group is switched on: the operator asked to see
   * "Health", so the view should frame every health layer rather than whichever
   * one happened to resolve last. Drawn bounds are preferred; published extents
   * fill in for raster layers, which have no client-side geometry.
   */
  async zoomToLayers(layerIds: string[]): Promise<boolean> {
    let union: L.LatLngBounds | null = null;

    const extend = (bounds: L.LatLngBounds) => {
      if (!bounds.isValid()) return;
      union = union ? union.extend(bounds) : L.latLngBounds(bounds.getSouthWest(), bounds.getNorthEast());
    };

    for (const layerId of layerIds) {
      const managed = this.managed.get(layerId);
      if (managed?.leafletLayer instanceof L.FeatureGroup) {
        extend(managed.leafletLayer.getBounds());
        continue;
      }

      const description = await this.provider.describeLayer(layerId).catch(() => null);
      const extent = description?.extent;
      if (extent && isPlausibleExtent(extent)) {
        const [west, south, east, north] = extent;
        extend(L.latLngBounds(L.latLng(south, west), L.latLng(north, east)));
      }
    }

    if (!union) return false;
    this.map.fitBounds(union, { padding: [32, 32], maxZoom: 17 });
    return true;
  }

  // --- Selection highlight ----------------------------------------------

  /**
   * Outline one or more features as the current selection.
   *
   * Drawn from the geometry ARKA already holds, into its own click-through pane,
   * rather than by mutating the source layer's style. That keeps the highlight
   * independent of whether the layer that produced it is still visible, makes
   * clearing it a single removal, and works identically for a ward polygon, a
   * clicked feature and a set of spatial-query results.
   */
  showHighlight(targets: GISHighlightTarget[], options: { fit?: boolean; maxZoom?: number } = {}): void {
    this.clearHighlight();
    this.ensurePanes();

    const usable = targets.filter((t) => t.geometry);
    if (!usable.length) return;

    const collection: GeoJSON.FeatureCollection = {
      type: 'FeatureCollection',
      features: usable.map((target) => ({
        type: 'Feature' as const,
        geometry: target.geometry,
        properties: target.label ? { label: target.label } : {},
      })),
    };

    const layer = L.geoJSON(collection, {
      pane: PANE_SELECT,
      interactive: false,
      style: () => HIGHLIGHT_STYLE,
      pointToLayer: (_feature, latlng) =>
        L.circleMarker(latlng, {
          ...HIGHLIGHT_STYLE,
          fillOpacity: 0,
          radius: HIGHLIGHT_POINT_RADIUS,
          pane: PANE_SELECT,
          interactive: false,
        }),
      onEachFeature: (feature, child) => {
        const label = (feature.properties as { label?: string } | null)?.label;
        if (label) {
          child.bindTooltip(label, {
            className: 'arka-gis-highlight-tip',
            direction: 'top',
            offset: [0, -8],
          });
        }
      },
    });

    layer.addTo(this.map);
    this.highlight = layer;

    if (options.fit) {
      const bounds = layer.getBounds();
      if (bounds.isValid()) {
        this.map.fitBounds(bounds, { padding: [40, 40], maxZoom: options.maxZoom ?? 16 });
      }
    }
  }

  /** Remove the selection outline. Safe to call when nothing is selected. */
  clearHighlight(): void {
    if (!this.highlight) return;
    this.map.removeLayer(this.highlight);
    this.highlight = null;
  }

  /** Fit the map to a WGS84 box, e.g. a ward's precomputed bounds. */
  fitBounds(bounds: GISBounds, options: { maxZoom?: number } = {}): void {
    const latLngBounds = L.latLngBounds(
      L.latLng(bounds.south, bounds.west),
      L.latLng(bounds.north, bounds.east),
    );
    if (!latLngBounds.isValid()) return;
    this.map.fitBounds(latLngBounds, { padding: [40, 40], maxZoom: options.maxZoom ?? 16 });
  }

  /** Current viewport as a WGS84 box, for a query scoped to what is on screen. */
  currentBounds(): GISBounds {
    return this.viewportBounds();
  }

  /** Remove everything and stop all in-flight work. */
  dispose(): void {
    this.disposed = true;
    this.clearHighlight();
    for (const layerId of [...this.managed.keys()]) this.remove(layerId);
  }

  // --- Internals --------------------------------------------------------

  private remove(layerId: string): void {
    const managed = this.managed.get(layerId);
    if (!managed) return;
    managed.abort?.abort();
    this.map.removeLayer(managed.leafletLayer);
    this.managed.delete(layerId);
  }

  private async syncRaster(def: GISLayerDef): Promise<void> {
    const runtime = this.registry.get(def.id);
    const opacity = runtime?.opacity ?? def.defaultOpacity;

    const existing = this.managed.get(def.id);
    if (existing) {
      (existing.leafletLayer as L.TileLayer).setOpacity(opacity);
      return;
    }

    const template = this.provider.rasterTemplate(def.id);
    if (!template?.exportUrl) {
      this.registry.markError(def.id, 'This layer has no usable raster endpoint.');
      return;
    }

    this.registry.markLoading(def.id);

    // One tile failure should not read as a dead layer; report the first error
    // and let a later success clear it.
    let reportedError = false;
    let reportedLoad = false;

    const tileLayer = createDynamicTileLayer({
      buildUrl: template.exportUrl,
      pane: PANE_RASTER,
      opacity,
      maxZoom: template.maxZoom,
      // Tiles are stitched images; a 1px overlap hides seam artefacts.
      tileSize: 256,
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 4,
      className: 'arka-gis-raster-tile',
      onTileLoad: () => {
        if (reportedLoad) return;
        reportedLoad = true;
        this.registry.markLoaded(def.id);
      },
      onTileError: (message) => {
        if (reportedError || reportedLoad) return;
        reportedError = true;
        this.registry.markError(def.id, message);
      },
    });

    tileLayer.addTo(this.map);
    this.managed.set(def.id, { leafletLayer: tileLayer, signature: 'raster', abort: null });
  }

  private async syncVector(def: GISLayerDef): Promise<void> {
    const runtime = this.registry.get(def.id);
    const opacity = runtime?.opacity ?? def.defaultOpacity;
    const bounds = this.viewportBounds();
    const signature = this.vectorSignature(bounds);

    const existing = this.managed.get(def.id);
    if (existing?.signature === signature) {
      this.setOpacity(def.id, opacity);
      return;
    }

    // Supersede any request still running for this layer.
    existing?.abort?.abort();

    const abort = new AbortController();
    this.registry.markLoading(def.id);

    let result;
    try {
      result = await this.provider.queryFeatures(def.id, {
        bounds,
        maxFeatures: MAX_FEATURES_PER_LAYER,
        signal: abort.signal,
      });
    } catch (cause) {
      if (abort.signal.aborted || this.disposed) return;
      const message = cause instanceof Error ? cause.message : String(cause);
      this.registry.markError(def.id, message);
      return;
    }

    if (this.disposed || abort.signal.aborted) return;
    // The layer may have been hidden while the request was in flight.
    if (!this.registry.isVisible(def.id)) return;

    const rendered = this.buildVectorLayer(def, result.featureCollection, opacity);

    // Swap only once the replacement is built, so the layer never blinks.
    this.remove(def.id);
    rendered.addTo(this.map);
    this.managed.set(def.id, { leafletLayer: rendered, signature, abort });

    this.registry.markLoaded(def.id, { featureCount: result.count, truncated: result.truncated });
  }

  /**
   * Render a fetched collection, clustering dense point layers.
   *
   * Non-point geometries always draw individually — a boundary is not something
   * you cluster. Point layers draw individually too until there are enough of
   * them that they would overlap into a solid mass, at which point nearby points
   * collapse into a bubble carrying their exact count.
   */
  private buildVectorLayer(
    def: GISLayerDef,
    collection: GeoJSON.FeatureCollection,
    opacity: number,
  ): L.FeatureGroup {
    const style = toPathStyle(def.style, opacity);
    const pointRadius = def.style?.pointRadius ?? 4;

    const points = collection.features.filter((f) => f?.geometry?.type === 'Point');
    const others = collection.features.filter((f) => f?.geometry && f.geometry.type !== 'Point');
    const shouldCluster = points.length >= CLUSTER_MIN_POINTS;

    const group = L.featureGroup([], { pane: PANE_VECTOR });

    // Anything that is not a lone point, plus every point when not clustering.
    const direct = shouldCluster ? others : collection.features;
    if (direct.length) {
      group.addLayer(
        L.geoJSON(
          { type: 'FeatureCollection', features: direct } as GeoJSON.FeatureCollection,
          {
            pane: PANE_VECTOR,
            style: () => style,
            pointToLayer: (_feature, latlng) =>
              L.circleMarker(latlng, { ...style, radius: pointRadius, pane: PANE_VECTOR }),
            onEachFeature: (feature, child) => this.bindFeature(child, def, feature),
          },
        ),
      );
    }

    if (!shouldCluster) return group;

    for (const cluster of clusterPoints(this.map, points, this.map.getZoom())) {
      if (cluster.members.length === 1) {
        const feature = cluster.members[0];
        const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates as [number, number];
        const marker = L.circleMarker(L.latLng(lat, lng), {
          ...style,
          radius: pointRadius,
          pane: PANE_VECTOR,
        });
        this.bindFeature(marker, def, feature);
        group.addLayer(marker);
        continue;
      }

      const members = cluster.members;
      const marker = L.marker(L.latLng(cluster.lat, cluster.lng), {
        icon: clusterIcon(members.length, def.style?.color ?? '#4c8dd9'),
        pane: PANE_VECTOR,
        keyboard: false,
      });

      marker.bindTooltip(`${members.length.toLocaleString('en-IN')} ${def.label}`, {
        className: 'arka-gis-highlight-tip',
        direction: 'top',
        offset: [0, -10],
      });

      // Fitting the members' own bounds splits the cluster deterministically,
      // where a fixed zoom step might leave it merged.
      marker.on('click', () => {
        const bounds = L.latLngBounds(
          members.map((member) => {
            const [lng, lat] = (member.geometry as GeoJSON.Point).coordinates as [number, number];
            return L.latLng(lat, lng);
          }),
        );
        if (bounds.isValid()) {
          this.map.fitBounds(bounds.pad(0.2), { maxZoom: 18 });
        }
      });

      group.addLayer(marker);
    }

    return group;
  }

  /**
   * Wire a popup and selection behaviour onto one rendered feature.
   *
   * The click both outlines the feature and reports it upward, so the compact
   * info card and the map highlight can never disagree about what is selected.
   */
  private bindFeature(target: L.Layer, def: GISLayerDef, feature: GeoJSON.Feature): void {
    const properties = (feature.properties ?? {}) as Record<string, unknown>;
    const geometry = feature.geometry ?? null;

    target.bindPopup(buildPopupHtml(def, properties, this.provider.attribution), {
      className: 'arka-gis-popup',
      maxWidth: 340,
      autoPanPadding: [24, 24],
    });

    target.on('click', () => {
      if (geometry) this.showHighlight([{ geometry }]);
      this.onFeatureClick?.(def, properties, geometry);
    });
  }

  /** Current viewport, padded, as a WGS84 box. */
  private viewportBounds(): GISBounds {
    const bounds = this.map.getBounds().pad(VIEWPORT_PAD);
    return {
      west: bounds.getWest(),
      south: bounds.getSouth(),
      east: bounds.getEast(),
      north: bounds.getNorth(),
    };
  }

  /**
   * Coarse viewport key. Rounding to three decimals (~100 m) means a small pan
   * reuses the features already fetched instead of hitting the server again.
   */
  private vectorSignature(bounds: GISBounds): string {
    const r = (v: number) => v.toFixed(3);
    return `${r(bounds.west)},${r(bounds.south)},${r(bounds.east)},${r(bounds.north)}`;
  }

  /**
   * Apply catalogue draw order within each pane.
   *
   * Leaflet has no z-index for vectors inside one pane, so ordering is done by
   * DOM position: `bringToFront` in ascending order leaves the highest `order`
   * on top. Raster layers use the native z-index.
   */
  private applyOrdering(): void {
    const ordered = this.provider
      .listLayers()
      .filter((def) => this.managed.has(def.id))
      .sort((a, b) => a.order - b.order);

    let rasterZ = PANE_RASTER_Z;
    for (const def of ordered) {
      const managed = this.managed.get(def.id);
      if (!managed) continue;

      if (def.kind === 'vector') {
        eachPath(managed.leafletLayer, (path) => path.bringToFront());
      } else {
        rasterZ += 1;
        (managed.leafletLayer as L.TileLayer).setZIndex(rasterZ);
      }
    }

    // The selection outline is drawn in its own pane, but a fresh sync can still
    // reorder the DOM beneath it; re-raise it so it stays legible.
    this.highlight?.bringToFront();
  }
}

export { PANE_RASTER, PANE_VECTOR, PANE_SELECT };
