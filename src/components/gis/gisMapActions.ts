/**
 * The contract between ARKA's GIS panels and the live map.
 *
 * Every panel in this folder is deliberately Leaflet-free: clicking a theme, a
 * ward or a query result calls one of these actions, and `DigitalTwinMap` — the
 * only component that owns a map instance — carries it out. That keeps the map
 * engine replaceable and keeps the panels testable, but the operational reason is
 * simpler: there is exactly one place that can put geography on screen, so a
 * click can never quietly resolve to "opened a panel" instead of "drew the data".
 */

import type { GISHighlightTarget } from '../../services/gis/leafletGISAdapter';
import type {
  GISAttributeRow,
  GISBounds,
  GISCategory,
} from '../../services/gis/types';

/** What a panel can ask the map to do. */
export interface GISMapActions {
  /**
   * Show a layer and move the map to its data extent.
   *
   * This is the click-to-display path. Resolves once the layer is on the map, so
   * a caller can chain a highlight onto it.
   */
  activateLayer(layerId: string): Promise<void>;

  /** Hide a layer and remove it from the map. */
  deactivateLayer(layerId: string): Promise<void>;

  /**
   * Show a layer without moving the map.
   *
   * For context outlines a caller is about to fit past — the ward module switches
   * ward boundaries on, then fits to the one ward it selected, and a fit to the
   * whole layer in between would just be a wasted camera move.
   */
  ensureLayer(layerId: string): Promise<void>;

  /** Toggle a layer, fitting to its extent when it becomes visible. */
  toggleLayer(layerId: string): Promise<void>;

  /** Show or hide every layer in one theme group at once. */
  setCategoryVisible(category: GISCategory, visible: boolean): Promise<void>;

  /** Fit the map to a layer — its drawn features where possible, its published extent otherwise. */
  zoomToLayer(layerId: string): Promise<void>;

  setOpacity(layerId: string, opacity: number): void;

  /** Outline features as the current selection, optionally fitting to them. */
  highlight(targets: GISHighlightTarget[], options?: { fit?: boolean; maxZoom?: number }): void;

  clearHighlight(): void;

  /** Fit the map to a WGS84 box — a ward's precomputed bounds, say. */
  fitBounds(bounds: GISBounds, options?: { maxZoom?: number }): void;

  /** Centre the map on a coordinate. */
  flyTo(lat: number, lng: number, zoom?: number): void;

  /** Current viewport, for a query the operator expects to be scoped to what they see. */
  currentBounds(): GISBounds | null;

  /** Hide every base GIS layer. Leaves ARKA's own overlays alone. */
  hideAll(): void;

  /** Open the compact information card for a feature. */
  select(selection: GISSelection): void;
}

/**
 * A feature the operator has selected.
 *
 * `attributes` is already resolved through the provider, so the card renders only
 * what the source published. `properties` is retained for actions that need the
 * raw row rather than the labelled one.
 *
 * The layer is carried as an id and a pair of labels rather than as a
 * `GISLayerDef`, because not every selection comes from a catalogued layer —
 * the ward module selects a ward record, which is a row in a dataset rather
 * than a feature in a rendered layer. Passing labels keeps that case honest
 * instead of inventing a layer definition to satisfy a type.
 */
export interface GISSelection {
  /** Catalogue layer the feature came from, or null when it did not come from one. */
  layerId: string | null;
  /** Layer or dataset the feature came from, as published. */
  layerLabel: string;
  /** Theme group, from the catalogue. */
  themeLabel: string;
  /** Best available display name for the feature. */
  title: string;
  attributes: GISAttributeRow[];
  properties: Record<string, unknown>;
  geometry: GeoJSON.Geometry | null;
  /**
   * Where the selection came from, so the card can say so. A ward opened from the
   * ward module and a pin clicked on the map are the same shape but not the same
   * provenance.
   */
  origin: 'map' | 'ward' | 'query';
  /** Caveat the catalogue publishes for this layer, when it has one. */
  caveat?: string | null;
}

/** Metres per degree of latitude, near enough at any populated latitude. */
const METRES_PER_DEGREE_LAT = 110_574;

/** Metres per degree of longitude at the equator. */
const METRES_PER_DEGREE_LNG = 111_320;

/**
 * Box of a given radius around a point.
 *
 * Used to scope a "nearby" query. The longitude span is corrected for latitude
 * so the box is square on the ground rather than square in degrees.
 */
export function boundsAround(lat: number, lng: number, metres: number): GISBounds {
  const latSpan = metres / METRES_PER_DEGREE_LAT;
  const cos = Math.max(0.1, Math.cos((lat * Math.PI) / 180));
  const lngSpan = metres / (METRES_PER_DEGREE_LNG * cos);
  return {
    west: lng - lngSpan,
    south: lat - latSpan,
    east: lng + lngSpan,
    north: lat + latSpan,
  };
}

/**
 * Visit every readable `[lng, lat]` pair in a geometry.
 *
 * GeoJSON nests coordinates to a different depth for every geometry type, so
 * rather than switching on `type` this walks until it finds a numeric pair. A
 * geometry ARKA cannot read yields no visits rather than throwing.
 */
function eachPosition(geometry: GeoJSON.Geometry | null, visit: (lng: number, lat: number) => void): void {
  if (!geometry) return;

  const walk = (node: unknown): void => {
    if (!Array.isArray(node)) return;
    if (typeof node[0] === 'number' && typeof node[1] === 'number') {
      const [lng, lat] = node as [number, number];
      if (Number.isFinite(lat) && Number.isFinite(lng)) visit(lng, lat);
      return;
    }
    for (const child of node) walk(child);
  };

  if (geometry.type === 'GeometryCollection') {
    for (const child of geometry.geometries) walk((child as { coordinates?: unknown }).coordinates);
  } else {
    walk((geometry as { coordinates?: unknown }).coordinates);
  }
}

/**
 * Average position of a geometry's vertices.
 *
 * Not a true centroid — a polygon's vertex mean is pulled toward whichever edge
 * carries more points. It is only ever used to anchor a viewport or a nearby
 * search, never presented as a coordinate for the feature, so the approximation
 * is safe. Returns null for geometry ARKA cannot read.
 */
export function geometryCentroid(geometry: GeoJSON.Geometry | null): { lat: number; lng: number } | null {
  let sumLat = 0;
  let sumLng = 0;
  let count = 0;

  eachPosition(geometry, (lng, lat) => {
    sumLat += lat;
    sumLng += lng;
    count += 1;
  });

  if (!count) return null;
  return { lat: sumLat / count, lng: sumLng / count };
}

/**
 * Bounding box enclosing several geometries.
 *
 * Used to report the combined extent of an analysis selection — a measured fact
 * about the features the operator picked, derived from their own coordinates.
 * Returns null when none of them carry readable geometry, so the UI can say the
 * extent is unavailable instead of showing a degenerate box.
 */
export function geometryBounds(geometries: (GeoJSON.Geometry | null)[]): GISBounds | null {
  let west = Number.POSITIVE_INFINITY;
  let south = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let count = 0;

  for (const geometry of geometries) {
    eachPosition(geometry, (lng, lat) => {
      if (lng < west) west = lng;
      if (lng > east) east = lng;
      if (lat < south) south = lat;
      if (lat > north) north = lat;
      count += 1;
    });
  }

  if (!count) return null;
  return { west, south, east, north };
}
