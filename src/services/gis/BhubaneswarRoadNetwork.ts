/**
 * BhubaneswarOne road network — line geometry for routing, not cartography.
 *
 * The base GIS catalogue already carries a `road-network` layer, and it is a
 * server-rendered image. That is correct for a map backdrop and useless for
 * routing: you cannot path-find through a PNG. This module is the other half —
 * the same city data pulled as connected polylines with classification and
 * length, which `RoadGraph` turns into nodes and edges.
 *
 * Everything here was verified against the live service:
 *
 *   CityMap/MapServer/6 is a *group* layer ("Road Network") and rejects /query.
 *   Its five queryable polyline children are the actual data:
 *
 *     7  Flyover              42 segments
 *     8  National Highway    456 segments
 *     9  State Highway        76 segments
 *    10  Major Road        2,251 segments
 *    11  Link Road        30,431 segments
 *
 * Published fields: OBJECTID, street, location, category, typei, branchesi,
 * ward_numb, Cost, Highway_no, Shape_Length. The service supports pagination
 * (`supportsPagination: true`) and GeoJSON output, is keyless and CORS-enabled.
 *
 * Two limits are declared rather than hidden, because pretending otherwise would
 * put a wrong route in front of an operator:
 *
 * - NO TRAVEL DIRECTION. There is no oneway field. `typei` and `branchesi` are
 *   undocumented small integers (0/2, and 0/2/3/4) with no published meaning, so
 *   ARKA will not guess that either encodes direction. `publishesDirection` is
 *   false and the graph is undirected; the routing UI must disclose that one-way
 *   restrictions are not modelled.
 * - NO SPEED LIMIT. No speed or free-flow field exists. Travel time therefore
 *   cannot be computed from published data, and the engine must not invent one.
 *
 * There is also no Network Analysis service on this deployment — the folder's
 * only GPServer is `ExportWebMap` — so `hasServerRoutingEngine` is false and
 * pathfinding happens locally.
 *
 * Connectivity was measured, not assumed: in a 3 km sample, 1,084 of 1,279
 * distinct segment endpoints are shared by two or more segments, endpoints
 * coincide exactly at 6 decimal places, and 98.8% of nodes across an 11 km
 * corridor fall into a single connected component. The dataset is already noded,
 * which is what makes graph routing possible without geometric snapping of every
 * vertex.
 */

import type {
  CityRoadNetworkSource,
  GISBounds,
  RoadClassDef,
  RoadNetworkFetchResult,
  RoadSegmentRecord,
} from './types';

/** Same services folder the rest of the provider uses. */
const SERVICE_ROOT = 'https://bhubaneswarone.in/arcgis/rest/services/BhubaneswarOne';
const ROAD_SERVICE = 'CityMap/MapServer';

const ATTRIBUTION = 'Road network: BhubaneswarOne (BMC / BDA / BSCL) — CityMap';
const DATASET_LABEL = 'BhubaneswarOne CityMap road network';

/** Service-enforced cap. Paging past it needs `resultOffset`. */
const PAGE_SIZE = 1000;

/** Hard ceiling on paging, so one bad bbox cannot issue 200 requests. */
const MAX_PAGES_PER_CLASS = 30;

const REQUEST_TIMEOUT_MS = 25_000;

/**
 * The five queryable children of sublayer 6, ranked by capacity.
 *
 * `cityWide` marks the classes small enough to fetch whole and keep: 2,825
 * arterial segments is one modest request set and gives the router a permanent
 * long-distance skeleton. Link Road at 30,431 segments is not — it is fetched
 * per corridor.
 */
const ROAD_CLASSES: readonly (RoadClassDef & { sublayer: number })[] = [
  {
    id: 'national-highway',
    label: 'National Highway',
    sublayer: 8,
    rank: 1,
    verifiedSegmentCount: 456,
    cityWide: true,
  },
  {
    id: 'state-highway',
    label: 'State Highway',
    sublayer: 9,
    rank: 2,
    verifiedSegmentCount: 76,
    cityWide: true,
  },
  {
    id: 'flyover',
    label: 'Flyover',
    sublayer: 7,
    rank: 2,
    verifiedSegmentCount: 42,
    cityWide: true,
  },
  {
    id: 'major-road',
    label: 'Major Road',
    sublayer: 10,
    rank: 3,
    verifiedSegmentCount: 2251,
    cityWide: true,
  },
  {
    id: 'link-road',
    label: 'Link Road',
    sublayer: 11,
    rank: 4,
    verifiedSegmentCount: 30431,
    cityWide: false,
  },
];

