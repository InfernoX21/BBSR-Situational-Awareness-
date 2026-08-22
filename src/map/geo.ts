/**
 * Geometry helpers for the MapLibre overlays.
 *
 * MapLibre draws GeoJSON, so shapes Leaflet used to generate for us (circles,
 * radii) have to be produced as real polygons here. All functions are pure and
 * take/return [lng, lat] pairs in GeoJSON order.
 */

export type LngLat = [number, number];

const EARTH_RADIUS_M = 6371008.8;

/** Great-circle distance in metres between two [lng, lat] points. */
export function haversineMeters(a: LngLat, b: LngLat): number {
  const toRad = Math.PI / 180;
  const dLat = (b[1] - a[1]) * toRad;
  const dLng = (b[0] - a[0]) * toRad;
  const lat1 = a[1] * toRad;
  const lat2 = b[1] * toRad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Cumulative length in metres along a path of [lng, lat] points. */
export function pathLengthMeters(points: LngLat[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineMeters(points[i - 1], points[i]);
  }
  return total;
}

/**
 * A geodesic circle as a closed polygon ring, used for incident buffers,
 * fire-station coverage, drone coverage and the weather radar footprint.
 */
export function circlePolygon(
  center: LngLat,
  radiusMeters: number,
  steps = 64
): LngLat[] {
  const [lng, lat] = center;
  const latRad = (lat * Math.PI) / 180;
  const dLat = (radiusMeters / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.max(Math.cos(latRad), 1e-6);
  const ring: LngLat[] = [];
  for (let i = 0; i <= steps; i++) {
    const theta = (i / steps) * 2 * Math.PI;
    ring.push([lng + dLng * Math.cos(theta), lat + dLat * Math.sin(theta)]);
  }
  return ring;
}

/** "820 m" / "3.45 km" — operator-readable distance. */
export function formatDistance(meters: number): string {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

/** "20.2961° N, 85.8245° E" — signed decimal degrees with hemispheres. */
export function formatLatLng(lat: number, lng: number, dp = 4): string {
  const ns = lat >= 0 ? 'N' : 'S';
  const ew = lng >= 0 ? 'E' : 'W';
  return `${Math.abs(lat).toFixed(dp)}° ${ns}, ${Math.abs(lng).toFixed(dp)}° ${ew}`;
}

/** Compass label for a bearing in degrees (map bearing is clockwise from N). */
export function formatBearing(bearing: number): string {
  const normalized = ((bearing % 360) + 360) % 360;
  const points = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  const label = points[Math.round(normalized / 45) % 8];
  return `${Math.round(normalized)}° ${label}`;
}

/** Convert app-order [lat, lng] tuples (as stored in the datasets) to GeoJSON. */
export function toLngLatPath(path: [number, number][]): LngLat[] {
  return path.map(([lat, lng]) => [lng, lat] as LngLat);
}
