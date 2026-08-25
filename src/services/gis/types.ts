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
 * Thematic grouping for the layer tree.
 *
 * These mirror the theme structure civic GIS portals publish, so a planner who
 * knows the city's own catalogue finds the same layer in the same place. Two
 * groups (`planning`, `environment`) are ARKA additions covering verified
 * datasets that the standard theme list has no home for.
 */
export type GISCategory =
  | 'admin-boundaries'
  | 'statutory-boundaries'
  | 'smart-city'
  | 'community-services'
  | 'culture'
  | 'educational'
  | 'government-office'
  | 'health'
  | 'religious'
  | 'youth-recreation'
  | 'tourism'
  | 'parking'
  | 'transportation'
  | 'utility'
  | 'planning'
  | 'environment';

export const GIS_CATEGORY_LABEL: Record<GISCategory, string> = {
  'admin-boundaries': 'Administrative boundaries',
  'statutory-boundaries': 'Statutory & other boundaries',
  'smart-city': 'Smart city',
  'community-services': 'Community services',
  culture: 'Culture',
  educational: 'Educational',
  'government-office': 'Government offices',
  health: 'Health',
  religious: 'Religious places',
  'youth-recreation': 'Youth services & recreation',
  tourism: 'Tourism',
  parking: 'Parking',
  transportation: 'Transportation',
  utility: 'Utility networks',
  planning: 'Land use & planning',
  environment: 'Water & environment',
};

/**
 * Display order of theme groups in the layer tree. Boundaries first because
 * they frame everything else; bulk reference data last.
 */
export const GIS_CATEGORY_ORDER: GISCategory[] = [
  'admin-boundaries',
  'statutory-boundaries',
  'planning',
  'transportation',
  'utility',
  'environment',
  'smart-city',
  'health',
  'educational',
  'community-services',
  'government-office',
  'parking',
  'culture',
  'religious',
  'tourism',
  'youth-recreation',
];

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

/**
 * The single vocabulary ARKA uses to describe where a layer's data stands.
 *
 * This is deliberately the *only* wording the UI is allowed to show, because
 * the distinctions carry operational weight:
 *
 *  connected          a live request to the source succeeded and features or
 *                     tiles are on the map right now
 *  available-dataset  the layer is backed by a verified dataset that ARKA has
 *                     confirmed exists, but nothing has been requested yet
 *  loading            a request is in flight
 *  unavailable        the source failed, or the dataset could not be reached
 *  simulation         the values are modelled or seeded, never an observation
 *  no-data            the source answered successfully and returned nothing
 *
 * `unavailable` and `no-data` are kept apart on purpose: an empty answer is a
 * fact about the city, a failed request is a fact about the plumbing, and an
 * operator must never see one presented as the other.
 */
export type GISSourceState =
  | 'connected'
  | 'available-dataset'
  | 'loading'
  | 'unavailable'
  | 'simulation'
  | 'no-data';

export const GIS_SOURCE_STATE_LABEL: Record<GISSourceState, string> = {
  connected: 'Connected',
  'available-dataset': 'Available dataset',
  loading: 'Loading',
  unavailable: 'Unavailable',
  simulation: 'Simulation',
  'no-data': 'No data',
};

/**
 * Which ARKA badge class renders each state. Kept next to the labels so a new
 * state cannot be added without deciding how it looks.
 */
export const GIS_SOURCE_STATE_TONE: Record<GISSourceState, string> = {
  connected: 'is-info',
  'available-dataset': 'is-neutral',
  loading: 'is-neutral',
  unavailable: 'is-low',
  simulation: 'is-sample',
  'no-data': 'is-neutral',
};

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
  /**
   * Verified feature count at the time the catalogue was compiled.
   *
   * This is provenance, not a live number: it records that ARKA checked the
   * dataset was non-empty before publishing the layer. The runtime count from
   * an actual request always takes precedence in the UI.
   */
  verifiedFeatureCount?: number;
  /**
   * Set for layers that are too large to fetch as GeoJSON at city scale, so the
   * UI can explain why they render as server images and carry no selection.
   */
  bulkDataset?: boolean;
  /**
   * Facility class, for layers the spatial query engine can search by kind.
   * Absent for boundaries and networks.
   */
  facilityKind?: GISFacilityKind;
}

/**
 * Facility classes the spatial query engine exposes. Each maps to one or more
 * catalogued layers; a class only appears in the query UI when at least one of
 * its layers is backed by a verified dataset.
 */
export type GISFacilityKind =
  | 'school'
  | 'college'
  | 'university'
  | 'training-institute'
  | 'anganwadi'
  | 'hospital'
  | 'clinic'
  | 'nursing-home'
  | 'health-centre'
  | 'dispensary'
  | 'government-office'
  | 'police'
  | 'fire'
  | 'post-office'
  | 'bank'
  | 'community-centre'
  | 'park'
  | 'library'
  | 'museum'
  | 'temple'
  | 'church'
  | 'mosque'
  | 'gurudwara'
  | 'monument'
  | 'hotel'
  | 'restaurant'
  | 'fuel'
  | 'market'
  | 'parking'
  | 'toilet'
  | 'transport';

