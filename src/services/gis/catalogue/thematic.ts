/**
 * Thematic layers: community services, culture, education, government, health,
 * religious sites, recreation, tourism, transport terminals, utility plants and
 * parking.
 *
 * Every layer below was verified against the live endpoint before publication:
 * sublayer id, geometry type, feature count and field names were each read back.
 * Layers returning zero features are absent, and so are fields whose columns
 * turned out to be unpopulated or filled with class defaults. Specifically:
 *
 *  - The health directory's `availabili`, `emergency_` and `ambulance_` columns
 *    are zero or null for every record, and `total_numb` is populated for only
 *    4 of 27 hospitals. Publishing them would have asserted that a hospital has
 *    no beds and no ambulance. All four are omitted.
 *  - Religious sites publish `avareasqm` and `tc_inr` with just three distinct
 *    values across 88 temples — class defaults rather than per-site measurements.
 *    Both are omitted.
 *  - The stormwater layer's `landuse` and `category` hold one constant value
 *    each, so only the village name is shown.
 *
 * Personal contact columns (an ICDS worker's mobile, a principal's phone, a
 * medical officer's CUG number, a parking auction holder's name) are excluded
 * from the requested field set, which keeps them out of the browser rather than
 * fetching and then hiding them.
 */

import type { GISLayerDef, GISPopupField } from '../types';
import { PALETTE } from '../palette';

// ---------------------------------------------------------------------------
// Shared field sets
// ---------------------------------------------------------------------------
// Several themes are published from one table schema, so the popup definition is
// shared rather than repeated. Field names are verbatim from the service.

/** Art centre, library, museum, performing arts, learning point. */
const CULTURE_FIELDS: GISPopupField[] = [
  { field: 'Name_of_the_Place', label: 'Name' },
  { field: 'Category', label: 'Category' },
  { field: 'Address', label: 'Address' },
  { field: 'Timings', label: 'Timings' },
  { field: 'Phone_number', label: 'Phone' },
];

/** University and training institute share one schema. */
const EDUCATION_FIELDS: GISPopupField[] = [
  { field: 'name', label: 'Institution' },
  { field: 'type_of_ed', label: 'Type' },
  { field: 'govt___pri', label: 'Management' },
  { field: 'affiliated', label: 'Affiliation' },
  { field: 'address', label: 'Address' },
  { field: 'contact_nu', label: 'Phone' },
];

/** Central, state and city-level government offices. */
const GOVERNMENT_FIELDS: GISPopupField[] = [
  { field: 'name', label: 'Office' },
  { field: 'department', label: 'Department' },
  { field: 'Central___State__Other', label: 'Tier' },
  { field: 'address', label: 'Address' },
  { field: 'contact_nu', label: 'Phone' },
];

/**
 * Government health institutions (dispensary, UCHC, UPHC).
 *
 * The blood-bank and pathology entries are recorded capability flags from the
 * source directory — a `Yes`/`No` describing what the institution is equipped
 * for, not whether a service is available right now.
 */
const HEALTH_INSTITUTION_FIELDS: GISPopupField[] = [
  { field: 'Name_of_institution', label: 'Institution' },
  { field: 'Type', label: 'Type' },
  { field: 'Govt_Pvt', label: 'Management' },
  { field: 'Service_area_Ward_No', label: 'Service wards' },
  { field: 'Timing', label: 'Timings' },
  { field: 'Availability_of_blood_bank', label: 'Blood bank (equipped)' },
  { field: 'Availability_of_pathology_servi', label: 'Pathology (equipped)' },
  { field: 'Part_time_Specialist_under_NHM', label: 'NHM specialist' },
  { field: 'Address', label: 'Address' },
  { field: 'Landline_No', label: 'Landline' },
];

/** Private and other health facilities (clinic, nursing home, CGHS, other). */
const HEALTH_DIRECTORY_FIELDS: GISPopupField[] = [
  { field: 'name', label: 'Facility' },
  { field: 'category', label: 'Sector' },
  { field: 'care_type', label: 'Care type' },
  { field: 'system_of_', label: 'System of medicine' },
  { field: 'specialiti', label: 'Specialities' },
  { field: 'address', label: 'Address' },
  { field: 'contact_nu', label: 'Phone' },
];

