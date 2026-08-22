/**
 * Weather — Open-Meteo Forecast API.
 *
 * Verified 2026-08-23: keyless, HTTP 200 for Bhubaneswar, returns real values
 * plus the grid elevation. Licence CC-BY 4.0; free tier is capped at 10,000
 * calls/day, 5,000/hour, 600/minute and is non-commercial.
 *
 * Everything here is either a value the provider returned or a documented
 * standard conversion (WMO 4677 code to text, degrees to compass point). No
 * field is filled in with a plausible default: a missing upstream value stays
 * null and renders as "no data".
 */

import { CITY, USER_AGENT } from '../lib/config';
import { fetchJson, num, numInRange, obj, str } from '../lib/http';
import { Feed, feedRegistry } from '../lib/cache';
import type { SourceMeta } from '../../src/shared/dataState';

export const WEATHER_SOURCE: SourceMeta = {
  provider: 'Open-Meteo Forecast API',
  kind: 'model',
  attribution: 'Weather data by Open-Meteo.com (CC-BY 4.0)',
  url: 'https://open-meteo.com/',
  note: 'Numerical forecast model interpolated to the city centre, refreshed every 15 minutes. Not an IMD observation.',
  cadenceSeconds: 900,
};

export interface WeatherReading {
  observedAt: string | null;
  temperatureC: number | null;
  apparentTemperatureC: number | null;
  humidityPct: number | null;
  /** Accumulation over `precipitationIntervalSeconds`, as the provider reports it. */
  precipitationMm: number | null;
  precipitationIntervalSeconds: number | null;
  /** Derived: accumulation scaled to an hourly rate. Disclosed as derived in the UI. */
  precipitationRateMmPerHour: number | null;
  rainMm: number | null;
  weatherCode: number | null;
  weatherText: string | null;
  cloudCoverPct: number | null;
  pressureHpa: number | null;
  windSpeedKmh: number | null;
  windGustKmh: number | null;
  windDirectionDeg: number | null;
  windDirectionLabel: string | null;
  visibilityKm: number | null;
  isDay: boolean | null;
  /** Model grid elevation in metres — replaces the previously hardcoded altitude. */
  elevationM: number | null;
  /** Grid point the provider actually answered for. */
  gridLat: number | null;
  gridLng: number | null;
}

/** WMO 4677 present-weather codes as published by Open-Meteo. */
const WMO_TEXT: Record<number, string> = {
  0: 'Clear sky',
  1: 'Mainly clear',
  2: 'Partly cloudy',
  3: 'Overcast',
  45: 'Fog',
  48: 'Depositing rime fog',
  51: 'Light drizzle',
  53: 'Moderate drizzle',
  55: 'Dense drizzle',
  56: 'Light freezing drizzle',
  57: 'Dense freezing drizzle',
  61: 'Slight rain',
  63: 'Moderate rain',
  65: 'Heavy rain',
  66: 'Light freezing rain',
  67: 'Heavy freezing rain',
  71: 'Slight snowfall',
  73: 'Moderate snowfall',
  75: 'Heavy snowfall',
  77: 'Snow grains',
  80: 'Slight rain showers',
  81: 'Moderate rain showers',
  82: 'Violent rain showers',
  85: 'Slight snow showers',
  86: 'Heavy snow showers',
  95: 'Thunderstorm',
  96: 'Thunderstorm with slight hail',
  99: 'Thunderstorm with heavy hail',
};

const COMPASS = ['N', 'NNE', 'NE', 'ENE', 'E', 'ESE', 'SE', 'SSE', 'S', 'SSW', 'SW', 'WSW', 'W', 'WNW', 'NW', 'NNW'];

function compassOf(deg: number | null): string | null {
  if (deg == null) return null;
  const normalized = ((deg % 360) + 360) % 360;
  return COMPASS[Math.round(normalized / 22.5) % 16];
}

const CURRENT_FIELDS = [
  'temperature_2m',
  'relative_humidity_2m',
  'apparent_temperature',
  'precipitation',
  'rain',
  'weather_code',
  'cloud_cover',
  'surface_pressure',
  'wind_speed_10m',
  'wind_direction_10m',
  'wind_gusts_10m',
  'visibility',
  'is_day',
].join(',');

async function fetchWeather(): Promise<WeatherReading> {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${CITY.lat}&longitude=${CITY.lng}` +
    `&current=${CURRENT_FIELDS}&timezone=Asia%2FKolkata`;

  const payload = obj(await fetchJson(url, { timeoutMs: 8000, headers: { 'User-Agent': USER_AGENT } }));
  const current = obj(payload.current);

  const precipitationMm = num(current.precipitation);
  const interval = num(current.interval);
  const visibilityM = num(current.visibility);
  const windDirectionDeg = numInRange(current.wind_direction_10m, 0, 360);
  const weatherCode = num(current.weather_code);
  const isDayRaw = num(current.is_day);

  return {
    observedAt: localTimeToIso(str(current.time), num(payload.utc_offset_seconds)),
    temperatureC: numInRange(current.temperature_2m, -90, 60),
    apparentTemperatureC: numInRange(current.apparent_temperature, -90, 80),
    humidityPct: numInRange(current.relative_humidity_2m, 0, 100),
    precipitationMm,
    precipitationIntervalSeconds: interval,
    precipitationRateMmPerHour:
      precipitationMm != null && interval != null && interval > 0
        ? round(precipitationMm * (3600 / interval), 1)
        : null,
    rainMm: num(current.rain),
    weatherCode,
    weatherText: weatherCode != null ? (WMO_TEXT[weatherCode] ?? `WMO code ${weatherCode}`) : null,
    cloudCoverPct: numInRange(current.cloud_cover, 0, 100),
    pressureHpa: numInRange(current.surface_pressure, 300, 1100),
    windSpeedKmh: numInRange(current.wind_speed_10m, 0, 500),
    windGustKmh: numInRange(current.wind_gusts_10m, 0, 600),
    windDirectionDeg,
    windDirectionLabel: compassOf(windDirectionDeg),
    visibilityKm: visibilityM != null ? round(visibilityM / 1000, 1) : null,
    isDay: isDayRaw == null ? null : isDayRaw === 1,
    elevationM: num(payload.elevation),
    gridLat: num(payload.latitude),
    gridLng: num(payload.longitude),
  };
}

/**
 * Open-Meteo returns a local wall-clock string plus the offset it applied.
 * Convert to a real instant so age calculations are correct.
 */
function localTimeToIso(local: string | null, offsetSeconds: number | null): string | null {
  if (!local) return null;
  const offset = offsetSeconds ?? 0;
  const sign = offset < 0 ? '-' : '+';
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 3600)).padStart(2, '0');
  const mm = String(Math.floor((abs % 3600) / 60)).padStart(2, '0');
  const withSeconds = /\d{2}:\d{2}:\d{2}$/.test(local) ? local : `${local}:00`;
  const parsed = Date.parse(`${withSeconds}${sign}${hh}:${mm}`);
  return Number.isNaN(parsed) ? null : new Date(parsed).toISOString();
}

function round(value: number, dp: number): number {
  const f = 10 ** dp;
  return Math.round(value * f) / f;
}

export const weatherFeed = feedRegistry.register(
  new Feed<WeatherReading>({
    id: 'weather',
    label: 'Surface weather (city centre)',
    source: WEATHER_SOURCE,
    // The model itself updates every 15 min; polling faster only burns quota.
    ttlSeconds: 300,
    staleAfterSeconds: 1800,
    minIntervalSeconds: 120,
    fetch: fetchWeather,
  })
);
