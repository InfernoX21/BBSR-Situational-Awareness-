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
  GISPopupField,
  GISVectorStyle,
} from './types';
import { GISLayerRegistry } from './GISLayerRegistry';

/**
 * Pane z-indexes. Leaflet puts `tilePane` at 200 and `overlayPane` at 400;
 * base GIS occupies the gap so it can never cover an ARKA overlay.
 */
const PANE_RASTER = 'arka-gis-raster';
const PANE_VECTOR = 'arka-gis-vector';
const PANE_RASTER_Z = 250;
const PANE_VECTOR_Z = 350;

/** Half the Web Mercator circumference, in metres. */
const WEB_MERCATOR_EXTENT = 20037508.342789244;

/** Cap the GeoJSON fetched per layer. The provider's own limit is 1,000. */
const MAX_FEATURES_PER_LAYER = 1000;

/** Extra room around the viewport, so a small pan does not trigger a refetch. */
const VIEWPORT_PAD = 0.25;

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

/** Format a popup value using the field's declared unit. */
function formatValue(value: unknown, format: GISPopupField['format']): string | null {
  if (value === null || value === undefined) return null;

  if (typeof value === 'string') {
    // The source data uses a single space as a null marker in several tables.
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  if (typeof value !== 'number' || !Number.isFinite(value)) return String(value);

  switch (format) {
    case 'integer':
      return Math.round(value).toLocaleString('en-IN');
    case 'decimal':
      return value.toLocaleString('en-IN', { maximumFractionDigits: 2 });
    case 'area-hectares':
      return `${value.toLocaleString('en-IN', { maximumFractionDigits: 2 })} ha`;
    case 'area-sqm':
      // Square metres in the source; hectares is what a planner reads.
      return `${(value / 10_000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ha`;
    case 'length-metres':
      return value >= 1000
        ? `${(value / 1000).toLocaleString('en-IN', { maximumFractionDigits: 2 })} km`
        : `${Math.round(value).toLocaleString('en-IN')} m`;
    default:
      return value.toLocaleString('en-IN');
  }
}

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
    const formatted = formatValue(properties[field.field], field.format);
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
    ? `<p class="mt-2 pt-2 border-t border-line text-[11px] text-caution-ink">${escapeHtml(layer.caveat)}</p>`
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
  private onFeatureClick?: (layer: GISLayerDef, properties: Record<string, unknown>) => void;

  constructor(
    map: L.Map,
    registry: GISLayerRegistry,
    options: { onFeatureClick?: (layer: GISLayerDef, properties: Record<string, unknown>) => void } = {},
  ) {
    this.map = map;
    this.registry = registry;
    this.provider = registry.getProvider();
    this.onFeatureClick = options.onFeatureClick;
    this.ensurePanes();
  }

  /**
   * Create the two base GIS panes if they do not exist.
   *
   * Both sit between Leaflet's `tilePane` (200) and `overlayPane` (400), which
   * is what structurally guarantees ARKA's own overlays stay on top.
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
  }

  /** True when the pane exists and holds nothing — used by the map's guards. */
  hasAnyLayer(): boolean {
    return this.managed.size > 0;
  }

  /**
   * Bring the panes back to the correct z-index.
   *
   * ARKA's basemap effect removes every `L.TileLayer` on the map when the
   * basemap changes. Panes survive that, but this is the hook for restoring
   * anything that does not.
   */
  refreshPanes(): void {
    this.ensurePanes();
  }

  /** Reconcile the map against current registry state. */
  async sync(): Promise<void> {
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

  /** Re-run vector queries for the new viewport. Raster tiles handle this natively. */
  async refreshViewport(): Promise<void> {
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
      const group = managed.leafletLayer as L.GeoJSON;
      group.setStyle(toPathStyle(def.style, opacity));
      // Circle markers carry their own fill, so restyle them explicitly.
      group.eachLayer((child) => {
        if (child instanceof L.CircleMarker) child.setStyle(toPathStyle(def.style, opacity));
      });
    } else {
      (managed.leafletLayer as L.TileLayer).setOpacity(opacity);
    }
  }

  /** Fit the map to a layer's published extent, if it has a usable one. */
  async zoomToLayer(layerId: string): Promise<boolean> {
    const description = await this.provider.describeLayer(layerId).catch(() => null);
    const extent = description?.extent;
    if (!extent) return false;

    const [west, south, east, north] = extent;
    this.map.fitBounds(
      L.latLngBounds(L.latLng(south, west), L.latLng(north, east)),
      { padding: [24, 24] },
    );
    return true;
  }

  /** Remove everything and stop all in-flight work. */
  dispose(): void {
    this.disposed = true;
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
      updateWhenIdle: true,
      updateWhenZooming: false,
      keepBuffer: 1,
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

    const geoJsonLayer = L.geoJSON(result.featureCollection, {
      pane: PANE_VECTOR,
      style: () => toPathStyle(def.style, opacity),
      pointToLayer: (_feature, latlng) =>
        L.circleMarker(latlng, {
          ...toPathStyle(def.style, opacity),
          radius: def.style?.pointRadius ?? 4,
          pane: PANE_VECTOR,
        }),
      onEachFeature: (feature, leafletLayer) => {
        const properties = (feature.properties ?? {}) as Record<string, unknown>;

        leafletLayer.bindPopup(buildPopupHtml(def, properties, this.provider.attribution), {
          className: 'arka-gis-popup',
          maxWidth: 340,
          autoPanPadding: [24, 24],
        });

        if (this.onFeatureClick) {
          leafletLayer.on('click', () => this.onFeatureClick?.(def, properties));
        }
      },
    });

    // Swap only once the replacement is built, so the layer never blinks.
    this.remove(def.id);
    geoJsonLayer.addTo(this.map);
    this.managed.set(def.id, { leafletLayer: geoJsonLayer, signature, abort });

    this.registry.markLoaded(def.id, { featureCount: result.count, truncated: result.truncated });
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
        const group = managed.leafletLayer as L.GeoJSON;
        group.eachLayer((child) => {
          if ('bringToFront' in child) (child as L.Path).bringToFront();
        });
      } else {
        rasterZ += 1;
        (managed.leafletLayer as L.TileLayer).setZIndex(rasterZ);
      }
    }
  }
}

export { PANE_RASTER, PANE_VECTOR };