/** Temple, church, gurudwara, masjid. */
const RELIGIOUS_FIELDS: GISPopupField[] = [
  { field: 'label', label: 'Name' },
  { field: 'location', label: 'Location' },
  { field: 'category', label: 'Type' },
  { field: 'sub_comm', label: 'Locality' },
  { field: 'ward', label: 'Ward' },
];

/** ASI, state archaeology and other heritage properties. */
const HERITAGE_FIELDS: GISPopupField[] = [
  { field: 'Name_of_Monument_Precinct', label: 'Monument' },
  { field: 'Location', label: 'Location' },
  { field: 'Name_of_Temple_Precinct', label: 'Precinct' },
  { field: 'Property_Type', label: 'Property type' },
  { field: 'Typology', label: 'Typology' },
  { field: 'Age', label: 'Age' },
  { field: 'Ownership', label: 'Ownership' },
  { field: 'Property_Use', label: 'Current use' },
  { field: 'State_of_Preservation', label: 'Preservation' },
  { field: 'Protection_Status', label: 'Protection status' },
];

/** Branch and sub post offices. */
const POSTAL_FIELDS: GISPopupField[] = [
  { field: 'Name_of_the_Post_Office', label: 'Post office' },
  { field: 'Type__HO__BO__SO_', label: 'Type' },
  { field: 'PINCODE', label: 'PIN code' },
  { field: 'Address_of_the_office', label: 'Address' },
  { field: 'Official_Timing__in_hours__', label: 'Timings' },
  { field: 'Phone_No', label: 'Phone' },
];

/** Parking lots, published per municipal zone with one schema. */
const PARKING_FIELDS: GISPopupField[] = [
  { field: 'Name', label: 'Parking space' },
  { field: 'Location', label: 'Location' },
  { field: 'WardNo', label: 'Ward' },
  { field: 'Zone', label: 'Zone' },
  // Held as a dimension string ("24.384 X 6.096"), not a numeric area, so it is
  // shown verbatim rather than formatted as a measurement.
  { field: 'Area__sq_mtr', label: 'Plot dimensions (m)' },
  { field: 'Status', label: 'Status' },
  { field: 'PlotNo_KhataNo', label: 'Plot / khata no.' },
];

const HEALTH_DIRECTORY_CAVEAT =
  'Facility directory. The source publishes bed-count, emergency and ambulance columns as empty, so they are not shown. This layer carries no live capacity, occupancy or on-call state.';

const HEALTH_INSTITUTION_CAVEAT =
  'Directory record. Blood bank and pathology entries describe what the institution is equipped for, as recorded at source — not live service availability.';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Every thematic layer is a point or small polygon set on the Category service. */
function category(
  id: string,
  label: string,
  sublayer: number,
  def: Omit<GISLayerDef, 'id' | 'label' | 'kind' | 'dataClass' | 'defaultVisible' | 'defaultOpacity' | 'source'>,
): GISLayerDef {
  return {
    id,
    label,
    kind: 'vector',
    dataClass: 'reference',
    defaultVisible: false,
    defaultOpacity: 0.95,
    source: { protocol: 'arcgis', service: 'Category', serviceType: 'FeatureServer', sublayers: [sublayer] },
    ...def,
  };
}

const POINT = (color: string, radius = 4) => ({ color, weight: 1, fillColor: color, fillOpacity: 0.7, pointRadius: radius });

// ---------------------------------------------------------------------------
// Catalogue
// ---------------------------------------------------------------------------

