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
  GISAttributeRow,
  GISBounds,
  GISFeatureResult,
  GISLayerDef,
  GISLayerDescription,
  GISQueryableLayer,
  GISQueryOptions,
  GISQueryResult,
  GISRasterTemplate,
  GISSearchHit,
  GISWardRecord,
  GISWardTotals,
} from './types';
import { BOUNDARY_DASH, PALETTE } from './palette';
import { describeAttributes, featureLabel } from './formatAttributes';
import { BOUNDARY_LAYERS, WARD_DATASET, WARD_FIELDS } from './catalogue/boundaries';
import { THEMATIC_LAYERS } from './catalogue/thematic';

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
 * Catalogue id of the ward layer the ward-intelligence module reads.
 *
 * Named once so the module's availability check and the published layer can
 * never disagree: if this layer is dropped from the catalogue, `hasWardDataset`
 * turns false and the module reports itself unavailable instead of querying a
 * service nothing declares.
 */
const WARD_LAYER_ID = 'bmc-wards';

/**
 * Read operations ARKA is permitted to issue. `fetchJson` refuses anything
 * else, which is what keeps an editing verb from ever reaching an
 * unauthenticated FeatureServer — including by accident, via a future caller
 * that builds its own path.
 */
const READ_ONLY_OPERATIONS = ['query', 'export', 'legend', 'identify', ''] as const;

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
  {
    path: 'AirportBoundary/MapServer/0',
    reason: 'Returns a feature count of 0. The airport area is published instead from CityMap/5.',
  },
  {
    path: 'Category/FeatureServer/9 (General Post Office)',
    reason: 'Returns a feature count of 0. Branch and sub post offices (10, 11) carry the published records.',
  },
  {
    path: 'Category/FeatureServer/31 (District Headquarters Hospital)',
    reason: 'Returns a feature count of 0. Hospitals are published from Category/37.',
  },
  {
    path: 'Category/FeatureServer/40 (Anganwadi Centre)',
    reason: 'Exact duplicate of Category/24 — same 355 records and same schema. Published once, from 24.',
  },
  {
    path: 'VillagePlotBoundary/MapServer/2 (Village Boundary)',
    reason: 'Same 205 village records already published as `village-mouza` from CityMap/1.',
  },
  {
    path: 'BMC_WardBoundary/FeatureServer/0',
    reason:
      'Holds only 58 of the city’s 67 wards (W9, W11, W16, W17, W21, W24, W26, W30 and W35 are absent) with the same schema as AdministrativeBoundary/4. Building ward intelligence on it would report nine real wards as having no data, so the complete dataset is used instead.',
  },
  {
    path: 'Ward/MapServer/0',
    reason:
      'Carries all 67 wards but with join artefacts from an unrelated analysis (covidcases, p_sex, wardno_1, fid_1). AdministrativeBoundary/4 publishes the same wards with a clean schema.',
  },
];

// ---------------------------------------------------------------------------
// Layer catalogue
// ---------------------------------------------------------------------------

/**
 * The verified core catalogue: boundaries already in place, transport, water and
 * environment, utility networks, smart-city assets and citywide amenities. The
 * newer boundary and thematic groups live in `./catalogue/*` and are appended in
 * `FULL_CATALOGUE` below; the split is purely for readability.
 *
 * `kind` follows from what the service can actually do:
 *
 *  - `vector` where the feature count is small enough to fetch as GeoJSON, so
 *    ARKA can style it for a dark canvas and make it clickable.
 *  - `raster-dynamic` where the layer is a group, has thousands of features, or
 *    is only meaningful as cartography. Dynamic export is used rather than the
 *    tile cache because a fused cache renders the whole service and cannot
 *    isolate a sublayer — and the requirement is that every category stays
 *    independently controllable.
 *
 * `order` sorts within the base-GIS panes: area fills lowest, then lines, then
 * points, so a ward fill never hides a hospital marker.
 */
