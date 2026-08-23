/**
 * Provider-agnostic contracts for ARKA's base GIS tier.
 *
 * ARKA separates three tiers of map data and never merges them:
 *
 *   BASE GIS      authoritative city geography from a civic GIS provider
 *                 (boundaries, roads, water, infrastructure, POIs)
 *   ARKA LIVE     operational telemetry ARKA itself ingests
 *   ARKA INTEL    analysis ARKA derives on top of the other two
 *
 * These types cover the first tier only. A city is plugged in by implementing
 * `CityGISProvider`; nothing above this file may reference a specific vendor
 * endpoint, so a second city can be added without touching the map or the
 * layer controls.
 */

/** Which tier a layer belongs to. Used to keep the layer panel honest. */
export type GISTier = 'BASE_GIS' | 'ARKA_LIVE' | 'ARKA_INTEL';

/**
 * Thematic grouping used by the layer panel. Mirrors how civic GIS portals
 * organise their catalogues.
 */
export type GISCategory =
  | 'administrative'
  | 'transportation'
  | 'environment'
  | 'infrastructure'
  | 'poi'
  | 'planning';

export const GIS_CATEGORY_LABEL: Record<GISCategory, string> = {
  administrative: 'Administrative',
  transportation: 'Transportation',
  environment: 'Water & environment',
  infrastructure: 'Civic infrastructure',
  poi: 'Points of interest',
  planning: 'Land & planning',
};

/**
 * How a layer reaches the map.
 *
 *  raster-tiled    pre-built tile pyramid, fetched as {z}/{y}/{x} images
 *  raster-dynamic  server renders an image per request; supports per-sublayer
 *                  selection, which tiled caches cannot do
 *  vector          features fetched as GeoJSON and styled by ARKA, so they are
 *                  clickable and theme-aware
 */
export type GISLayerKind = 'raster-tiled' | 'raster-dynamic' | 'vector';

/**
 * What kind of claim a layer makes about the world.
 *
 * `reference` data describes assets and geography that change on a planning
 * timescale — a ward boundary, a pipeline route, where a camera is mounted.
 * `observation` would be a live reading. Base GIS is reference data, and the
 * UI labels it that way so an operator never reads an asset inventory as
 * live telemetry.
 */
export type GISDataClass = 'reference' | 'observation';

/** A single addressable layer in a provider's catalogue. */
export interface GISLayerDef {
  /** Stable id used in state, URLs and persistence. Provider-scoped. */
  id: string;
  label: string;
  category: GISCategory;
  kind: GISLayerKind;
  dataClass: GISDataClass;
  /** One line an operator can act on. */
  description: string;
  /**
   * Set when the layer could be mistaken for something it is not — e.g. camera
   * mount points are an asset inventory, not a live video feed. Rendered
   * verbatim in the layer detail panel.
   */
  caveat?: string;
  /** Default visibility on first load. Keep this small; the map must stay legible. */
  defaultVisible: boolean;
  /** 0–1. */
  defaultOpacity: number;
  /**
   * Draw order within the base-GIS pane. Higher sits on top. Polygons should
   * sit below lines, which sit below points.
   */
  order: number;
  /** Provider-specific addressing. Opaque above the provider. */
  source: GISLayerSource;
  /** Rendering hints for vector layers, in ARKA theme terms. */
  style?: GISVectorStyle;
  /** Feature fields worth showing in a popup, in display order. */
  popupFields?: GISPopupField[];
  /** Field to label features by, when the layer is searchable. */
  searchField?: string;
}

/**
 * Opaque provider addressing. The ArcGIS shape is the only one implemented
 * today; adding a WMS or vector-tile provider means adding a variant here.
 */
export type GISLayerSource =
  | {
      protocol: 'arcgis';
      /** Service path relative to the provider's service root. */
      service: string;
      serviceType: 'MapServer' | 'FeatureServer';
      /**
       * Sublayer ids. For raster-dynamic this becomes `layers=show:...`; for
       * vector it must be exactly one id.
       */
      sublayers: number[];
    }
  | {
      protocol: 'xyz';
      urlTemplate: string;
      maxZoom?: number;
    };

export interface GISVectorStyle {
  /** Stroke colour. Use ARKA CSS variables where possible. */
  color: string;
  weight?: number;
  fillColor?: string;
  fillOpacity?: number;
  dashArray?: string;
  /** Radius in px for point layers. */
  pointRadius?: number;
}

