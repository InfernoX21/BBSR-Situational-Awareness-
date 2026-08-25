/**
 * Geodesic helpers for routing.
 *
 * Small on purpose. Everything here is either an exact spherical formula
 * (haversine) or a local flat-earth approximation whose error at city scale is
 * well under the accuracy of the source geometry itself — Bhubaneswar spans
 * roughly 25 km, where an equirectangular projection about the local latitude is
 * accurate to a few centimetres per kilometre. That matters because these
 * functions decide which road a vehicle snaps to, and a metre of error there is
 * the difference between the correct street and the service lane beside it.
 */

import type { GISBounds } from '../gis/types';
import type { LatLng } from './types';

/** IUGG mean Earth radius, the same value used for haversine everywhere here. */
export const EARTH_RADIUS_M = 6371008.8;

const DEG = Math.PI / 180;

/** Metres per degree of latitude on the sphere above. */
export const M_PER_DEG_LAT = EARTH_RADIUS_M * DEG;

/** Metres per degree of longitude at a given latitude. */
export function mPerDegLng(lat: number): number {
  return M_PER_DEG_LAT * Math.cos(lat * DEG);
}

/** Great-circle distance in metres. */
export function haversineM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (bLat - aLat) * DEG;
  const dLng = (bLng - aLng) * DEG;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(aLat * DEG) * Math.cos(bLat * DEG) * sinLng * sinLng;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function distanceBetween(a: LatLng, b: LatLng): number {
  return haversineM(a.lat, a.lng, b.lat, b.lng);
}

/** Summed haversine length of a `[lat, lng]` polyline. */
export function polylineLengthM(coordinates: readonly [number, number][]): number {
  let total = 0;
  for (let i = 1; i < coordinates.length; i += 1) {
    total += haversineM(coordinates[i - 1][0], coordinates[i - 1][1], coordinates[i][0], coordinates[i][1]);
  }
  return total;
}

export interface Projection {
  /** Closest point on the segment. */
  lat: number;
  lng: number;
  /** Distance from the query point to that closest point, in metres. */
  distanceM: number;
  /** Position along the segment, 0 at A and 1 at B. */
  t: number;
}

/**
 * Project a point onto the segment A→B.
 *
 * Works in local metres about A's latitude so the perpendicular is a real
 * perpendicular; doing this in raw degrees would bias every snap eastward,
 * because a degree of longitude here is only ~94% of a degree of latitude.
 */
export function projectOnSegment(
  pLat: number,
  pLng: number,
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): Projection {
  const kx = mPerDegLng((aLat + bLat) / 2);
  const ky = M_PER_DEG_LAT;

  const ax = 0;
  const ay = 0;
  const bx = (bLng - aLng) * kx;
  const by = (bLat - aLat) * ky;
  const px = (pLng - aLng) * kx;
  const py = (pLat - aLat) * ky;

  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;

  let t = lenSq === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / lenSq;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;

  const lat = aLat + (bLat - aLat) * t;
  const lng = aLng + (bLng - aLng) * t;

  return { lat, lng, t, distanceM: haversineM(pLat, pLng, lat, lng) };
}

/** Shortest distance from a point to a polyline, in metres. */
export function distanceToPolylineM(
  pLat: number,
  pLng: number,
  coordinates: readonly [number, number][],
): number {
  if (coordinates.length === 0) return Number.POSITIVE_INFINITY;
  if (coordinates.length === 1) return haversineM(pLat, pLng, coordinates[0][0], coordinates[0][1]);

  let best = Number.POSITIVE_INFINITY;
  for (let i = 1; i < coordinates.length; i += 1) {
    const p = projectOnSegment(
      pLat,
      pLng,
      coordinates[i - 1][0],
      coordinates[i - 1][1],
      coordinates[i][0],
      coordinates[i][1],
    );
    if (p.distanceM < best) best = p.distanceM;
  }
  return best;
}

/** Bounding box covering the given points, grown by `padM` metres on all sides. */
export function boundsAround(points: readonly LatLng[], padM: number): GISBounds {
  let south = Number.POSITIVE_INFINITY;
  let north = Number.NEGATIVE_INFINITY;
  let west = Number.POSITIVE_INFINITY;
  let east = Number.NEGATIVE_INFINITY;

  for (const p of points) {
    if (p.lat < south) south = p.lat;
    if (p.lat > north) north = p.lat;
    if (p.lng < west) west = p.lng;
    if (p.lng > east) east = p.lng;
  }

  const padLat = padM / M_PER_DEG_LAT;
  const midLat = (south + north) / 2;
  const padLng = padM / Math.max(1, mPerDegLng(midLat));

  return {
    south: south - padLat,
    north: north + padLat,
    west: west - padLng,
    east: east + padLng,
  };
}

/** True when `inner` lies entirely inside `outer`. */
export function boundsContain(outer: GISBounds, inner: GISBounds): boolean {
  return (
    outer.south <= inner.south &&
    outer.north >= inner.north &&
    outer.west <= inner.west &&
    outer.east >= inner.east
  );
}

/** Stable cache key for a bbox, rounded to ~100 m so near-identical asks share. */
export function boundsKey(bounds: GISBounds): string {
  const r = (v: number) => v.toFixed(3);
  return `${r(bounds.south)},${r(bounds.west)},${r(bounds.north)},${r(bounds.east)}`;
}
