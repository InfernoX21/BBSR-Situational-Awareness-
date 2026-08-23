/**
 * Administrative and statutory boundary layers.
 *
 * Split out of the provider so the catalogue can grow without the service file
 * becoming unreadable. Every entry below was confirmed against the live
 * endpoint: service path, sublayer id, geometry type, feature count and field
 * names were each read back before the layer was published here.
 *
 * Two rules govern this file:
 *
 *  - Boundary classes are distinguished by *dash pattern* as well as colour, so
 *    an operator can separate a ward line from a zone line without the legend
 *    and without relying on colour vision.
 *  - A layer whose source returns zero features, or which duplicates a dataset
 *    already published elsewhere in the catalogue, does not appear. See
 *    `EXCLUDED_LAYERS` in the provider for what was dropped and why.
 */

import type { GISLayerDef } from '../types';
import { BOUNDARY_DASH, PALETTE } from '../palette';

/**
 * The city's ward dataset.
 *
 * `AdministrativeBoundary/4` is the authoritative set: 67 wards, every one
 * carrying published population, household, councillor and zone attributes.
 * The separate `BMC_WardBoundary` FeatureServer holds only 58 of those wards, so
 * it is not used — building ward intelligence on it would report nine real wards
 * as having no data.
 */
export const WARD_DATASET = {
  service: 'AdministrativeBoundary',
  serviceType: 'MapServer' as const,
  sublayer: 4,
  /** Verified ward count in this dataset. */
  wardCount: 67,
  label: 'BMC ward boundaries (AdministrativeBoundary)',
} as const;

/**
 * Field names on the ward dataset, verified against the live service.
 *
 * `mobilenoof`, `WardLevelO` and `WardLeve_1` are deliberately absent from the
 * read set: they carry an individual officer's personal mobile number, which
 * ARKA has no operational need for. Restricting the requested fields keeps that
 * data out of the browser entirely rather than fetching and then hiding it.
 */
export const WARD_FIELDS = {
  wardNo: 'wardno',
  zone: 'municipalz',
  councillor: 'nameofthec',
  areaHectares: 'area_in_he',
  households: 'numberofho',
  population: 'totalwardp',
  populationMale: 'totalmalep',
  populationFemale: 'totalfemal',
  populationSC: 'totalscpop',
  populationST: 'totalstpop',
} as const;

