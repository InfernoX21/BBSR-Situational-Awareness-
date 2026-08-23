/**
 * BhubaneswarOne GIS provider — ARKA's first `CityGISProvider` implementation.
 *
 * BhubaneswarOne (https://bhubaneswarone.in) publishes the city's authoritative
 * geospatial catalogue through a public, keyless ArcGIS Enterprise REST
 * endpoint. This module is the only place in ARKA that knows those endpoints
 * exist: the map, the layer controls and the search box all talk to the
 * `CityGISProvider` interface, so a second city can be added by writing another
 * provider rather than by editing the dashboard.
 *
 * Three properties of this integration are deliberate and should survive
 * refactoring:
 *
 * 1. READ-ONLY BY CONSTRUCTION. Several FeatureServers on this deployment
 *    advertise `Create,Update,Delete,Editing` without authentication. ARKA must
 *    never touch those verbs, so every request is funnelled through
 *    `fetchJson`/`buildUrl`, which reject any operation outside a documented
 *    read path. See `READ_ONLY_OPERATIONS`.
 *
 * 2. REFERENCE DATA, NOT TELEMETRY. This is an asset and geography catalogue —
 *    ward boundaries, pipeline routes, where a camera is mounted. Every layer is
 *    `dataClass: 'reference'`, and layers an operator could mistake for a live
 *    feed carry an explicit `caveat`. Base GIS never enters ARKA's live tier.
 *
 * 3. ONLY VERIFIED LAYERS SHIP. Every service path, sublayer id, field name and
 *    render below was confirmed against the live endpoint. Layers that exist in
 *    the catalogue but return nothing are excluded on purpose — see
 *    `EXCLUDED_LAYERS` for what was dropped and why.
 *
 * No credentials are involved: the endpoint is anonymous, CORS-enabled
 * (`Access-Control-Allow-Origin` reflects the caller's origin), and needs no
 * proxy. There is therefore no API key to keep out of the client bundle.
 */

import type {
  CityGISProvider,
  GISBounds,
  GISFeatureResult,
  GISLayerDef,
  GISLayerDescription,
  GISQueryOptions,
  GISRasterTemplate,
  GISSearchHit,
} from './types';

// ---------------------------------------------------------------------------
// Endpoint configuration
// ---------------------------------------------------------------------------

/** ArcGIS services folder holding the city catalogue. */
const SERVICE_ROOT = 'https://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne';

/** Portal an operator can open to check a source by hand. */
const PORTAL_URL = 'https://bhubaneswarone.in/bhubaneswarone/';

/**
 * Services return an empty `copyrightText`, so attribution is authored here
 * from the publisher's own identity rather than left blank.
 */
const ATTRIBUTION = 'City GIS: BhubaneswarOne — BMC / BDA / BSCL';

/** Default view. Matches the published webmap's centre. */
const HOME_VIEW = { lat: 20.2961, lng: 85.8245, zoom: 13 };

/** Half the Web Mercator circumference, in metres. */
const WEB_MERCATOR_EXTENT = 20037508.342789244;

/**
 * Every service in this folder reports `maxRecordCount: 1000`. ARKA reads the
 * real value in `describeLayer`, but needs a default before metadata arrives.
 */
const DEFAULT_MAX_RECORDS = 1000;

/** Per-request ceiling. A pan should fail fast rather than hang the map. */
const REQUEST_TIMEOUT_MS = 20_000;

/** Metadata is planning-timescale data; an hour is plenty. */
const METADATA_TTL_MS = 60 * 60 * 1000;

/**
 * Read operations ARKA is permitted to issue. `fetchJson` refuses anything
 * else, which is what keeps an editing verb from ever reaching an
 * unauthenticated FeatureServer — including by accident, via a future caller
 * that builds its own path.
 */
const READ_ONLY_OPERATIONS = ['query', 'export', 'legend', 'identify', ''] as const;

/**
 * Colours are the resolved values of ARKA's own design tokens (see
 * `src/index.css` `@theme`), inlined because Leaflet writes SVG presentation
 * attributes rather than CSS. Nothing new is introduced to the palette.
 */
const PALETTE = {
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
} as const;

/**
 * Layers present in the BhubaneswarOne catalogue that ARKA deliberately does
 * not publish, with the verified reason. Kept in code so a future contributor
 * re-checks rather than re-discovers.
 */
export const EXCLUDED_LAYERS: { path: string; reason: string }[] = [
  {
    path: 'PublicSpaces/MapServer',
    reason:
      'Upstream fault: the group layer reports no queryable sublayer and /query returns "DBMS table not found". Renders blank at every extent.',
  },
  {
    path: 'EcoSensitiveZoneBoundaryUpdated/MapServer',
    reason:
      'Both sublayers (Chandaka_Dampara, Nandankanan_Buffer) return a feature count of 0. Published but empty.',
  },
  {
    path: 'CityMap/MapServer/6 (as a vector layer)',
    reason:
      'Road Network is a group layer with no queryable geometry of its own; it is published as a raster layer instead.',
  },
];

// ---------------------------------------------------------------------------
// Layer catalogue
// ---------------------------------------------------------------------------

