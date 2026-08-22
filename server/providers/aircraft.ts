/**
 * Airspace — OpenSky Network REST API, anonymous access.
 *
 * Verified 2026-08-23: `GET /states/all` with the Odisha bounding box returned
 * HTTP 200 and two real aircraft states.
 *
 * Quota discipline matters here. Anonymous access is 400 credits per day per IP
 * with 10-second time resolution, so this feed is capped at one upstream call
 * every 5 minutes (about 288/day) and is shared by every browser session
 * through the Feed cache.
 *
 * OpenSky data is provided for non-commercial purposes; a municipal deployment
 * should confirm its use with OpenSky and register a client for higher quota.
 */

import { CITY, USER_AGENT } from '../lib/config';
import { arr, fetchJson, num, obj, str } from '../lib/http';
import { Feed, feedRegistry } from '../lib/cache';
import type { SourceMeta } from '../../src/shared/dataState';

export const AIRCRAFT_SOURCE: SourceMeta = {
  provider: 'OpenSky Network (community ADS-B)',
  kind: 'observation',
  attribution: 'ADS-B state vectors from The OpenSky Network, https://opensky-network.org',
  url: 'https://openskynetwork.github.io/opensky-api/rest.html',
  note: 'Crowd-sourced ADS-B receivers. Coverage is incomplete and is not an air-traffic-control feed.',
  cadenceSeconds: 300,
};

export interface AircraftState {
  icao24: string;
  callsign: string | null;
  originCountry: string | null;
  lat: number | null;
  lng: number | null;
  baroAltitudeM: number | null;
  geoAltitudeM: number | null;
  velocityKmh: number | null;
  headingDeg: number | null;
  verticalRateMs: number | null;
  onGround: boolean;
  /** Provider's last-contact instant for this aircraft. */
  lastContactAt: string | null;
}

export interface AirspaceSnapshot {
  /** Provider snapshot time. */
  snapshotAt: string | null;
  bbox: typeof CITY.bbox;
  aircraft: AircraftState[];
}

/**
 * OpenSky returns positional arrays. Indices are fixed by their API contract:
 * 0 icao24, 1 callsign, 2 origin_country, 3 time_position, 4 last_contact,
 * 5 longitude, 6 latitude, 7 baro_altitude, 8 on_ground, 9 velocity,
 * 10 true_track, 11 vertical_rate, 13 geo_altitude.
 */
function parseState(raw: unknown): AircraftState | null {
  if (!Array.isArray(raw)) return null;
  const icao24 = str(raw[0], 24);
  if (!icao24) return null;

  const velocityMs = num(raw[9]);
  const lastContact = num(raw[4]);

  return {
    icao24,
    callsign: str(raw[1], 16),
    originCountry: str(raw[2], 64),
    lng: num(raw[5]),
    lat: num(raw[6]),
    baroAltitudeM: num(raw[7]),
    onGround: raw[8] === true,
    velocityKmh: velocityMs != null ? Math.round(velocityMs * 3.6) : null,
    headingDeg: num(raw[10]),
    verticalRateMs: num(raw[11]),
    geoAltitudeM: num(raw[13]),
    lastContactAt: lastContact != null ? new Date(lastContact * 1000).toISOString() : null,
  };
}

async function fetchAirspace(): Promise<AirspaceSnapshot> {
  const { latMin, lonMin, latMax, lonMax } = CITY.bbox;
  const url =
    `https://opensky-network.org/api/states/all` +
    `?lamin=${latMin}&lomin=${lonMin}&lamax=${latMax}&lomax=${lonMax}`;

  const payload = obj(
    await fetchJson(url, { timeoutMs: 12000, headers: { 'User-Agent': USER_AGENT } })
  );

  const snapshotSeconds = num(payload.time);
  const aircraft = arr(payload.states)
    .map(parseState)
    .filter((a): a is AircraftState => a !== null)
    // A state vector with no position cannot be placed on the map.
    .filter((a) => a.lat != null && a.lng != null);

  return {
    snapshotAt: snapshotSeconds != null ? new Date(snapshotSeconds * 1000).toISOString() : null,
    bbox: CITY.bbox,
    aircraft,
  };
}

export const airspaceFeed = feedRegistry.register(
  new Feed<AirspaceSnapshot>({
    id: 'airspace',
    label: 'Airspace over Odisha (ADS-B)',
    source: AIRCRAFT_SOURCE,
    ttlSeconds: 300,
    staleAfterSeconds: 900,
    // Anonymous quota is 400 credits/day; 300 s spacing keeps us well inside it.
    minIntervalSeconds: 300,
    fetch: fetchAirspace,
  })
);