/** Only the fields ARKA uses. Keeps the payload down on a 30k-row layer. */
const OUT_FIELDS = 'OBJECTID,street,category,Shape_Length';

export class RoadNetworkRequestError extends Error {
  readonly classId: string;

  constructor(message: string, classId: string) {
    super(message);
    this.name = 'RoadNetworkRequestError';
    this.classId = classId;
  }
}

/** Compose an external abort signal with a timeout. */
function withTimeout(signal: AbortSignal | undefined, ms: number): { signal: AbortSignal; done: () => void } {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`Road network request timed out after ${ms}ms`)), ms);

  const onAbort = () => controller.abort(signal?.reason);
  if (signal) {
    if (signal.aborted) onAbort();
    else signal.addEventListener('abort', onAbort, { once: true });
  }

  return {
    signal: controller.signal,
    done: () => {
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    },
  };
}

function isFiniteLatLng(lat: unknown, lng: unknown): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export class BhubaneswarRoadNetwork implements CityRoadNetworkSource {
  readonly datasetLabel = DATASET_LABEL;
  readonly attribution = ATTRIBUTION;

  /**
   * No oneway/direction attribute is published. See the module header: `typei`
   * and `branchesi` are undocumented, and ARKA will not infer a legal traffic
   * restriction from an unlabelled integer.
   */
  readonly publishesDirection = false;

  /** No speed or free-flow field exists on any of the five road classes. */
  readonly publishesSpeedLimit = false;

  /** The folder's only GPServer is ExportWebMap; there is no NAServer. */
  readonly hasServerRoutingEngine = false;

  listClasses(): RoadClassDef[] {
    return ROAD_CLASSES.map(({ sublayer: _sublayer, ...rest }) => ({ ...rest })).sort((a, b) => a.rank - b.rank);
  }

  async fetchSegments(
    options: {
      bounds?: GISBounds;
      classIds?: string[];
      signal?: AbortSignal;
      maxSegments?: number;
    } = {},
  ): Promise<RoadNetworkFetchResult> {
    const wanted = options.classIds
      ? ROAD_CLASSES.filter((c) => options.classIds?.includes(c.id))
      : [...ROAD_CLASSES];

    if (wanted.length === 0) {
      return { segments: [], truncated: false, classIds: [], fetchedAt: new Date().toISOString() };
    }

    const budget = options.maxSegments ?? Number.POSITIVE_INFINITY;
    const segments: RoadSegmentRecord[] = [];
    const classIds: string[] = [];
    let truncated = false;

    // Sequential, one class at a time, highest capacity first. Two reasons: the
    // arterial classes are what a long route actually needs, so if the budget
    // runs out it should run out on lanes; and firing five concurrent paged
    // sweeps at a municipal ArcGIS box is not neighbourly.
    for (const cls of wanted.sort((a, b) => a.rank - b.rank)) {
      if (segments.length >= budget) {
        truncated = true;
        break;
      }

      const result = await this.fetchClass(cls, options.bounds, options.signal, budget - segments.length);
      if (result.segments.length > 0) classIds.push(cls.id);
      segments.push(...result.segments);
      if (result.truncated) truncated = true;
    }

    return { segments, truncated, classIds, fetchedAt: new Date().toISOString() };
  }

  // --- Internals ---------------------------------------------------------

  private async fetchClass(
    cls: RoadClassDef & { sublayer: number },
    bounds: GISBounds | undefined,
    signal: AbortSignal | undefined,
    budget: number,
  ): Promise<{ segments: RoadSegmentRecord[]; truncated: boolean }> {
    const segments: RoadSegmentRecord[] = [];
    let offset = 0;

    for (let page = 0; page < MAX_PAGES_PER_CLASS; page += 1) {
      const url = this.queryUrl(cls.sublayer, bounds, offset);
      const body = await this.fetchGeoJson(url, signal, cls.id);
      const features = Array.isArray(body.features) ? body.features : [];

      for (const feature of features) {
        const record = this.toSegment(feature, cls.id);
        if (record) segments.push(record);
        if (segments.length >= budget) {
          // Budget exhausted mid-page: everything after this is unfetched, so
          // the caller must be told the network is a subset.
          return { segments, truncated: true };
        }
      }

      // A short page is the end of the layer. `exceededTransferLimit` is set by
      // this deployment on paged JSON queries, but a length check is the signal
      // that holds for GeoJSON too.
      if (features.length < PAGE_SIZE) return { segments, truncated: false };
      offset += PAGE_SIZE;
    }

    // Ran out of pages before running out of data.
    return { segments, truncated: true };
  }

  private queryUrl(sublayer: number, bounds: GISBounds | undefined, offset: number): string {
    const params = new URLSearchParams({
      where: '1=1',
      outFields: OUT_FIELDS,
      returnGeometry: 'true',
      outSR: '4326',
      resultOffset: String(offset),
      resultRecordCount: String(PAGE_SIZE),
      f: 'geojson',
    });

    if (bounds) {
      params.set(
        'geometry',
        JSON.stringify({
          xmin: bounds.west,
          ymin: bounds.south,
          xmax: bounds.east,
          ymax: bounds.north,
          spatialReference: { wkid: 4326 },
        }),
      );
      params.set('geometryType', 'esriGeometryEnvelope');
      params.set('inSR', '4326');
      params.set('spatialRel', 'esriSpatialRelIntersects');
    }

    // `query` only — this module has no code path that can issue an edit.
    return `${SERVICE_ROOT}/${ROAD_SERVICE}/${sublayer}/query?${params.toString()}`;
  }

  private async fetchGeoJson(
    url: string,
    signal: AbortSignal | undefined,
    classId: string,
  ): Promise<{ features?: unknown[] }> {
    const { signal: composed, done } = withTimeout(signal, REQUEST_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(url, { signal: composed, credentials: 'omit', mode: 'cors' });
    } catch (cause) {
      done();
      if (signal?.aborted) throw cause;
      const reason = cause instanceof Error ? cause.message : String(cause);
      throw new RoadNetworkRequestError(`Road network unreachable: ${reason}`, classId);
    }

    try {
      if (!response.ok) {
        throw new RoadNetworkRequestError(
          `Road network returned HTTP ${response.status} ${response.statusText}`,
          classId,
        );
      }

      let body: unknown;
      try {
        body = await response.json();
      } catch {
        throw new RoadNetworkRequestError('Road network returned a response that was not valid JSON.', classId);
      }

      // ArcGIS answers HTTP 200 with an error body. Surface it as a failure
      // rather than as an empty network — an empty network would silently become
      // "no route exists".
      const asError = body as { error?: { message?: string; details?: string[] } };
      if (asError?.error) {
        const detail = asError.error.details?.join(' ') ?? '';
        throw new RoadNetworkRequestError(
          `Road network error: ${asError.error.message ?? 'unspecified'}${detail ? ` — ${detail}` : ''}`,
          classId,
        );
      }

      return body as { features?: unknown[] };
    } finally {
      done();
    }
  }

  /**
   * Convert one GeoJSON feature into a segment record.
   *
   * Vertices are copied through unchanged. Nothing is resampled, densified or
   * smoothed: the drawn route has to be the city's own geometry, and any
   * transformation here would make that untrue further down the pipeline.
   */
  private toSegment(feature: unknown, classId: string): RoadSegmentRecord | null {
    const f = feature as {
      id?: unknown;
      properties?: Record<string, unknown>;
      geometry?: { type?: string; coordinates?: unknown };
    };

    const geometry = f?.geometry;
    if (!geometry || (geometry.type !== 'LineString' && geometry.type !== 'MultiLineString')) return null;

    // MultiLineString parts are separate runs of road. Flattening them would
    // invent a connection across the gap, so only the first part is kept and the
    // rest are dropped — the source publishes 100% LineString in every sample
    // taken, so this path is defensive rather than load-bearing.
    const raw = geometry.type === 'LineString' ? geometry.coordinates : (geometry.coordinates as unknown[])?.[0];
    if (!Array.isArray(raw)) return null;

    const coordinates: [number, number][] = [];
    for (const pair of raw) {
      if (!Array.isArray(pair) || pair.length < 2) continue;
      const [lng, lat] = pair as [unknown, unknown];
      if (!isFiniteLatLng(lat, lng)) continue;
      const point: [number, number] = [lat as number, lng as number];
      const prev = coordinates[coordinates.length - 1];
      // Drop exact repeats; a zero-length step would add a graph edge of no
      // length and no meaning.
      if (prev && prev[0] === point[0] && prev[1] === point[1]) continue;
      coordinates.push(point);
    }

    if (coordinates.length < 2) return null;

    const props = f.properties ?? {};
    const objectId = props.OBJECTID ?? f.id;
    const street = typeof props.street === 'string' && props.street.trim() ? props.street.trim() : null;
    const published = typeof props.Shape_Length === 'number' && Number.isFinite(props.Shape_Length)
      ? props.Shape_Length
      : null;

    return {
      id: `${classId}:${objectId ?? coordinates[0].join(',')}`,
      classId,
      street,
      coordinates,
      publishedLengthM: published,
    };
  }
}

/** Shared instance. Stateless, so one is enough. */
export const bhubaneswarRoadNetwork = new BhubaneswarRoadNetwork();