/** Newly published boundary layers, beyond those already in the provider. */
export const BOUNDARY_LAYERS: GISLayerDef[] = [
  // --- Administrative boundaries ------------------------------------------
  {
    id: 'bda-rural-boundary',
    label: 'BDA rural boundary',
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Rural portion of the Bhubaneswar Development Authority area.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 14,
    verifiedFeatureCount: 1,
    source: { protocol: 'arcgis', service: 'AdministrativeBoundary', serviceType: 'MapServer', sublayers: [8] },
    style: { color: PALETTE.line, weight: 1.2, fillOpacity: 0, dashArray: BOUNDARY_DASH.authority },
  },
  {
    id: 'bcuc-boundary',
    label: 'Bhubaneswar–Cuttack urban complex',
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Outer limit of the combined Bhubaneswar–Cuttack urban complex.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 13,
    verifiedFeatureCount: 1,
    source: { protocol: 'arcgis', service: 'AdministrativeBoundary', serviceType: 'MapServer', sublayers: [9] },
    style: { color: PALETTE.ink, weight: 1.4, fillOpacity: 0, dashArray: BOUNDARY_DASH.authority },
  },
  {
    id: 'jatani-municipality',
    label: 'Jatani municipality',
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Jatani municipal boundary, adjoining the BMC area to the south.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 19,
    verifiedFeatureCount: 1,
    source: { protocol: 'arcgis', service: 'AdministrativeBoundary', serviceType: 'MapServer', sublayers: [11] },
    style: { color: PALETTE.accentDim, weight: 1.2, fillOpacity: 0, dashArray: BOUNDARY_DASH.municipal },
    popupFields: [{ field: 'NAME', label: 'Municipality' }],
    searchField: 'NAME',
  },
  {
    id: 'khurda-municipality',
    label: 'Khurda municipality',
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Khurda municipal boundary, adjoining the BDA area.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 19,
    verifiedFeatureCount: 1,
    source: { protocol: 'arcgis', service: 'AdministrativeBoundary', serviceType: 'MapServer', sublayers: [13] },
    style: { color: PALETTE.accentDim, weight: 1.2, fillOpacity: 0, dashArray: BOUNDARY_DASH.municipal },
  },
  {
    id: 'khurda-wards',
    label: 'Khurda ward boundary',
    category: 'admin-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Ward boundary published for the Khurda municipal area.',
    // Published as a single polygon rather than one per ward, so it delineates
    // the warded area as a whole. Stated here so the layer is not read as a
    // per-ward breakdown.
    caveat: 'The source publishes this as one combined polygon, not as individual Khurda wards.',
    defaultVisible: false,
    defaultOpacity: 0.85,
    order: 21,
    verifiedFeatureCount: 1,
    source: { protocol: 'arcgis', service: 'AdministrativeBoundary', serviceType: 'MapServer', sublayers: [14] },
    style: { color: PALETTE.line, weight: 0.9, fillOpacity: 0, dashArray: BOUNDARY_DASH.ward },
  },

  // --- Statutory & other boundaries ---------------------------------------
  {
    id: 'assembly-constituency',
    label: 'Assembly constituencies',
    category: 'statutory-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'State assembly constituency boundaries covering the city.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 17,
    verifiedFeatureCount: 3,
    source: { protocol: 'arcgis', service: 'AssemblyConstituencyBoundary', serviceType: 'MapServer', sublayers: [0] },
    style: { color: PALETTE.civic, weight: 1.3, fillOpacity: 0, dashArray: BOUNDARY_DASH.statutory },
    popupFields: [{ field: 'Name', label: 'Constituency' }],
    searchField: 'Name',
  },
  {
    id: 'police-jurisdiction',
    label: 'Police jurisdictions',
    category: 'statutory-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Police station jurisdiction areas across the city.',
    caveat:
      'Jurisdiction geography only. This layer carries no dispatch state, patrol position or incident assignment.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 17,
    verifiedFeatureCount: 17,
    source: { protocol: 'arcgis', service: 'PoliceJurisdictionMap', serviceType: 'MapServer', sublayers: [0] },
    style: { color: PALETTE.accent, weight: 1.1, fillColor: PALETTE.accent, fillOpacity: 0.04, dashArray: BOUNDARY_DASH.statutory },
    popupFields: [{ field: 'Name', label: 'Jurisdiction' }],
    searchField: 'Name',
  },
  {
    id: 'health-jurisdiction',
    label: 'Health jurisdictions',
    category: 'statutory-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Urban health unit catchment areas, with the population each is recorded as serving.',
    caveat:
      'Catchment geography and recorded served population. This layer carries no bed availability, staffing or occupancy.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 17,
    verifiedFeatureCount: 22,
    source: { protocol: 'arcgis', service: 'HealthJurisdictionMap', serviceType: 'MapServer', sublayers: [0] },
    style: { color: PALETTE.health, weight: 1.1, fillColor: PALETTE.health, fillOpacity: 0.05, dashArray: BOUNDARY_DASH.statutory },
    popupFields: [
      { field: 'Health_Unit_Name', label: 'Health unit' },
      { field: 'wardno', label: 'Ward' },
      { field: 'No__of_Wards', label: 'Wards served', format: 'integer' },
      { field: 'Population_Served', label: 'Population served', format: 'integer' },
      { field: 'UPHC__Situated_at_Ward_No', label: 'UPHC ward' },
      { field: 'Address', label: 'Address' },
    ],
    searchField: 'Health_Unit_Name',
  },
  {
    id: 'transitional-zone',
    label: 'Airport transitional zone',
    category: 'statutory-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Height-restriction transitional surfaces published around the airport.',
    caveat: 'Planning restriction geometry. Not an active airspace or flight-clearance source.',
    defaultVisible: false,
    defaultOpacity: 0.8,
    order: 16,
    verifiedFeatureCount: 8,
    source: { protocol: 'arcgis', service: 'TransitionalZone', serviceType: 'MapServer', sublayers: [0] },
    style: { color: PALETTE.power, weight: 1, fillColor: PALETTE.power, fillOpacity: 0.05, dashArray: BOUNDARY_DASH.statutory },
    popupFields: [
      { field: 'max_height', label: 'Max height', format: 'length-metres' },
      { field: 'max_distan', label: 'Max distance', format: 'length-metres' },
    ],
  },
  {
    id: 'bda-extended-villages',
    label: 'Village boundaries (BDA extended)',
    category: 'statutory-boundaries',
    kind: 'vector',
    dataClass: 'reference',
    description: 'Revenue village boundaries across the extended BDA planning area.',
    defaultVisible: false,
    defaultOpacity: 0.8,
    order: 15,
    verifiedFeatureCount: 364,
    source: { protocol: 'arcgis', service: 'BDAEXTENDED', serviceType: 'MapServer', sublayers: [1] },
    style: { color: PALETTE.line, weight: 0.6, fillOpacity: 0, dashArray: BOUNDARY_DASH.revenue },
    popupFields: [{ field: 'vill_name', label: 'Village' }],
    searchField: 'vill_name',
  },

  // --- Town planning schemes ----------------------------------------------
  // Published as three separate sublayers so each approval stage stays
  // independently toggleable. Rendered server-side: these are cartographic
  // boundary sets whose attribute table holds CAD handles rather than
  // presentable scheme metadata.
  {
    id: 'tp-scheme-draft',
    label: 'TP schemes — draft',
    category: 'statutory-boundaries',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Town planning scheme boundaries at draft stage.',
    defaultVisible: false,
    defaultOpacity: 0.7,
    order: 15,
    verifiedFeatureCount: 4,
    source: { protocol: 'arcgis', service: 'TPSchemeBoundary', serviceType: 'MapServer', sublayers: [1] },
  },
  {
    id: 'tp-scheme-intention',
    label: 'TP schemes — intention declared',
    category: 'statutory-boundaries',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Town planning schemes with a declared intention notification.',
    defaultVisible: false,
    defaultOpacity: 0.7,
    order: 15,
    verifiedFeatureCount: 4,
    source: { protocol: 'arcgis', service: 'TPSchemeBoundary', serviceType: 'MapServer', sublayers: [2] },
  },
  {
    id: 'tp-scheme-approved',
    label: 'TP schemes — in-principle approved',
    category: 'statutory-boundaries',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Town planning schemes with in-principle approval.',
    defaultVisible: false,
    defaultOpacity: 0.7,
    order: 15,
    verifiedFeatureCount: 37,
    source: { protocol: 'arcgis', service: 'TPSchemeBoundary', serviceType: 'MapServer', sublayers: [3] },
  },

  // --- Cadastral bulk datasets --------------------------------------------
  // Hundreds of thousands of polygons each. Fetching these as GeoJSON would
  // stall the browser, so they are server-rendered and carry no click
  // selection. `bulkDataset` lets the UI say so rather than appear broken.
  {
    id: 'plot-boundary',
    label: 'Plot boundaries (revenue)',
    category: 'statutory-boundaries',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Cadastral plot boundaries across the revenue villages.',
    caveat:
      'Bulk cadastral dataset of about 239,000 plots, rendered by the source server. Individual plots are not selectable in ARKA.',
    defaultVisible: false,
    defaultOpacity: 0.6,
    order: 11,
    verifiedFeatureCount: 239099,
    bulkDataset: true,
    source: { protocol: 'arcgis', service: 'VillagePlotBoundary', serviceType: 'MapServer', sublayers: [1] },
  },
  {
    id: 'plot-boundary-bda-extended',
    label: 'Plot boundaries (BDA extended)',
    category: 'statutory-boundaries',
    kind: 'raster-dynamic',
    dataClass: 'reference',
    description: 'Cadastral plot boundaries across the extended BDA planning area.',
    caveat:
      'Bulk cadastral dataset of about 360,000 plots, rendered by the source server. Individual plots are not selectable in ARKA.',
    defaultVisible: false,
    defaultOpacity: 0.6,
    order: 11,
    verifiedFeatureCount: 360097,
    bulkDataset: true,
    source: { protocol: 'arcgis', service: 'BDAEXTENDED', serviceType: 'MapServer', sublayers: [2] },
  },
];