export const GIS_FACILITY_LABEL: Record<GISFacilityKind, string> = {
  school: 'Schools',
  college: 'Colleges',
  university: 'Universities',
  'training-institute': 'Training institutes',
  anganwadi: 'Anganwadi centres',
  hospital: 'Hospitals',
  clinic: 'Clinics',
  'nursing-home': 'Nursing homes',
  'health-centre': 'Health centres',
  dispensary: 'Government dispensaries',
  'government-office': 'Government offices',
  police: 'Police stations',
  fire: 'Fire stations',
  'post-office': 'Post offices',
  bank: 'Banks',
  'community-centre': 'Community centres',
  park: 'Parks',
  library: 'Libraries',
  museum: 'Museums',
  temple: 'Temples',
  church: 'Churches',
  mosque: 'Masjids',
  gurudwara: 'Gurudwaras',
  monument: 'Monuments',
  hotel: 'Hotels',
  restaurant: 'Restaurants',
  fuel: 'Fuel stations',
  market: 'Markets & shopping',
  parking: 'Parking lots',
  toilet: 'Public toilets',
  transport: 'Transport terminals',
};

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
  /**
   * Treat zero as "not published" rather than as a measured value.
   *
   * Several source tables are only partly filled in — school enrolment is
   * present for 350 of 354 schools, anganwadi catchment population for 203 of
   * 355 centres. Rendering the gaps as `0` would state that a school has no
   * students. Setting this hides the row instead, which is the truthful
   * rendering of an absent value.
   */
  suppressZero?: boolean;
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

export interface GISLayerRuntime {
  layerId: string;
  visible: boolean;
  opacity: number;
  /** Where this layer's data stands, in ARKA's single state vocabulary. */
  sourceState: GISSourceState;
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
  /**
   * Extra provider-side filter, as a field/value pair. Kept structured rather
   * than as raw SQL so the provider can escape it and callers cannot inject.
   */
  attributeFilter?: { field: string; value: string; match: 'exact' | 'contains' };
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

// ---------------------------------------------------------------------------
// Ward intelligence
// ---------------------------------------------------------------------------

/**
 * One ward, as published by the city's ward boundary dataset.
 *
 * Every field is optional because ARKA reports only what the source actually
 * carries. A missing value renders as absent, never as zero — a ward with no
 * published population is not a ward with no people.
 */
export interface GISWardRecord {
  /** Ward code as published, e.g. `W25`. Used as the selection key. */
  wardNo: string;
  /** Municipal zone the ward sits in, when published. */
  zone: string | null;
  /** Elected representative, when published. */
  councillor: string | null;
  /** Administrative officer, when published. */
  wardOfficer: string | null;
  areaHectares: number | null;
  households: number | null;
  population: number | null;
  populationMale: number | null;
  populationFemale: number | null;
  populationSC: number | null;
  populationST: number | null;
  /** Ward polygon, for highlight and zoom. */
  geometry: GeoJSON.Geometry | null;
  /** Bounds of the polygon, precomputed for zoom-to. */
  bounds: GISBounds | null;
}

/** Citywide totals derived from the ward dataset by the provider. */
export interface GISWardTotals {
  wardCount: number;
  population: number | null;
  households: number | null;
  /** Which dataset produced these numbers, for attribution. */
  datasetLabel: string;
}

// ---------------------------------------------------------------------------
// Spatial query
// ---------------------------------------------------------------------------

/** A layer the spatial query engine can search, with its verified backing. */
export interface GISQueryableLayer {
  layerId: string;
  label: string;
  category: GISCategory;
  facilityKind: GISFacilityKind | null;
  /** Field the engine matches names against. */
  searchField: string;
  verifiedFeatureCount: number | null;
}

/** One result row from a spatial query. */
export interface GISQueryResult {
  layerId: string;
  layerLabel: string;
  /** Best available display name for the feature. */
  label: string;
  lat: number;
  lng: number;
  /** Readable attribute rows, already label-mapped and unit-formatted. */
  attributes: GISAttributeRow[];
  geometry: GeoJSON.Geometry | null;
}

/**
 * One attribute, converted for display.
 *
 * The engine resolves provider field names to labels here rather than in the
 * view, so every surface that shows a feature — popup, info card, query result
 * — reads identically.
 */
export interface GISAttributeRow {
  label: string;
  value: string;
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

  // --- Ward intelligence -------------------------------------------------

  /**
   * True when this provider has a verified ward dataset. When false the ward
   * module must show its unavailable state rather than an empty dropdown.
   */
  hasWardDataset(): boolean;

  /**
   * Catalogue id of the layer that draws ward boundaries, or null when the
   * provider publishes none.
   *
   * Exposed so the ward module can switch the boundary outlines on for context
   * without naming a city-specific layer id. Nothing above the provider is
   * allowed to know that Bhubaneswar's ward layer happens to be called
   * `bmc-wards`.
   */
  readonly wardLayerId: string | null;

  /** Ward codes and labels for the selector, cheapest possible request. */
  listWards(options?: { signal?: AbortSignal }): Promise<GISWardRecord[]>;

  /** Full record for one ward, including geometry. Null when not published. */
  getWard(wardNo: string, options?: { signal?: AbortSignal }): Promise<GISWardRecord | null>;

  /** Citywide totals from the ward dataset, or null when unsupported. */
  getWardTotals(options?: { signal?: AbortSignal }): Promise<GISWardTotals | null>;

  // --- Spatial query -----------------------------------------------------

  /** Layers the query engine can search. Derived from the catalogue. */
  listQueryableLayers(): GISQueryableLayer[];

  /**
   * True when a verified population dataset is connected. Gates the population
   * query so ARKA never offers an analysis it cannot actually run.
   */
  hasPopulationDataset(): boolean;

  /** Run a name/attribute query against one layer. */
  queryLayer(
    layerId: string,
    term: string,
    options?: { signal?: AbortSignal; limit?: number; bounds?: GISBounds },
  ): Promise<GISQueryResult[]>;

  /** Convert raw provider attributes into readable rows for one layer. */
  describeFeature(layerId: string, properties: Record<string, unknown>): GISAttributeRow[];
}