/**
 * The published catalogue.
 *
 * `kind` follows from what the service can actually do:
 *
 *  - `vector` where the feature count is small enough to fetch as GeoJSON, so
 *    ARKA can style it for a dark canvas and make it clickable.
 *  - `raster-dynamic` where the layer is a group, has thousands of features, or
 *    is only meaningful as cartography. Dynamic export is used rather than the
 *    tile cache because a fused cache renders the whole service and cannot
 *    isolate a sublayer — and the user's requirement is that every category
 *    stays independently controllable.
 *
 * `order` sorts within the base-GIS panes: area fills lowest, then lines, then
 * points, so a ward fill never hides a hospital marker.
 */
const LAYER_CATALOGUE: GISLayerDef[] = [
  // --- Administrative -----------------------------------------------------
  {
    id: 'cdp-2030',
    label: 'Comprehensive Development Plan 2030',
    category: 'planning',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Proposed land-use zoning for the BDA area under CDP 2030.',
    defaultVisible: false,
    defaultOpacity: 0.55,
    order: 12,
    source: {
      protocol: 'arcgis',
      service: 'ProposedBhubaneshwarCDP2030',
      serviceType: 'MapServer',
      sublayers: [0],
    },
  },
  {
    id: 'urban-transport-area',
    label: 'Urban transport area',
    category: 'planning',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Statutory boundary of the Bhubaneswar Urban Transport Area.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 13,
    source: { protocol: 'arcgis', service: 'UrbanTransport', serviceType: 'MapServer', sublayers: [1] },
    style: { color: PALETTE.transit, weight: 1.5, fillColor: PALETTE.transit, fillOpacity: 0.04, dashArray: '6 4' },
    popupFields: [{ field: 'vill_name', label: 'Area' }],
    searchField: 'vill_name',
  },
  {
    id: 'tp-schemes',
    label: 'Town planning schemes',
    category: 'planning',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Draft, declared and in-principle approved TP scheme boundaries.',
    defaultVisible: false,
    defaultOpacity: 0.7,
    order: 14,
    source: { protocol: 'arcgis', service: 'TPSchemeBoundary', serviceType: 'MapServer', sublayers: [0] },
  },
  {
    id: 'bda-boundary',
    label: 'BDA boundary',
    category: 'administrative',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Outer limit of the Bhubaneswar Development Authority area.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 15,
    source: { protocol: 'arcgis', service: 'Boundary', serviceType: 'MapServer', sublayers: [2] },
    style: { color: PALETTE.line, weight: 1.5, fillOpacity: 0, dashArray: '8 5' },
    popupFields: [{ field: 'name', label: 'Authority' }],
    searchField: 'name',
  },
  {
    id: 'village-mouza',
    label: 'Village / mouza boundaries',
    category: 'administrative',
    kind: 'vector',
    dataClass: 'reference',
    // Published with a fully transparent symbol, so the server-rendered image is
    // blank. Fetched as GeoJSON and styled by ARKA instead.
    description: 'Revenue village (mouza) boundaries across the BDA area, with tahsil and police station.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 16,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [1] },
    style: { color: PALETTE.line, weight: 0.6, fillOpacity: 0 },
    popupFields: [
      { field: 'village_name', label: 'Village' },
      { field: 'admin_boundary', label: 'Administrative area' },
      { field: 'tahsil_name', label: 'Tahsil' },
      { field: 'policestation_name', label: 'Police station' },
      { field: 'village_code', label: 'Village code' },
      { field: 'area', label: 'Area', format: 'area-sqm' },
    ],
    searchField: 'village_name',
  },
  {
    id: 'bda-planning-zones',
    label: 'BDA planning zones',
    category: 'administrative',
    kind: 'vector',
    dataClass: 'reference',
    description: 'BDA planning zones with their broad development classification.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 18,
    source: { protocol: 'arcgis', service: 'BMCBDAZONEPLAN', serviceType: 'MapServer', sublayers: [1] },
    style: { color: PALETTE.accentDim, weight: 1, fillColor: PALETTE.accent, fillOpacity: 0.05 },
    popupFields: [
      { field: 'name', label: 'Zone' },
      { field: 'number', label: 'Zone number', format: 'integer' },
      { field: 'broadzone', label: 'Classification' },
      { field: 'f_area', label: 'Area', format: 'area-sqm' },
    ],
    searchField: 'name',
  },
  {
    id: 'bmc-boundary',
    label: 'BMC boundary',
    category: 'administrative',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Bhubaneswar Municipal Corporation municipal limit.',
    defaultVisible: true,
    defaultOpacity: 1,
    order: 20,
    source: { protocol: 'arcgis', service: 'Boundary', serviceType: 'MapServer', sublayers: [1] },
    style: { color: PALETTE.accent, weight: 2, fillOpacity: 0 },
    popupFields: [{ field: 'Name', label: 'Area' }],
    searchField: 'Name',
  },
  {
    id: 'bmc-zones',
    label: 'BMC municipal zones',
    category: 'administrative',
    kind: 'vector',
    dataClass: 'reference',
    description: 'BMC administrative zones used for municipal service delivery.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 22,
    source: { protocol: 'arcgis', service: 'BMCBDAZONEPLAN', serviceType: 'MapServer', sublayers: [0] },
    style: { color: PALETTE.accent, weight: 1.4, fillColor: PALETTE.accent, fillOpacity: 0.04 },
    popupFields: [{ field: 'municipalz', label: 'Zone' }],
    searchField: 'municipalz',
  },
  {
    id: 'smart-city-abd',
    label: 'Smart City area-based development',
    category: 'planning',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'BSCL area-based development footprint and town centre precincts.',
    defaultVisible: false,
    defaultOpacity: 0.7,
    order: 24,
    source: { protocol: 'arcgis', service: 'BhubaneswarSmartCity', serviceType: 'MapServer', sublayers: [1] },
  },
  {
    id: 'bmc-wards',
    label: 'BMC wards',
    category: 'administrative',
    kind: 'vector',
    dataClass: 'reference',
    description: 'All 58 municipal wards with councillor, household count and zone.',
    defaultVisible: true,
    defaultOpacity: 0.9,
    order: 25,
    source: {
      protocol: 'arcgis',
      service: 'BMC_WardBoundary',
      serviceType: 'FeatureServer',
      sublayers: [0],
    },
    style: { color: PALETTE.accentDim, weight: 0.9, fillColor: PALETTE.accent, fillOpacity: 0.03 },
    popupFields: [
      { field: 'wardno', label: 'Ward' },
      { field: 'municipalz', label: 'Municipal zone' },
      { field: 'nameofthec', label: 'Councillor' },
      { field: 'numberofho', label: 'Households', format: 'integer' },
      { field: 'totalwardp', label: 'Ward population', format: 'integer' },
      { field: 'area_in_he', label: 'Area', format: 'area-hectares' },
    ],
    searchField: 'wardno',
  },

  // --- Transportation -----------------------------------------------------
  {
    id: 'airport-area',
    label: 'Airport area',
    category: 'transportation',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Biju Patnaik International Airport operational area.',
    defaultVisible: false,
    defaultOpacity: 0.8,
    order: 26,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [5] },
  },
  {
    id: 'parking-sites',
    label: 'Designated parking sites',
    category: 'transportation',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Surveyed on-street and off-street parking footprints.',
    caveat: 'Site extents only. This layer carries no occupancy or availability data.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 35,
    source: { protocol: 'arcgis', service: 'SmartElements', serviceType: 'FeatureServer', sublayers: [13] },
    style: { color: PALETTE.transit, weight: 1.2, fillColor: PALETTE.transit, fillOpacity: 0.18 },
    popupFields: [{ field: 'name', label: 'Location' }],
    searchField: 'name',
  },
  {
    id: 'bus-routes',
    label: 'Bus route network',
    category: 'transportation',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Mo Bus route alignments across the nine published corridors.',
    caveat: 'Planned route alignments. Vehicle positions come from ARKA live data, not from this layer.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 52,
    source: {
      protocol: 'arcgis',
      service: 'UpdatedBusRouteNetwork',
      serviceType: 'MapServer',
      sublayers: [10],
    },
  },
  {
    id: 'link-road',
    label: 'Link roads',
    category: 'transportation',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Secondary link road network.',
    defaultVisible: false,
    defaultOpacity: 0.8,
    order: 54,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [11] },
  },
  {
    id: 'road-network',
    label: 'Road network',
    category: 'transportation',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Complete classified road network: highways, major roads, link roads and flyovers.',
    defaultVisible: true,
    defaultOpacity: 0.75,
    order: 55,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [6] },
  },
  {
    id: 'major-road',
    label: 'Major roads',
    category: 'transportation',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Arterial road network only, without link roads.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 56,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [10] },
  },
  {
    id: 'state-highway',
    label: 'State highways',
    category: 'transportation',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'State highway corridors through the BDA area.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 57,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [9] },
  },
  {
    id: 'national-highway',
    label: 'National highways',
    category: 'transportation',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'National highway corridors through the BDA area.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 58,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [8] },
  },
  {
    id: 'flyover',
    label: 'Flyovers',
    category: 'transportation',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Grade-separated flyover structures.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 59,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [7] },
  },
  {
    id: 'bus-stops',
    label: 'Bus stops',
    category: 'transportation',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Bus stops and queue shelters, flagged for passenger information display.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 82,
    source: { protocol: 'arcgis', service: 'UpdatedBusStops', serviceType: 'FeatureServer', sublayers: [3] },
    style: { color: PALETTE.transit, weight: 1, fillColor: PALETTE.transit, fillOpacity: 0.75, pointRadius: 3 },
    popupFields: [
      { field: 'Name', label: 'Stop' },
      { field: 'Describe', label: 'Type' },
      { field: 'PIS', label: 'Passenger information' },
    ],
    searchField: 'Name',
  },
  {
    id: 'bus-terminals',
    label: 'Bus terminals & depots',
    category: 'transportation',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Mo Bus originating/destination terminals.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 84,
    source: { protocol: 'arcgis', service: 'UpdatedBusStops', serviceType: 'FeatureServer', sublayers: [1] },
    style: { color: PALETTE.transit, weight: 1.4, fillColor: PALETTE.transit, fillOpacity: 0.9, pointRadius: 5 },
    popupFields: [{ field: 'Name', label: 'Terminal' }],
    searchField: 'Name',
  },
  {
    id: 'traffic-junctions',
    label: 'Traffic junctions',
    category: 'transportation',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 50 surveyed traffic junctions used as the city’s reference intersection set.',
    caveat:
      'Junction locations only. Signal state, queue length and flow are not part of this layer — those come from ARKA live data.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 86,
    source: { protocol: 'arcgis', service: 'TrafficJunctions', serviceType: 'MapServer', sublayers: [0] },
    style: { color: PALETTE.accent, weight: 1.2, fillColor: PALETTE.accent, fillOpacity: 0.7, pointRadius: 4 },
    popupFields: [{ field: 'Name', label: 'Junction' }],
    searchField: 'Name',
  },

  // --- Water & environment ------------------------------------------------
  {
    id: 'green-spaces',
    label: 'Green spaces',
    category: 'environment',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Parks, plantations and vegetated open space (11,549 parcels).',
    defaultVisible: false,
    defaultOpacity: 0.5,
    order: 28,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [15] },
  },
  {
    id: 'river',
    label: 'Rivers & channels',
    category: 'environment',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'River and natural drainage channel network.',
    defaultVisible: true,
    defaultOpacity: 0.8,
    order: 30,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [13] },
  },
  {
    id: 'waterbody',
    label: 'Water bodies',
    category: 'environment',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Tanks, ponds and lakes within the BDA area.',
    defaultVisible: true,
    defaultOpacity: 0.8,
    order: 32,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [14] },
  },

  // --- Civic infrastructure -----------------------------------------------
  {
    id: 'water-pipeline',
    label: 'Water supply pipelines',
    category: 'infrastructure',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Distribution pipeline network (4,102 segments).',
    defaultVisible: false,
    defaultOpacity: 0.8,
    order: 50,
    source: {
      protocol: 'arcgis',
      service: 'WaterSupplyInfrastructure',
      serviceType: 'MapServer',
      sublayers: [6],
    },
  },
  {
    id: 'sewerage-network',
    label: 'Sewerage network',
    category: 'infrastructure',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Sewer mains, manholes, pumping stations and treatment plants.',
    defaultVisible: false,
    defaultOpacity: 0.8,
    order: 51,
    source: {
      protocol: 'arcgis',
      service: 'SewerageInfrastructure',
      serviceType: 'MapServer',
      sublayers: [0],
    },
  },
  {
    id: 'hi-tension-line',
    label: 'High-tension power lines',
    category: 'infrastructure',
    kind: 'vector',
    dataClass: 'reference',
    description: 'High-tension transmission line alignments.',
    caveat: 'Line routes only. Load, outage and switching state are not part of this layer.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 60,
    source: {
      protocol: 'arcgis',
      service: 'ElectricInfrastructure',
      serviceType: 'MapServer',
      sublayers: [3],
    },
    style: { color: PALETTE.power, weight: 1.6, dashArray: '4 3' },
    popupFields: [{ field: 'category', label: 'Asset class' }],
  },
  {
    id: 'water-supply-assets',
    label: 'Water supply assets',
    category: 'infrastructure',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Reservoirs, treatment plants, pump houses and production wells.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 88,
    source: {
      protocol: 'arcgis',
      service: 'WaterSupplyInfrastructure',
      serviceType: 'MapServer',
      sublayers: [1, 2, 3, 4],
    },
  },
  {
    id: 'electric-assets',
    label: 'Substations & division offices',
    category: 'infrastructure',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Grid substations and distribution division offices.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 89,
    source: {
      protocol: 'arcgis',
      service: 'ElectricInfrastructure',
      serviceType: 'MapServer',
      sublayers: [1, 2],
    },
  },
  {
    id: 'cctv-sites',
    label: 'CCTV camera sites',
    category: 'infrastructure',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 48 published smart-city camera installation sites.',
    caveat:
      'Installation inventory, not a video feed. Mount points and pole configuration only — no stream, no detections, no status.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 90,
    source: { protocol: 'arcgis', service: 'SmartElements', serviceType: 'FeatureServer', sublayers: [10] },
    style: { color: PALETTE.civic, weight: 1.2, fillColor: PALETTE.civic, fillOpacity: 0.7, pointRadius: 4 },
    popupFields: [
      { field: 'name', label: 'Site' },
      { field: 'descriptio', label: 'Installation detail' },
    ],
    searchField: 'name',
  },
  {
    id: 'atcc-sites',
    label: 'Traffic counter sites (ATCC)',
    category: 'infrastructure',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 32 automatic traffic counter and classifier installation sites.',
    caveat: 'Installation inventory. Counts and classifications are not exposed by this layer.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 91,
    source: { protocol: 'arcgis', service: 'SmartElements', serviceType: 'FeatureServer', sublayers: [12] },
    style: { color: PALETTE.civic, weight: 1.2, fillColor: PALETTE.civic, fillOpacity: 0.5, pointRadius: 3.5 },
    popupFields: [
      { field: 'name', label: 'Site' },
      { field: 'snippet', label: 'Note' },
    ],
    searchField: 'name',
  },

  // --- Points of interest -------------------------------------------------
  {
    id: 'public-amenities',
    label: 'Public amenities',
    category: 'poi',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Water ATMs, ATMs, playgrounds, parks, malls, Wi-Fi points, toilets and services.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 78,
    source: { protocol: 'arcgis', service: 'PublicAmenities', serviceType: 'MapServer', sublayers: [0] },
  },
  {
    id: 'public-toilets',
    label: 'Public toilets',
    category: 'poi',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Geo-tagged public toilets with seat count, accessibility and operator.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 80,
    source: { protocol: 'arcgis', service: 'SmartElements', serviceType: 'FeatureServer', sublayers: [4] },
    style: { color: PALETTE.ink, weight: 1, fillColor: PALETTE.ink, fillOpacity: 0.5, pointRadius: 3 },
    popupFields: [
      { field: 'name_of_to', label: 'Facility' },
      { field: 'address', label: 'Address' },
      { field: 'type_of_to', label: 'Type' },
      { field: 'category', label: 'Category' },
      { field: 'seats', label: 'Seats', format: 'integer' },
      { field: 'ward_no', label: 'Ward', format: 'integer' },
      { field: 'name_of_ma', label: 'Maintained by' },
    ],
    searchField: 'name_of_to',
  },
  {
    id: 'hospitals-poi',
    label: 'Hospitals (city directory)',
    category: 'poi',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 27 hospitals in the city directory, with specialities and emergency contact.',
    caveat:
      'Facility directory, not capacity. Bed availability and casualty routing come from ARKA live data, not from this layer.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 93,
    source: { protocol: 'arcgis', service: 'Category', serviceType: 'FeatureServer', sublayers: [37] },
    style: { color: '#7fa8c4', weight: 1.2, fillColor: '#7fa8c4', fillOpacity: 0.7, pointRadius: 4 },
    popupFields: [
      { field: 'name', label: 'Hospital' },
      { field: 'category', label: 'Ownership' },
      { field: 'care_type', label: 'Care type' },
      { field: 'system_of_', label: 'System of medicine' },
      { field: 'address', label: 'Address' },
      { field: 'contact_nu', label: 'Contact' },
      { field: 'specialiti', label: 'Specialities' },
    ],
    searchField: 'name',
  },
  {
    id: 'fire-stations-poi',
    label: 'Fire stations (city directory)',
    category: 'poi',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Odisha Fire Service stations serving the city, with station reference and type.',
    caveat: 'Station directory. Appliance availability and turnout state are not part of this layer.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 94,
    source: { protocol: 'arcgis', service: 'Category', serviceType: 'FeatureServer', sublayers: [7] },
    style: { color: '#c48a6a', weight: 1.2, fillColor: '#c48a6a', fillOpacity: 0.7, pointRadius: 4 },
    popupFields: [
      { field: 'name', label: 'Station' },
      { field: 'fstype', label: 'Station type' },
      { field: 'fsrefno', label: 'Reference' },
      { field: 'district_n', label: 'District' },
    ],
    searchField: 'name',
  },
  {
    id: 'police-stations-poi',
    label: 'Police stations (city directory)',
    category: 'poi',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 17 police stations with jurisdiction, sub-commissionerate and station contact.',
    caveat: 'Station directory. Patrol positions and dispatch state come from ARKA live data.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 95,
    source: { protocol: 'arcgis', service: 'Category', serviceType: 'FeatureServer', sublayers: [12] },
    style: { color: '#8fa5c4', weight: 1.2, fillColor: '#8fa5c4', fillOpacity: 0.7, pointRadius: 4 },
    popupFields: [
      { field: 'label', label: 'Station' },
      { field: 'location', label: 'Location' },
      { field: 'sub_comm', label: 'Sub-commissionerate' },
      { field: 'address', label: 'Address' },
      { field: 'phoneno', label: 'Phone' },
      { field: 'in_charge', label: 'Officer in charge' },
      { field: 'out_post', label: 'Out posts' },
    ],
    // `xi`/`yi` on this layer hold latitude/longitude the wrong way round.
    // ARKA never reads them; geometry comes from the service.
    searchField: 'label',
  },
];

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Failure carrying whatever the provider actually said, for verbatim display. */
export class GISRequestError extends Error {
  readonly url: string;
  readonly providerCode: number | null;