export interface GISPopupField {
  /** Attribute name as returned by the provider. */
  field: string;
  /** Human label. Provider field names are rarely presentable. */
  label: string;
  /**
   * Optional formatter for numbers that need units or grouping.
   *
   * `area-hectares` renders a value already stored in hectares; `area-sqm`
   * renders a value stored in square metres. Provider catalogues mix the two
   * within the same service, so the distinction has to be explicit.
   */
  format?: 'integer' | 'decimal' | 'area-hectares' | 'area-sqm' | 'length-metres';
}

/** Metadata read back from the provider, rather than assumed by ARKA. */
export interface GISLayerDescription {
  layerId: string;
  /** Name the provider reports for the service or sublayer. */
  providerName: string | null;
  /** Provider's own copyright string. Empty on many services. */
  copyrightText: string | null;
  /** Geometry type for vector layers. */
  geometryType: string | null;
  /** Cap the provider enforces on a single query. */
  maxRecordCount: number | null;
  /** Sublayer names, for services that group several themes. */
  sublayerNames: string[];
  /** Extent the provider reports, as [west, south, east, north] in WGS84. */
  extent: [number, number, number, number] | null;
  /** When ARKA read this metadata. */
  fetchedAt: string;
}

/** Lifecycle of a layer's data, surfaced in the layer panel. */
export type GISLoadState = 'idle' | 'loading' | 'ready' | 'empty' | 'error';

export interface GISLayerRuntime {
  layerId: string;
  visible: boolean;
  opacity: number;
  loadState: GISLoadState;
  /** Provider-reported failure, shown verbatim. Never a generic 'no data'. */
  error: string | null;
  /** Features currently held, for vector layers. */
  featureCount: number | null;
  /** Last successful load. Null until one succeeds. */
  lastLoadedAt: string | null;
  /**
   * True when the provider returned exactly `maxRecordCount` features, meaning
   * the response was capped and the layer is showing a subset.
   */
  truncated: boolean;
}

export interface GISBounds {
  west: number;
  south: number;
  east: number;
  north: number;
}

export interface GISQueryOptions {
  /** Restrict to a viewport. Strongly recommended for city-wide layers. */
  bounds?: GISBounds;
  /** Hard cap ARKA applies on top of the provider's own limit. */
  maxFeatures?: number;
  /** Abort signal so a pan can cancel an in-flight request. */
  signal?: AbortSignal;
}

export interface GISFeatureResult {
  /** RFC 7946 FeatureCollection. */
  featureCollection: GeoJSON.FeatureCollection;
  count: number;
  /** Provider hit its record cap, so this is a subset of the layer. */
  truncated: boolean;
  fetchedAt: string;
}

export interface GISSearchHit {
  layerId: string;
  layerLabel: string;
  label: string;
  lat: number;
  lng: number;
  /** Raw attributes, for the popup. */
  properties: Record<string, unknown>;
}

/** Template for building raster requests, consumed by the map adapter. */
export interface GISRasterTemplate {
  kind: 'raster-tiled' | 'raster-dynamic';
  /** For raster-tiled: a {z}/{y}/{x} template. */
  tileUrl?: string;
  /**
   * For raster-dynamic: builds an image URL for one tile's bbox. The adapter
   * supplies Web Mercator bounds and pixel size.
   */
  exportUrl?: (bboxWebMercator: [number, number, number, number], widthPx: number, heightPx: number) => string;
  maxZoom: number;
  attribution: string;
}

/**
 * A city GIS provider. `BhubaneswarGISService` is the first implementation;
 * the map and layer panel talk only to this interface.
 */
export interface CityGISProvider {
  readonly id: string;
  readonly cityName: string;
  /** Shown in the map attribution control and layer detail panel. */
  readonly attribution: string;
  /** Human-facing portal, for an operator who needs to check the source. */
  readonly portalUrl: string;
  /** Default map view for this city: [lat, lng] and zoom. */
  readonly home: { lat: number; lng: number; zoom: number };

  listLayers(): GISLayerDef[];
  getLayer(layerId: string): GISLayerDef | undefined;

  /** Read metadata from the provider. Implementations should cache. */
  describeLayer(layerId: string): Promise<GISLayerDescription>;

  /** Fetch GeoJSON for a vector layer. Rejects for raster layers. */
  queryFeatures(layerId: string, options?: GISQueryOptions): Promise<GISFeatureResult>;

  /** Raster request template, or null for vector layers. */
  rasterTemplate(layerId: string): GISRasterTemplate | null;

  /** Name search across searchable vector layers. */
  searchFeatures(term: string, options?: { signal?: AbortSignal; limit?: number }): Promise<GISSearchHit[]>;
}