const CORE_LAYERS: GISLayerDef[] = [
  // --- Planning -----------------------------------------------------------
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
    category: 'statutory-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Statutory boundary of the Bhubaneswar Urban Transport Area.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 13,
    source: { protocol: 'arcgis', service: 'UrbanTransport', serviceType: 'MapServer', sublayers: [1] },
    style: {
      color: PALETTE.transit,
      weight: 1.5,
      fillColor: PALETTE.transit,
      fillOpacity: 0.04,
      dashArray: BOUNDARY_DASH.statutory,
    },
    popupFields: [{ field: 'vill_name', label: 'Area' }],
    searchField: 'vill_name',
  },
  {
    id: 'bda-boundary',
    label: 'BDA boundary',
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Outer limit of the Bhubaneswar Development Authority area.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 15,
    verifiedFeatureCount: 1,
    source: { protocol: 'arcgis', service: 'Boundary', serviceType: 'MapServer', sublayers: [2] },
    style: { color: PALETTE.line, weight: 1.5, fillOpacity: 0, dashArray: BOUNDARY_DASH.authority },
    popupFields: [{ field: 'name', label: 'Authority' }],
    searchField: 'name',
  },
  {
    id: 'village-mouza',
    label: 'Village / mouza boundaries',
    category: 'statutory-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    // Published with a fully transparent symbol, so the server-rendered image is
    // blank. Fetched as GeoJSON and styled by ARKA instead.
    description: 'Revenue village (mouza) boundaries across the BDA area, with tahsil and police station.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 16,
    verifiedFeatureCount: 205,
    source: { protocol: 'arcgis', service: 'CityMap', serviceType: 'MapServer', sublayers: [1] },
    style: { color: PALETTE.line, weight: 0.6, fillOpacity: 0, dashArray: BOUNDARY_DASH.revenue },
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
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'BDA planning zones with their broad development classification.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 18,
    verifiedFeatureCount: 14,
    source: { protocol: 'arcgis', service: 'BMCBDAZONEPLAN', serviceType: 'MapServer', sublayers: [1] },
    style: {
      color: PALETTE.accentDim,
      weight: 1,
      fillColor: PALETTE.accent,
      fillOpacity: 0.05,
      dashArray: BOUNDARY_DASH.zone,
    },
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
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Bhubaneswar Municipal Corporation municipal limit.',
    defaultVisible: true,
    defaultOpacity: 1,
    order: 20,
    verifiedFeatureCount: 1,
    source: { protocol: 'arcgis', service: 'Boundary', serviceType: 'MapServer', sublayers: [1] },
    style: { color: PALETTE.accent, weight: 2, fillOpacity: 0, dashArray: BOUNDARY_DASH.municipal },
    popupFields: [{ field: 'Name', label: 'Area' }],
    searchField: 'Name',
  },
  {
    id: 'bmc-zones',
    label: 'BMC municipal zones',
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'BMC administrative zones used for municipal service delivery.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 22,
    verifiedFeatureCount: 3,
    source: { protocol: 'arcgis', service: 'BMCBDAZONEPLAN', serviceType: 'MapServer', sublayers: [0] },
    style: {
      color: PALETTE.accent,
      weight: 1.4,
      fillColor: PALETTE.accent,
      fillOpacity: 0.04,
      dashArray: BOUNDARY_DASH.zone,
    },
    popupFields: [{ field: 'municipalz', label: 'Zone' }],
    searchField: 'municipalz',
  },
  {
    id: 'smart-city-abd',
    label: 'Smart City area-based development',
    category: 'smart-city',
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
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'All 67 municipal wards with councillor, household count, population and zone.',
    defaultVisible: true,
    defaultOpacity: 0.9,
    order: 25,
    verifiedFeatureCount: WARD_DATASET.wardCount,
    source: {
      protocol: 'arcgis',
      service: WARD_DATASET.service,
      serviceType: WARD_DATASET.serviceType,
      sublayers: [WARD_DATASET.sublayer],
    },
    style: {
      color: PALETTE.accentDim,
      weight: 0.9,
      fillColor: PALETTE.accent,
      fillOpacity: 0.03,
      dashArray: BOUNDARY_DASH.ward,
    },
    popupFields: [
      { field: WARD_FIELDS.wardNo, label: 'Ward' },
      { field: WARD_FIELDS.zone, label: 'Municipal zone' },
      { field: WARD_FIELDS.councillor, label: 'Councillor' },
      { field: WARD_FIELDS.households, label: 'Households', format: 'integer', suppressZero: true },
      { field: WARD_FIELDS.population, label: 'Ward population', format: 'integer', suppressZero: true },
      { field: WARD_FIELDS.areaHectares, label: 'Area', format: 'area-hectares', suppressZero: true },
    ],
    searchField: WARD_FIELDS.wardNo,
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
    category: 'parking',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Surveyed on-street and off-street parking footprints.',
    caveat: 'Site extents only. This layer carries no occupancy or availability data.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 35,
    facilityKind: 'parking',
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
    facilityKind: 'transport',
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
    verifiedFeatureCount: 50,
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

  // --- Utility networks ---------------------------------------------------
  {
    id: 'water-pipeline',
    label: 'Water supply pipelines',
    category: 'utility',
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
    category: 'utility',
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
    category: 'utility',
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
    category: 'utility',
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
    category: 'utility',
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
  // --- Smart city assets --------------------------------------------------
  {
    id: 'cctv-sites',
    label: 'CCTV camera sites',
    category: 'smart-city',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 48 published smart-city camera installation sites.',
    caveat:
      'Installation inventory, not a video feed. Mount points and pole configuration only — no stream, no detections, no status.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 90,
    verifiedFeatureCount: 48,
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
    category: 'smart-city',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 32 automatic traffic counter and classifier installation sites.',
    caveat: 'Installation inventory. Counts and classifications are not exposed by this layer.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 91,
    verifiedFeatureCount: 32,
    source: { protocol: 'arcgis', service: 'SmartElements', serviceType: 'FeatureServer', sublayers: [12] },
    style: { color: PALETTE.civic, weight: 1.2, fillColor: PALETTE.civic, fillOpacity: 0.5, pointRadius: 3.5 },
    popupFields: [
      { field: 'name', label: 'Site' },
      { field: 'snippet', label: 'Note' },
    ],
    searchField: 'name',
  },

  // --- Community services -------------------------------------------------
  // Fire and police stations are filed here rather than under a bespoke
  // "emergency" group because that is where the city's own catalogue files them.
  {
    id: 'public-amenities',
    label: 'Public amenities',
    category: 'community-services',
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
    category: 'community-services',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Geo-tagged public toilets with seat count, accessibility and operator.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 80,
    facilityKind: 'toilet',
    source: { protocol: 'arcgis', service: 'SmartElements', serviceType: 'FeatureServer', sublayers: [4] },
    style: { color: PALETTE.ink, weight: 1, fillColor: PALETTE.ink, fillOpacity: 0.5, pointRadius: 3 },
    popupFields: [
      { field: 'name_of_to', label: 'Facility' },
      { field: 'address', label: 'Address' },
      { field: 'type_of_to', label: 'Type' },
      { field: 'category', label: 'Category' },
      { field: 'seats', label: 'Seats', format: 'integer', suppressZero: true },
      { field: 'ward_no', label: 'Ward', format: 'integer', suppressZero: true },
      { field: 'name_of_ma', label: 'Maintained by' },
    ],
    searchField: 'name_of_to',
  },
  {
    id: 'hospitals-poi',
    label: 'Hospitals (city directory)',
    category: 'health',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 27 hospitals in the city directory, with specialities and contact.',
    caveat:
      'Facility directory, not capacity. The source publishes its bed-count, emergency and ambulance columns as empty, so they are not shown. Bed availability and casualty routing come from ARKA live data, not from this layer.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 93,
    verifiedFeatureCount: 27,
    facilityKind: 'hospital',
    source: { protocol: 'arcgis', service: 'Category', serviceType: 'FeatureServer', sublayers: [37] },
    style: { color: PALETTE.health, weight: 1.2, fillColor: PALETTE.health, fillOpacity: 0.7, pointRadius: 4 },
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
    category: 'community-services',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Odisha Fire Service stations serving the city, with station reference and type.',
    caveat: 'Station directory. Appliance availability and turnout state are not part of this layer.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 94,
    verifiedFeatureCount: 5,
    facilityKind: 'fire',
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
    category: 'community-services',
    kind: 'vector',
    dataClass: 'reference',
    description: 'The 17 police stations with jurisdiction, sub-commissionerate and station contact.',
    caveat: 'Station directory. Patrol positions and dispatch state come from ARKA live data.',
    defaultVisible: false,
    defaultOpacity: 0.95,
    order: 95,
    verifiedFeatureCount: 17,
    facilityKind: 'police',
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

/**
 * The full published catalogue: core layers, plus the boundary and thematic
 * groups. Assembled here rather than in one giant literal so each group can be
 * reviewed — and re-verified against the source — on its own.
 */
const LAYER_CATALOGUE: GISLayerDef[] = [...CORE_LAYERS, ...BOUNDARY_LAYERS, ...THEMATIC_LAYERS];

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

/** Bounding box of any GeoJSON geometry, or null when it holds no coordinates. */
function featureBBox(geometry: unknown): GISBounds | null {
  let west = Infinity;
  let south = Infinity;
  let east = -Infinity;
  let north = -Infinity;
  let found = false;

  const visit = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    // A coordinate pair: [lng, lat, ...optional z/m].
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const lng = node[0];
      const lat = node[1];
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;
      found = true;
      if (lng < west) west = lng;
      if (lat < south) south = lat;
      if (lng > east) east = lng;
      if (lat > north) north = lat;
      return;
    }
    for (const child of node) visit(child);
  };

  visit((geometry as { coordinates?: unknown } | null)?.coordinates);

  if (!found) return null;
  return { west, south, east, north };
}

/** Best-effort representative point for a feature, used by search results. */
function featureCentroid(geometry: unknown): { lat: number; lng: number } | null {
  const box = featureBBox(geometry);
  if (!box) return null;
  return { lat: (box.south + box.north) / 2, lng: (box.west + box.east) / 2 };
}

/**
 * Read a numeric attribute, or null when the source did not publish one.
 *
 * Blank strings and non-finite values become null rather than 0: a ward with no
 * published household count is not a ward with no households.
 */
function readNumber(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return null;
    const parsed = Number(trimmed);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

/** Read a text attribute, treating blanks and whitespace-only markers as absent. */
function readText(value: unknown): string | null {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/**
 * Sort ward codes the way an operator reads them.
 *
 * The codes are `W1`…`W67`, so a plain string sort puts W10 before W2. This
 * compares the numeric part when both codes have one and falls back to a string
 * compare otherwise, which keeps any non-conforming code in a stable position
 * rather than dropping it.
 */
function compareWardCodes(a: string, b: string): number {
  const numeric = (code: string): number | null => {
    const match = /(\d+)/.exec(code);
    return match ? Number(match[1]) : null;
  };
  const na = numeric(a);
  const nb = numeric(b);
  if (na !== null && nb !== null && na !== nb) return na - nb;
  return a.localeCompare(b, 'en');
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
      where: this.buildWhere(options.attributeFilter),
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
   * Turn a structured attribute filter into a `where` clause.
   *
   * Callers hand over a field, a value and a match mode rather than SQL, so the
   * only string that ever reaches the clause is an escaped literal. That is what
   * makes it impossible for a query typed into the interface to change the shape
   * of the request.
   */
  private buildWhere(filter: GISQueryOptions['attributeFilter']): string {
    if (!filter) return '1=1';

    // Field names come from the catalogue, never from user input, but reject
    // anything unexpected so a future caller cannot widen the surface.
    if (!/^[A-Za-z0-9_]+$/.test(filter.field)) {
      throw new GISRequestError(`Refusing to filter on unsupported field name "${filter.field}".`, '');
    }

    const literal = escapeSqlLiteral(filter.value.trim().toUpperCase());
    if (!literal) return '1=1';

    return filter.match === 'exact'
      ? `UPPER(${filter.field}) = '${literal}'`
      : `UPPER(${filter.field}) LIKE '%${literal}%'`;
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

  // --- Ward intelligence -------------------------------------------------

  /**
   * True when the ward dataset is catalogued.
   *
   * Verified rather than assumed: `AdministrativeBoundary/4` was read back and
   * confirmed to hold 67 ward polygons, each with a published ward code. When
   * this returns false the ward module must show its unavailable state, not an
   * empty selector that looks like a city with no wards.
   */
  hasWardDataset(): boolean {
    return this.layers.has(WARD_LAYER_ID);
  }

  /**
   * Catalogue id of the ward boundary layer, or null when it is not published.
   *
   * Derived from the same catalogue lookup as `hasWardDataset` so the two can
   * never disagree, and exposed on the interface so the ward module can show
   * boundary context without hardcoding a Bhubaneswar-specific layer id.
   */
  get wardLayerId(): string | null {
    return this.layers.has(WARD_LAYER_ID) ? WARD_LAYER_ID : null;
  }

  /**
   * Every ward, without geometry.
   *
   * Geometry is the expensive part of a ward request — 67 polygons at city
   * detail — and the selector only needs codes and headline attributes, so this
   * asks for attributes alone. `getWard` fetches the polygon for the one ward
   * actually selected.
   */
  async listWards(options: { signal?: AbortSignal } = {}): Promise<GISWardRecord[]> {
    const url = this.wardQueryUrl({ returnGeometry: false });
    const raw = await this.fetchJson<{ features?: { attributes?: Record<string, unknown> }[] }>(url, options.signal);

    const wards: GISWardRecord[] = [];
    for (const feature of raw.features ?? []) {
      const record = this.toWardRecord(feature.attributes ?? {}, null);
      if (record) wards.push(record);
    }

    wards.sort((a, b) => compareWardCodes(a.wardNo, b.wardNo));
    return wards;
  }

  /**
   * One ward, with its polygon.
   *
   * Returns null when the code matches nothing, which the UI reports as no
   * verified data for that ward rather than as a failure.
   */
  async getWard(wardNo: string, options: { signal?: AbortSignal } = {}): Promise<GISWardRecord | null> {
    const code = wardNo.trim();
    if (!code) return null;

    const url = this.wardQueryUrl({
      returnGeometry: true,
      where: `UPPER(${WARD_FIELDS.wardNo}) = '${escapeSqlLiteral(code.toUpperCase())}'`,
    });

    const raw = await this.fetchJson<GeoJSON.FeatureCollection>(url, options.signal);
    const feature = raw.features?.find((f) => f?.properties);
    if (!feature) return null;

    return this.toWardRecord((feature.properties ?? {}) as Record<string, unknown>, feature.geometry ?? null);
  }

  /**
   * Citywide totals, summed by the service rather than by ARKA.
   *
   * `outStatistics` keeps the arithmetic on the server and out of a client-side
   * loop over paged results, so the figure cannot silently reflect only the
   * first thousand rows. A null total means the service did not return one — it
   * is never substituted with a count of what happened to load.
   */
  async getWardTotals(options: { signal?: AbortSignal } = {}): Promise<GISWardTotals | null> {
    const statistics = [
      { statisticType: 'sum', onStatisticField: WARD_FIELDS.population, outStatisticFieldName: 'pop_total' },
      { statisticType: 'sum', onStatisticField: WARD_FIELDS.households, outStatisticFieldName: 'hh_total' },
      { statisticType: 'count', onStatisticField: WARD_FIELDS.wardNo, outStatisticFieldName: 'ward_count' },
    ];

    const url = this.buildUrl(WARD_DATASET.service, WARD_DATASET.serviceType, WARD_DATASET.sublayer, 'query', {
      where: '1=1',
      outStatistics: JSON.stringify(statistics),
      returnGeometry: false,
      f: 'json',
    });

    let raw: { features?: { attributes?: Record<string, unknown> }[] };
    try {
      raw = await this.fetchJson(url, options.signal);
    } catch (cause) {
      if (options.signal?.aborted) throw cause;
      // Totals are a summary, not the ward data itself. A failure here must not
      // take the ward module down with it.
      return null;
    }

    const attributes = raw.features?.[0]?.attributes;
    if (!attributes) return null;

    const wardCount = readNumber(attributes.ward_count);

    return {
      wardCount: wardCount ?? WARD_DATASET.wardCount,
      population: readNumber(attributes.pop_total),
      households: readNumber(attributes.hh_total),
      datasetLabel: WARD_DATASET.label,
    };
  }

  /** Build a ward query asking for exactly the fields ARKA reads. */
  private wardQueryUrl(options: { returnGeometry: boolean; where?: string }): string {
    return this.buildUrl(WARD_DATASET.service, WARD_DATASET.serviceType, WARD_DATASET.sublayer, 'query', {
      where: options.where ?? '1=1',
      // Restricted to the read set in `WARD_FIELDS`, which deliberately excludes
      // the officer mobile-number columns the source also publishes.
      outFields: Object.values(WARD_FIELDS).join(','),
      returnGeometry: options.returnGeometry,
      outSR: 4326,
      resultRecordCount: DEFAULT_MAX_RECORDS,
      f: options.returnGeometry ? 'geojson' : 'json',
    });
  }

  /**
   * Convert raw ward attributes into a record.
   *
   * A row with no ward code is dropped rather than shown as an unnamed ward, and
   * every numeric field goes through `readNumber` so an empty column arrives as
   * null instead of zero.
   */
  private toWardRecord(attributes: Record<string, unknown>, geometry: GeoJSON.Geometry | null): GISWardRecord | null {
    const wardNo = readText(attributes[WARD_FIELDS.wardNo]);
    if (!wardNo) return null;

    return {
      wardNo,
      zone: readText(attributes[WARD_FIELDS.zone]),
      councillor: readText(attributes[WARD_FIELDS.councillor]),
      // The source publishes no ward-officer name column, only a contact number
      // ARKA does not request. Reported as absent rather than invented.
      wardOfficer: null,
      areaHectares: readNumber(attributes[WARD_FIELDS.areaHectares]),
      households: readNumber(attributes[WARD_FIELDS.households]),
      population: readNumber(attributes[WARD_FIELDS.population]),
      populationMale: readNumber(attributes[WARD_FIELDS.populationMale]),
      populationFemale: readNumber(attributes[WARD_FIELDS.populationFemale]),
      populationSC: readNumber(attributes[WARD_FIELDS.populationSC]),
      populationST: readNumber(attributes[WARD_FIELDS.populationST]),
      geometry,
      bounds: geometry ? featureBBox(geometry) : null,
    };
  }

  // --- Spatial query -----------------------------------------------------

  /**
   * Layers the query engine can search.
   *
   * Derived from the catalogue rather than listed separately, so a layer becomes
   * queryable by being published with a search field — there is no second list
   * that can drift out of step and offer a query against a dataset that is not
   * connected. Bulk datasets are excluded: they are server-rendered and carry no
   * feature selection.
   */
  listQueryableLayers(): GISQueryableLayer[] {
    return this.listSearchableLayers()
      .filter((layer) => !layer.bulkDataset)
      .map((layer) => ({
        layerId: layer.id,
        label: layer.label,
        category: layer.category,
        facilityKind: layer.facilityKind ?? null,
        searchField: layer.searchField as string,
        verifiedFeatureCount: layer.verifiedFeatureCount ?? null,
      }));
  }

  /**
   * True when a verified population dataset is connected.
   *
   * This is a statement about one specific thing: the ward dataset publishes
   * `totalwardp`, `totalmalep`, `totalfemal`, `totalscpop`, `totalstpop` and
   * `numberofho`, populated for all 67 wards — checked against the live service,
   * not inferred from the field existing. Population queries at ward level are
   * therefore real. It does not claim population data at any other geography;
   * a query the dataset cannot answer must still report that it is unsupported.
   */
  hasPopulationDataset(): boolean {
    return this.hasWardDataset();
  }

  /**
   * Search one layer by name and return display-ready rows.
   *
   * An empty term lists the layer's features instead of matching nothing, which
   * is what "show me the schools" means when no name has been typed.
   */
  async queryLayer(
    layerId: string,
    term: string,
    options: { signal?: AbortSignal; limit?: number; bounds?: GISBounds } = {},
  ): Promise<GISQueryResult[]> {
    const layer = this.requireLayer(layerId);
    if (layer.kind !== 'vector') {
      throw new GISRequestError(
        `Layer "${layer.id}" is drawn as a server image and cannot be queried for features.`,
        '',
      );
    }
    if (layer.bulkDataset) {
      throw new GISRequestError(
        `Layer "${layer.id}" is a bulk dataset and is not searchable feature by feature.`,
        '',
      );
    }

    const needle = term.trim();
    const field = layer.searchField;

    const result = await this.queryFeatures(layerId, {
      bounds: options.bounds,
      maxFeatures: options.limit ?? 50,
      signal: options.signal,
      attributeFilter: needle && field ? { field, value: needle, match: 'contains' } : undefined,
    });

    const rows: GISQueryResult[] = [];
    for (const feature of result.featureCollection.features) {
      const properties = (feature.properties ?? {}) as Record<string, unknown>;
      const centre = featureCentroid(feature.geometry);
      if (!centre || !isPlausibleLngLat(centre.lng, centre.lat)) continue;

      rows.push({
        layerId: layer.id,
        layerLabel: layer.label,
        label: featureLabel(layer, properties),
        lat: centre.lat,
        lng: centre.lng,
        attributes: describeAttributes(layer, properties),
        geometry: feature.geometry ?? null,
      });
    }

    rows.sort((a, b) => a.label.localeCompare(b.label, 'en'));
    return rows;
  }

  /** Readable attribute rows for one feature. Unknown layers yield nothing. */
  describeFeature(layerId: string, properties: Record<string, unknown>): GISAttributeRow[] {
    const layer = this.layers.get(layerId);
    if (!layer) return [];
    return describeAttributes(layer, properties);
  }
}

/** Shared instance. ARKA runs one city provider at a time. */
export const bhubaneswarGIS = new BhubaneswarGISService();

/** Exported for tests and for a future provider registry. */
export { LAYER_CATALOGUE as BHUBANESWAR_LAYER_CATALOGUE, SERVICE_ROOT as BHUBANESWAR_SERVICE_ROOT };