export const THEMATIC_LAYERS: GISLayerDef[] = [
  // --- Community services -------------------------------------------------
  category('bank', 'Banks', 1, {
    category: 'community-services',
    description: 'Bank branches with IFSC and address.',
    order: 120,
    verifiedFeatureCount: 186,
    facilityKind: 'bank',
    style: POINT(PALETTE.commerce),
    popupFields: [
      { field: 'bankname', label: 'Bank' },
      { field: 'branch', label: 'Branch' },
      { field: 'ifsccode', label: 'IFSC' },
      { field: 'address', label: 'Address' },
    ],
    searchField: 'bankname',
  }),
  category('hotel', 'Hotels', 2, {
    category: 'community-services',
    description: 'Registered hotels and lodging.',
    order: 118,
    verifiedFeatureCount: 93,
    facilityKind: 'hotel',
    style: POINT(PALETTE.commerce),
    popupFields: [
      { field: 'name', label: 'Hotel' },
      { field: 'category', label: 'Category' },
      { field: 'address', label: 'Address' },
      { field: 'contact_nu', label: 'Phone' },
      { field: 'website', label: 'Website' },
    ],
    searchField: 'name',
  }),
  category('restaurant', 'Restaurants', 3, {
    category: 'community-services',
    description: 'Restaurants, with cuisine where recorded.',
    order: 117,
    verifiedFeatureCount: 141,
    facilityKind: 'restaurant',
    style: POINT(PALETTE.commerce, 3),
    popupFields: [
      { field: 'name_of_th', label: 'Restaurant' },
      { field: 'cuisine', label: 'Cuisine' },
      { field: 'address', label: 'Address' },
    ],
    searchField: 'name_of_th',
  }),
  category('petrol-pump', 'Fuel stations', 4, {
    category: 'community-services',
    description: 'Petrol and diesel filling stations.',
    caveat: 'Station locations only. No fuel stock, queue or pricing data.',
    order: 122,
    verifiedFeatureCount: 32,
    facilityKind: 'fuel',
    style: POINT(PALETTE.power),
    popupFields: [
      { field: 'name', label: 'Station' },
      { field: 'address', label: 'Address' },
    ],
    searchField: 'name',
  }),
  category('community-centre', 'Community centres', 5, {
    category: 'community-services',
    description: 'Community and kalyan mandaps, with booking contact.',
    order: 121,
    verifiedFeatureCount: 29,
    facilityKind: 'community-centre',
    style: POINT(PALETTE.civic),
    popupFields: [
      { field: 'name', label: 'Centre' },
      { field: 'govt__priv', label: 'Management' },
      { field: 'booking_am', label: 'Booking' },
      { field: 'address', label: 'Address' },
      { field: 'contact_no', label: 'Phone' },
    ],
    searchField: 'name',
  }),
  category('shopping', 'Markets & shopping', 6, {
    category: 'community-services',
    description: 'Markets, malls and organised shopping areas.',
    order: 119,
    verifiedFeatureCount: 21,
    facilityKind: 'market',
    style: POINT(PALETTE.commerce),
    popupFields: [
      { field: 'name', label: 'Market' },
      { field: 'typeofmark', label: 'Type' },
      { field: 'timing', label: 'Timings' },
      { field: 'address', label: 'Address' },
    ],
    searchField: 'name',
  }),
  category('telephone-exchange', 'Telephone exchanges', 8, {
    category: 'community-services',
    description: 'Telecom exchange buildings.',
    order: 123,
    verifiedFeatureCount: 2,
    style: POINT(PALETTE.transit),
    popupFields: [{ field: 'name', label: 'Exchange' }],
    searchField: 'name',
  }),
  category('post-office-branch', 'Branch post offices', 10, {
    category: 'community-services',
    description: 'Branch post offices with PIN code and timings.',
    order: 124,
    verifiedFeatureCount: 6,
    facilityKind: 'post-office',
    style: POINT(PALETTE.civic),
    popupFields: POSTAL_FIELDS,
    searchField: 'Name_of_the_Post_Office',
  }),
  category('post-office-sub', 'Sub post offices', 11, {
    category: 'community-services',
    description: 'Sub post offices with PIN code and timings.',
    order: 124,
    verifiedFeatureCount: 43,
    facilityKind: 'post-office',
    style: POINT(PALETTE.civic),
    popupFields: POSTAL_FIELDS,
    searchField: 'Name_of_the_Post_Office',
  }),
  category('police-outpost', 'Police out posts', 13, {
    category: 'community-services',
    description: 'Police out post locations.',
    caveat:
      'Location directory only. This layer carries no dispatch state, patrol position or incident assignment.',
    order: 126,
    verifiedFeatureCount: 24,
    facilityKind: 'police',
    style: POINT(PALETTE.accent),
    popupFields: [{ field: 'Location', label: 'Out post' }],
    searchField: 'Location',
  }),

  // --- Culture ------------------------------------------------------------
  category('art-centre', 'Art centres', 15, {
    category: 'culture',
    description: 'Art centres and galleries.',
    order: 130,
    verifiedFeatureCount: 4,
    style: POINT(PALETTE.culture),
    popupFields: CULTURE_FIELDS,
    searchField: 'Name_of_the_Place',
  }),
  category('library', 'Libraries', 16, {
    category: 'culture',
    description: 'Public and institutional libraries.',
    order: 130,
    verifiedFeatureCount: 5,
    facilityKind: 'library',
    style: POINT(PALETTE.culture),
    popupFields: CULTURE_FIELDS,
    searchField: 'Name_of_the_Place',
  }),
  category('museum', 'Museums', 17, {
    category: 'culture',
    description: 'Museums and interpretation centres.',
    order: 130,
    verifiedFeatureCount: 5,
    facilityKind: 'museum',
    style: POINT(PALETTE.culture),
    popupFields: CULTURE_FIELDS,
    searchField: 'Name_of_the_Place',
  }),
  category('performing-arts', 'Performing arts centres', 18, {
    category: 'culture',
    description: 'Auditoria and performing arts venues.',
    order: 130,
    verifiedFeatureCount: 3,
    style: POINT(PALETTE.culture),
    popupFields: CULTURE_FIELDS,
    searchField: 'Name_of_the_Place',
  }),

  // --- Educational --------------------------------------------------------
  category('university', 'Universities', 20, {
    category: 'educational',
    description: 'Universities and deemed universities.',
    order: 134,
    verifiedFeatureCount: 8,
    facilityKind: 'university',
    style: POINT(PALETTE.education, 5),
    popupFields: EDUCATION_FIELDS,
    searchField: 'name',
  }),
  category('college', 'Colleges', 21, {
    category: 'educational',
    description: 'Degree and professional colleges.',
    order: 133,
    verifiedFeatureCount: 109,
    facilityKind: 'college',
    style: POINT(PALETTE.education),
    popupFields: [
      { field: 'Name_Of_College', label: 'College' },
      { field: 'Category', label: 'Category' },
      { field: 'College_Code', label: 'Code' },
      { field: 'Address', label: 'Address' },
      { field: 'Website', label: 'Website' },
    ],
    searchField: 'Name_Of_College',
  }),
  category('school', 'Schools', 22, {
    category: 'educational',
    description: 'Schools from the OPEPA DISE return, with enrolment and staffing.',
    caveat:
      'Enrolment and staffing are periodic DISE returns recorded at source, not a live roll. Blank where the source did not publish a figure.',
    order: 132,
    verifiedFeatureCount: 354,
    facilityKind: 'school',
    style: POINT(PALETTE.education, 3),
    popupFields: [
      { field: 'School_Name', label: 'School' },
      { field: 'School_ID', label: 'DISE code' },
      { field: 'Management', label: 'Management' },
      { field: 'Category', label: 'Category' },
      { field: 'Rura___Urban', label: 'Area type' },
      // Populated for 350 of 354 schools; a zero means the return was blank.
      { field: 'Total_Students', label: 'Students', format: 'integer', suppressZero: true },
      { field: 'Total_Teachers', label: 'Teachers', format: 'integer', suppressZero: true },
      { field: 'Year_of_Establishment', label: 'Established', suppressZero: true },
      { field: 'Block_name', label: 'Block' },
      { field: 'Address', label: 'Address' },
      { field: 'Area_Pincode', label: 'PIN code' },
    ],
    searchField: 'School_Name',
  }),
  category('training-institute', 'Training institutes', 23, {
    category: 'educational',
    description: 'Vocational and other training institutes.',
    order: 133,
    verifiedFeatureCount: 37,
    facilityKind: 'training-institute',
    style: POINT(PALETTE.education),
    popupFields: EDUCATION_FIELDS,
    searchField: 'name',
  }),
  category('anganwadi', 'Anganwadi centres', 24, {
    category: 'educational',
    description: 'ICDS anganwadi centres, with the catchment population recorded at source.',
    caveat:
      'Catchment population is published for 203 of 355 centres; it is left blank for the rest rather than shown as zero.',
    order: 131,
    verifiedFeatureCount: 355,
    facilityKind: 'anganwadi',
    style: POINT(PALETTE.health, 3),
    popupFields: [
      { field: 'Name_of_ICDS_Centre', label: 'Centre' },
      { field: 'Type_of_ICDS_Centre', label: 'Type' },
      { field: 'Ward_Number', label: 'Ward' },
      { field: 'Sector', label: 'Sector' },
      { field: 'Population_Catering_to', label: 'Catchment population', format: 'integer', suppressZero: true },
      { field: 'CDPO_Jurisdiction', label: 'CDPO jurisdiction' },
      { field: 'Address', label: 'Address' },
    ],
    searchField: 'Name_of_ICDS_Centre',
  }),
  category('learning-point', 'Learning points', 25, {
    category: 'educational',
    description: 'Study and learning centres open to students.',
    order: 134,
    verifiedFeatureCount: 19,
    style: POINT(PALETTE.education),
    popupFields: CULTURE_FIELDS,
    searchField: 'Name_of_the_Place',
  }),

  // --- Government offices -------------------------------------------------
  category('gov-central', 'Central government offices', 27, {
    category: 'government-office',
    description: 'Central government offices in the city.',
    order: 136,
    verifiedFeatureCount: 8,
    facilityKind: 'government-office',
    style: POINT(PALETTE.government, 5),
    popupFields: GOVERNMENT_FIELDS,
    searchField: 'name',
  }),
  category('gov-state', 'State government offices', 28, {
    category: 'government-office',
    description: 'State government directorates and offices.',
    order: 135,
    verifiedFeatureCount: 128,
    facilityKind: 'government-office',
    style: POINT(PALETTE.government),
    popupFields: GOVERNMENT_FIELDS,
    searchField: 'name',
  }),
  category('gov-city', 'City level offices', 29, {
    category: 'government-office',
    description: 'Municipal and city-level administrative offices.',
    order: 136,
    verifiedFeatureCount: 6,
    facilityKind: 'government-office',
    style: POINT(PALETTE.government, 5),
    popupFields: GOVERNMENT_FIELDS,
    searchField: 'name',
  }),

  // --- Health -------------------------------------------------------------
  category('health-dispensary', 'Government dispensaries', 32, {
    category: 'health',
    description: 'Government dispensaries with timings and service wards.',
    caveat: HEALTH_INSTITUTION_CAVEAT,
    order: 140,
    verifiedFeatureCount: 5,
    facilityKind: 'dispensary',
    style: POINT(PALETTE.health),
    popupFields: HEALTH_INSTITUTION_FIELDS,
    searchField: 'Name_of_institution',
  }),
  category('health-uchc', 'Urban community health centres', 33, {
    category: 'health',
    description: 'Urban community health centres (UCHC) with service wards.',
    caveat: HEALTH_INSTITUTION_CAVEAT,
    order: 141,
    verifiedFeatureCount: 5,
    facilityKind: 'health-centre',
    style: POINT(PALETTE.health, 5),
    popupFields: HEALTH_INSTITUTION_FIELDS,
    searchField: 'Name_of_institution',
  }),
  category('health-uphc', 'Urban primary health centres', 34, {
    category: 'health',
    description: 'Urban primary health centres (UPHC) with timings and service wards.',
    caveat: HEALTH_INSTITUTION_CAVEAT,
    order: 141,
    verifiedFeatureCount: 13,
    facilityKind: 'health-centre',
    style: POINT(PALETTE.health, 5),
    popupFields: HEALTH_INSTITUTION_FIELDS,
    searchField: 'Name_of_institution',
  }),
  category('health-cghs', 'Central government health centres', 35, {
    category: 'health',
    description: 'Central government health scheme facilities.',
    caveat: HEALTH_DIRECTORY_CAVEAT,
    order: 140,
    verifiedFeatureCount: 5,
    facilityKind: 'health-centre',
    style: POINT(PALETTE.health),
    popupFields: HEALTH_DIRECTORY_FIELDS,
    searchField: 'name',
  }),
  category('health-clinic', 'Clinics', 36, {
    category: 'health',
    description: 'Registered clinics, with speciality where recorded.',
    caveat: HEALTH_DIRECTORY_CAVEAT,
    order: 138,
    verifiedFeatureCount: 37,
    facilityKind: 'clinic',
    style: POINT(PALETTE.health, 3),
    popupFields: HEALTH_DIRECTORY_FIELDS,
    searchField: 'name',
  }),
  category('health-nursing-home', 'Nursing homes', 38, {
    category: 'health',
    description: 'Nursing homes and small private inpatient facilities.',
    caveat: HEALTH_DIRECTORY_CAVEAT,
    order: 139,
    verifiedFeatureCount: 9,
    facilityKind: 'nursing-home',
    style: POINT(PALETTE.health),
    popupFields: HEALTH_DIRECTORY_FIELDS,
    searchField: 'name',
  }),
  category('health-other', 'Other health facilities', 39, {
    category: 'health',
    description: 'Health facilities not covered by the other directories.',
    caveat: HEALTH_DIRECTORY_CAVEAT,
    order: 138,
    verifiedFeatureCount: 4,
    style: POINT(PALETTE.health, 3),
    popupFields: HEALTH_DIRECTORY_FIELDS,
    searchField: 'name',
  }),

  // --- Religious places ---------------------------------------------------
  category('temple', 'Temples', 42, {
    category: 'religious',
    description: 'Temples recorded in the city survey.',
    order: 144,
    verifiedFeatureCount: 88,
    facilityKind: 'temple',
    style: POINT(PALETTE.religious, 3),
    popupFields: RELIGIOUS_FIELDS,
    searchField: 'label',
  }),
  category('church', 'Churches', 43, {
    category: 'religious',
    description: 'Churches recorded in the city survey.',
    order: 144,
    verifiedFeatureCount: 8,
    facilityKind: 'church',
    style: POINT(PALETTE.religious),
    popupFields: RELIGIOUS_FIELDS,
    searchField: 'label',
  }),
  category('gurudwara', 'Gurudwaras', 44, {
    category: 'religious',
    description: 'Gurudwaras recorded in the city survey.',
    order: 144,
    verifiedFeatureCount: 1,
    facilityKind: 'gurudwara',
    style: POINT(PALETTE.religious),
    popupFields: RELIGIOUS_FIELDS,
    searchField: 'label',
  }),
  category('masjid', 'Masjids', 45, {
    category: 'religious',
    description: 'Masjids recorded in the city survey.',
    order: 144,
    verifiedFeatureCount: 13,
    facilityKind: 'mosque',
    style: POINT(PALETTE.religious),
    popupFields: RELIGIOUS_FIELDS,
    searchField: 'label',
  }),

  // --- Youth services & recreation ----------------------------------------
  category('youth-services', 'Youth services & sports', 47, {
    category: 'youth-recreation',
    description: 'Playgrounds, stadia, clubs and sports associations.',
    order: 146,
    verifiedFeatureCount: 38,
    style: POINT(PALETTE.recreation),
    popupFields: [
      { field: 'label', label: 'Facility' },
      { field: 'category', label: 'Type' },
      { field: 'location', label: 'Location' },
      { field: 'ward', label: 'Ward' },
    ],
    searchField: 'label',
  }),
  category('park', 'Parks', 48, {
    category: 'youth-recreation',
    description: 'Parks and public gardens.',
    order: 146,
    verifiedFeatureCount: 26,
    facilityKind: 'park',
    style: POINT(PALETTE.vegetation),
    popupFields: [{ field: 'name', label: 'Park' }],
    searchField: 'name',
  }),

  // --- Tourism ------------------------------------------------------------
  category('asi-monument', 'ASI protected monuments', 50, {
    category: 'tourism',
    description: 'Monuments protected by the Archaeological Survey of India.',
    order: 150,
    verifiedFeatureCount: 24,
    facilityKind: 'monument',
    style: POINT(PALETTE.tourism, 5),
    popupFields: HERITAGE_FIELDS,
    searchField: 'Name_of_Monument_Precinct',
  }),
  category('state-archaeology', 'State protected monuments', 51, {
    category: 'tourism',
    description: 'Monuments protected by the State Archaeology department.',
    order: 150,
    verifiedFeatureCount: 25,
    facilityKind: 'monument',
    style: POINT(PALETTE.tourism, 5),
    popupFields: HERITAGE_FIELDS,
    searchField: 'Name_of_Monument_Precinct',
  }),
  category('heritage-other', 'Other heritage properties', 52, {
    category: 'tourism',
    description: 'Heritage properties recorded outside the ASI and state lists.',
    order: 149,
    verifiedFeatureCount: 99,
    facilityKind: 'monument',
    style: POINT(PALETTE.tourism, 3),
    popupFields: HERITAGE_FIELDS,
    searchField: 'Name_of_Monument_Precinct',
  }),
  category('ekamra-walks', 'Ekamra Walks route', 53, {
    category: 'tourism',
    description: 'Published heritage walking route through the old city.',
    order: 148,
    verifiedFeatureCount: 2,
    style: { color: PALETTE.tourism, weight: 2.5, fillOpacity: 0, dashArray: '5 3' },
  }),
  category('ekamra-kshetra', 'Ekamra Kshetra heritage district', 54, {
    category: 'tourism',
    description: 'Boundary of the Ekamra Kshetra heritage district.',
    order: 147,
    verifiedFeatureCount: 1,
    style: { color: PALETTE.tourism, weight: 1.4, fillColor: PALETTE.tourism, fillOpacity: 0.06 },
    popupFields: [{ field: 'heritage_zone', label: 'Heritage zone' }],
    searchField: 'heritage_zone',
  }),

  // --- Transportation -----------------------------------------------------
  category('airport-terminal', 'Airport', 56, {
    category: 'transportation',
    description: 'Biju Patnaik International Airport terminal location.',
    order: 152,
    verifiedFeatureCount: 1,
    facilityKind: 'transport',
    style: POINT(PALETTE.transit, 6),
    popupFields: [{ field: 'Name_of_the_Place', label: 'Airport' }],
    searchField: 'Name_of_the_Place',
  }),
  category('railway-station', 'Railway stations', 57, {
    category: 'transportation',
    description: 'Railway stations and halts within the city.',
    order: 152,
    verifiedFeatureCount: 6,
    facilityKind: 'transport',
    style: POINT(PALETTE.transit, 5),
    popupFields: [{ field: 'name_loc', label: 'Station' }],
    searchField: 'name_loc',
  }),

  // --- Utility ------------------------------------------------------------
  category('stormwater-plant', 'Stormwater treatment plants', 58, {
    category: 'utility',
    description: 'Proposed and existing stormwater treatment plant sites.',
    caveat:
      'Site locations only. The source publishes no capacity, flow or operating state for these plants.',
    order: 142,
    verifiedFeatureCount: 12,
    style: POINT(PALETTE.water, 5),
    // `landuse` and `category` hold one constant value each across all 12
    // records, so only the village name carries information.
    popupFields: [{ field: 'village_name', label: 'Village' }],
    searchField: 'village_name',
  }),

  // --- Parking ------------------------------------------------------------
  // Published as one sublayer per municipal zone. Kept separate so a zone can be
  // isolated, which is how BMC's own parking administration is organised.
  {
    id: 'parking-north',
    label: 'Parking lots — North zone',
    category: 'parking',
    kind: 'vector',
    dataClass: 'reference',
    description: 'BMC parking lots in the North zone, with plot and auction status.',
    caveat:
      'Parking lot inventory. Carries no live occupancy, space availability or vehicle count.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 128,
    verifiedFeatureCount: 21,
    facilityKind: 'parking',
    source: { protocol: 'arcgis', service: 'BMCParkingLots', serviceType: 'MapServer', sublayers: [1] },
    style: { color: PALETTE.parking, weight: 1, fillColor: PALETTE.parking, fillOpacity: 0.18 },
    popupFields: PARKING_FIELDS,
    searchField: 'Location',
  },
  {
    id: 'parking-south-east',
    label: 'Parking lots — South East zone',
    category: 'parking',
    kind: 'vector',
    dataClass: 'reference',
    description: 'BMC parking lots in the South East zone, with plot and auction status.',
    caveat:
      'Parking lot inventory. Carries no live occupancy, space availability or vehicle count.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 128,
    verifiedFeatureCount: 74,
    facilityKind: 'parking',
    source: { protocol: 'arcgis', service: 'BMCParkingLots', serviceType: 'MapServer', sublayers: [2] },
    style: { color: PALETTE.parking, weight: 1, fillColor: PALETTE.parking, fillOpacity: 0.18 },
    popupFields: PARKING_FIELDS,
    searchField: 'Location',
  },
  {
    id: 'parking-south-west',
    label: 'Parking lots — South West zone',
    category: 'parking',
    kind: 'vector',
    dataClass: 'reference',
    description: 'BMC parking lots in the South West zone, with plot and auction status.',
    caveat:
      'Parking lot inventory. Carries no live occupancy, space availability or vehicle count.',
    defaultVisible: false,
    defaultOpacity: 0.9,
    order: 128,
    verifiedFeatureCount: 39,
    facilityKind: 'parking',
    source: { protocol: 'arcgis', service: 'BMCParkingLots', serviceType: 'MapServer', sublayers: [3] },
    style: { color: PALETTE.parking, weight: 1, fillColor: PALETTE.parking, fillOpacity: 0.18 },
    // This sublayer misspells the rate-chart column as `RateChat`, so the shared
    // field set is reused as-is and the column is simply not published.
    popupFields: PARKING_FIELDS,
    searchField: 'Location',
  },
];