  constructor(message: string, url: string, providerCode: number | null = null) {
    super(message);
    this.name = 'GISRequestError';
    this.url = url;
    this.providerCode = providerCode;
  }
}

/** ArcGIS reports failures as HTTP 200 with an `error` body. */
interface ArcGISErrorBody {
  error?: { code?: number; message?: string; details?: string[] };
}

/** Escape a single-quoted SQL literal for an ArcGIS `where` clause. */
function escapeSqlLiteral(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Combine an external abort signal with a timeout, without relying on
 * `AbortSignal.any` (not available across all target browsers).
 */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Request timed out after ${ms} ms`)), ms);

  const forward = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) forward();
    else signal.addEventListener('abort', forward, { once: true });
  }

  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      if (signal) signal.removeEventListener('abort', forward);
    },
  };
}

/** Best-effort representative point for a feature, used by search results. */
function featureCentroid(geometry: unknown): { lat: number; lng: number } | null {
  let minLng = Infinity;
  let minLat = Infinity;
  let maxLng = -Infinity;
  let maxLat = -Infinity;
  let found = false;

  const visit = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    // A coordinate pair: [lng, lat, ...optional z/m].
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const lng = node[0];
      const lat = node[1];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      found = true;
      if (lng < minLng) minLng = lng;
      if (lat < minLat) minLat = lat;
      if (lng > maxLng) maxLng = lng;
      if (lat > maxLat) maxLat = lat;
      return;
    }
    for (const child of node) visit(child);
  };

  const coords = (geometry as { coordinates?: unknown } | null)?.coordinates;
  visit(coords);

  if (!found) return null;
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 };
}

/** Sanity bound for WGS84 output, so a projection mistake cannot reach the map. */
function isPlausibleLngLat(lng: number, lat: number): boolean {
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export class BhubaneswarGISService implements CityGISProvider {
  readonly id = 'bhubaneswarone';
  readonly cityName = 'Bhubaneswar';
  readonly attribution = ATTRIBUTION;
  readonly portalUrl = PORTAL_URL;
  readonly home = HOME_VIEW;

  private readonly layers = new Map<string, GISLayerDef>();
  private readonly descriptionCache = new Map<string, { value: GISLayerDescription; expiresAt: number }>();
  /** De-duplicates concurrent metadata reads for the same layer. */
  private readonly describeInFlight = new Map<string, Promise<GISLayerDescription>>();

  constructor(catalogue: GISLayerDef[] = LAYER_CATALOGUE) {
    for (const layer of catalogue) {
      if (this.layers.has(layer.id)) {
        throw new Error(`Duplicate GIS layer id in catalogue: ${layer.id}`);
      }
      this.layers.set(layer.id, layer);
    }
  }

  // --- Catalogue --------------------------------------------------------

  listLayers(): GISLayerDef[] {
    return [...this.layers.values()].sort((a, b) => a.order - b.order);
  }

  getLayer(layerId: string): GISLayerDef | undefined {
    return this.layers.get(layerId);
  }

  /** Layers that can answer a name search. */
  listSearchableLayers(): GISLayerDef[] {
    return this.listLayers().filter((l) => l.kind === 'vector' && !!l.searchField);
  }

  // --- Request plumbing -------------------------------------------------

  /**
   * Build a service URL. Refuses any operation outside `READ_ONLY_OPERATIONS`,
   * which is the structural guarantee that ARKA cannot issue an edit against
   * this deployment's unauthenticated FeatureServers.
   */
  private buildUrl(
    service: string,
    serviceType: 'MapServer' | 'FeatureServer',
    sublayer: number | null,
    operation: string,
    params: Record<string, string | number | boolean | undefined>,
  ): string {
    if (!(READ_ONLY_OPERATIONS as readonly string[]).includes(operation)) {
      throw new Error(`Refusing non-read GIS operation "${operation}" — ARKA is read-only against city GIS.`);
    }

    const segments = [SERVICE_ROOT, service, serviceType];
    if (sublayer !== null) segments.push(String(sublayer));
    if (operation) segments.push(operation);

    const search = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined) search.set(key, String(value));
    }

    return `${segments.join('/')}?${search.toString()}`;
  }

  /**
   * Fetch and parse JSON, translating both transport failures and ArcGIS's
   * HTTP-200-with-error-body convention into a single `GISRequestError`.
   */
  private async fetchJson<T>(url: string, signal: AbortSignal | undefined): Promise<T> {
    const { signal: composed, done } = withTimeout(signal, REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: composed, credentials: 'omit', mode: 'cors' });
    } catch (cause) {
      done();
      if (signal?.aborted) throw cause;
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new GISRequestError(`City GIS unreachable: ${reason}`, url);
    }

    try {
      if (!response.ok) {
        throw new GISRequestError(`City GIS returned HTTP ${response.status} ${response.statusText}`, url);
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new GISRequestError('City GIS returned a response that was not valid JSON.', url);
      }

      const asError = body as ArcGISErrorBody;
      if (asError?.error) {
        const detail = asError.error.details?.filter(Boolean).join('; ');
        const message = asError.error.message || 'Unspecified service error';
        throw new GISRequestError(detail ? `${message} (${detail})` : message, url, asError.error.code ?? null);
      }

      return body as T;
    } finally {
      done();
    }
  }

  /** Resolve a layer or fail with a message worth showing. */
  private requireLayer(layerId: string): GISLayerDef {
    const layer = this.layers.get(layerId);
    if (!layer) throw new GISRequestError(`Unknown GIS layer "${layerId}".`, '');
    return layer;
  }

  /** Narrow to the ArcGIS source shape, which is the only one implemented. */
  private requireArcGISSource(layer: GISLayerDef): {
    service: string;
    serviceType: 'MapServer' | 'FeatureServer';
    sublayers: number[];
  } {
    if (layer.source.protocol !== 'arcgis') {
      throw new GISRequestError(
        `Layer "${layer.id}" uses the ${layer.source.protocol} protocol, which this provider does not serve.`,
        '',
      );
    }
    return layer.source;
  }

  // --- Metadata ---------------------------------------------------------

  async describeLayer(layerId: string): Promise<GISLayerDescription> {
    const cached = this.descriptionCache.get(layerId);
    if (cached && cached.expiresAt > Date.now()) return cached.value;

    const pending = this.describeInFlight.get(layerId);
    if (pending) return pending;

    const request = this.loadDescription(layerId)
      .then((value) => {
        this.descriptionCache.set(layerId, { value, expiresAt: Date.now() + METADATA_TTL_MS });
        return value;
      })
      .finally(() => {
        this.describeInFlight.delete(layerId);
      });

    this.describeInFlight.set(layerId, request);
    return request;
  }

  private async loadDescription(layerId: string): Promise<GISLayerDescription> {
    const layer = this.requireLayer(layerId);
    const { service, serviceType, sublayers } = this.requireArcGISSource(layer);

    // A single-sublayer vector layer can describe itself; a group or
    // multi-sublayer raster layer has to be described from the service root.
    const isSingle = layer.kind === 'vector' && sublayers.length === 1;
    const url = this.buildUrl(service, serviceType, isSingle ? sublayers[0] : null, '', { f: 'json' });

    const raw = await this.fetchJson<{
      name?: string;
      copyrightText?: string;
      geometryType?: string;
      maxRecordCount?: number;
      layers?: { id: number; name: string }[];
      extent?: { xmin: number; ymin: number; xmax: number; ymax: number };
      fullExtent?: { xmin: number; ymin: number; xmax: number; ymax: number };
    }>(url, undefined);

    const selected = new Set(sublayers);
    const sublayerNames = isSingle
      ? raw.name
        ? [raw.name.trim()]
        : []
      : (raw.layers ?? [])
          .filter((l) => selected.has(l.id))
          .map((l) => l.name.trim())
          .filter(Boolean);

    const box = raw.extent ?? raw.fullExtent ?? null;

    return {
      layerId,
      providerName: raw.name?.trim() || null,
      // Every service on this deployment ships an empty copyright string; keep
      // null rather than an empty string so the UI falls back to `attribution`.
      copyrightText: raw.copyrightText?.trim() || null,
      geometryType: raw.geometryType ?? null,
      maxRecordCount: raw.maxRecordCount ?? null,
      sublayerNames,
      extent: box ? this.webMercatorExtentToWgs84(box) : null,
      fetchedAt: new Date().toISOString(),
    };
  }

  /**
   * Extents come back in Web Mercator (wkid 102100). Convert so callers can
   * hand the value straight to a Leaflet `fitBounds`.
   */
  private webMercatorExtentToWgs84(box: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  }): [number, number, number, number] | null {
    const toLng = (x: number) => (x / WEB_MERCATOR_EXTENT) * 180;
    const toLat = (y: number) => {
      const lat = (y / WEB_MERCATOR_EXTENT) * 180;
      return (180 / Math.PI) * (2 * Math.atan(Math.exp((lat * Math.PI) / 180)) - Math.PI / 2);
    };

    const west = toLng(box.xmin);
    const south = toLat(box.ymin);
    const east = toLng(box.xmax);
    const north = toLat(box.ymax);

    // Some sublayers publish a NaN extent (a projection defined in a local grid
    // the service cannot reproject). Report null rather than a broken box.
    if (![west, south, east, north].every(Number.isFinite)) return null;
    if (!isPlausibleLngLat(west, south) || !isPlausibleLngLat(east, north)) return null;

    return [west, south, east, north];
  }

  // --- Vector data ------------------------------------------------------

  async queryFeatures(layerId: string, options: GISQueryOptions = {}): Promise<GISFeatureResult> {
    const layer = this.requireLayer(layerId);
    if (layer.kind !== 'vector') {
      throw new GISRequestError(
        `Layer "${layer.id}" is a ${layer.kind} layer and is drawn as an image, not queried for features.`,
        '',
      );
    }

    const { service, serviceType, sublayers } = this.requireArcGISSource(layer);
    if (sublayers.length !== 1) {
      throw new GISRequestError(`Vector layer "${layer.id}" must reference exactly one sublayer.`, '');
    }

    const cap = Math.min(options.maxFeatures ?? DEFAULT_MAX_RECORDS, DEFAULT_MAX_RECORDS);

    const url = this.buildUrl(service, serviceType, sublayers[0], 'query', {
      where: '1=1',
      outFields: this.outFieldsFor(layer),
      returnGeometry: true,
      outSR: 4326,
      resultRecordCount: cap,
      f: 'geojson',
      ...this.spatialParams(options.bounds),
    });

    const raw = await this.fetchJson<GeoJSON.FeatureCollection>(url, options.signal);
    return this.toFeatureResult(raw, cap, url);
  }

  /**
   * Ask only for the fields ARKA will show. Cuts payload substantially on
   * layers with 40+ attributes, and keeps unused personal-contact columns out
   * of the browser entirely.
   */
  private outFieldsFor(layer: GISLayerDef): string {
    const fields = new Set<string>();
    for (const f of layer.popupFields ?? []) fields.add(f.field);
    if (layer.searchField) fields.add(layer.searchField);
    return fields.size ? [...fields].join(',') : '*';
  }

  /** Envelope filter, so a city-wide layer only ships what the viewport needs. */
  private spatialParams(bounds?: GISBounds): Record<string, string> {
    if (!bounds) return {};
    return {
      geometry: JSON.stringify({
        xmin: bounds.west,
        ymin: bounds.south,
        xmax: bounds.east,
        ymax: bounds.north,
        spatialReference: { wkid: 4326 },
      }),
      geometryType: 'esriGeometryEnvelope',
      inSR: '4326',
      spatialRel: 'esriSpatialRelIntersects',
    };
  }

  /**
   * Validate the payload and decide whether it was capped.
   *
   * This deployment does not set `exceededTransferLimit` on GeoJSON responses
   * (verified: a 1,000-feature response carries no flag), so hitting the cap
   * exactly is the only available signal. The UI reports that as "showing a
   * subset" rather than pretending the layer is complete.
   */
  private toFeatureResult(raw: unknown, cap: number, url: string): GISFeatureResult {
    const collection = raw as GeoJSON.FeatureCollection & { properties?: { exceededTransferLimit?: boolean } };

    if (!collection || collection.type !== 'FeatureCollection' || !Array.isArray(collection.features)) {
      throw new GISRequestError('City GIS returned a payload that was not a GeoJSON FeatureCollection.', url);
    }

    const features = collection.features.filter((f) => f && f.geometry);
    const count = features.length;

    return {
      featureCollection: { type: 'FeatureCollection', features },
      count,
      truncated: collection.properties?.exceededTransferLimit === true || count >= cap,
      fetchedAt: new Date().toISOString(),
    };
  }

  // --- Raster data ------------------------------------------------------

  /**
   * Raster layers are served through dynamic `export` rather than the tile
   * cache. The caches on this deployment are single-fused — they render the
   * whole service and cannot isolate a sublayer — so tiles would collapse every
   * category into one image. `export?layers=show:N` keeps each category
   * independently controllable, and works on cached and dynamic services alike.
   */
  rasterTemplate(layerId: string): GISRasterTemplate | null {
    const layer = this.requireLayer(layerId);
    if (layer.kind === 'vector') return null;

    if (layer.source.protocol === 'xyz') {
      return {
        kind: 'raster-tiled',
        tileUrl: layer.source.urlTemplate,
        maxZoom: layer.source.maxZoom ?? 19,
        attribution: ATTRIBUTION,
      };
    }

    const { service, serviceType, sublayers } = this.requireArcGISSource(layer);

    return {
      kind: 'raster-dynamic',
      exportUrl: (bbox, widthPx, heightPx) =>
        this.buildUrl(service, serviceType, null, 'export', {
          bbox: bbox.join(','),
          bboxSR: 102100,
          imageSR: 102100,
          size: `${widthPx},${heightPx}`,
          format: 'png32',
          transparent: true,
          dpi: 96,
          layers: `show:${sublayers.join(',')}`,
          f: 'image',
        }),
      maxZoom: 19,
      attribution: ATTRIBUTION,
    };
  }

  // --- Search -----------------------------------------------------------

  /**
   * Name search across searchable vector layers. Each layer is queried
   * independently and a failure on one does not sink the others — a partial
   * result list is more useful to an operator than an error.
   */
  async searchFeatures(
    term: string,
    options: { signal?: AbortSignal; limit?: number } = {},
  ): Promise<GISSearchHit[]> {
    const needle = term.trim();
    if (needle.length < 2) return [];

    const limit = options.limit ?? 20;
    const perLayer = Math.max(3, Math.ceil(limit / 2));
    const searchable = this.listSearchableLayers();

    const batches = await Promise.all(
      searchable.map((layer) => this.searchOneLayer(layer, needle, perLayer, options.signal)),
    );

    const hits = batches.flat();

    // Prefix matches first: an operator typing "W25" or "Patia" means the thing
    // that starts that way.
    const lowered = needle.toLowerCase();
    hits.sort((a, b) => {
      const aStarts = a.label.toLowerCase().startsWith(lowered) ? 0 : 1;
      const bStarts = b.label.toLowerCase().startsWith(lowered) ? 0 : 1;
      if (aStarts !== bStarts) return aStarts - bStarts;
      return a.label.localeCompare(b.label);
    });

    return hits.slice(0, limit);
  }

  private async searchOneLayer(
    layer: GISLayerDef,
    needle: string,
    limit: number,
    signal: AbortSignal | undefined,
  ): Promise<GISSearchHit[]> {
    const field = layer.searchField;
    if (!field) return [];

    const { service, serviceType, sublayers } = this.requireArcGISSource(layer);
    const where = `UPPER(${field}) LIKE '%${escapeSqlLiteral(needle.toUpperCase())}%'`;

    const url = this.buildUrl(service, serviceType, sublayers[0], 'query', {
      where,
      outFields: this.outFieldsFor(layer),
      returnGeometry: true,
      outSR: 4326,
      resultRecordCount: limit,
      f: 'geojson',
    });

    let collection: GeoJSON.FeatureCollection;
    try {
      collection = await this.fetchJson<GeoJSON.FeatureCollection>(url, signal);
    } catch (cause) {
      if (signal?.aborted) throw cause;
      // One unhealthy layer must not blank the whole result list.
      return [];
    }

    if (!Array.isArray(collection?.features)) return [];

    const hits: GISSearchHit[] = [];
    for (const feature of collection.features) {
      const properties = (feature.properties ?? {}) as Record<string, unknown>;
      const rawLabel = properties[field];
      const label = typeof rawLabel === 'string' ? rawLabel.trim() : String(rawLabel ?? '').trim();
      if (!label) continue;

      const centre = featureCentroid(feature.geometry);
      if (!centre || !isPlausibleLngLat(centre.lng, centre.lat)) continue;

      hits.push({
        layerId: layer.id,
        layerLabel: layer.label,
        label,
        lat: centre.lat,
        lng: centre.lng,
        properties,
      });
    }

    return hits;
  }
}

/** Shared instance. ARKA runs one city provider at a time. */
export const bhubaneswarGIS = new BhubaneswarGISService();

/** Exported for tests and for a future provider registry. */
export { LAYER_CATALOGUE as BHUBANESWAR_LAYER_CATALOGUE, SERVICE_ROOT as BHUBANESWAR_SERVICE_ROOT };
