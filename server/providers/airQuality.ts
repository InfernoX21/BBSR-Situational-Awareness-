/**
 * Air quality — Open-Meteo Air Quality API (Copernicus CAMS).
 *
 * Verified 2026-08-23: keyless, HTTP 200 for Bhubaneswar (us_aqi 70,
 * pm2_5 20.7 µg/m³, pm10 21.4 µg/m³).
 *
 * IMPORTANT for honest labelling: outside Europe this is the CAMS *global*
 * domain at roughly 45 km resolution — a model estimate for the grid cell, not
 * a reading from a CPCB ground monitoring station in Bhubaneswar. The UI must
 * say so, because operators will otherwise assume it is the CPCB number they
 * see quoted publicly.
 */

import { CITY, USER_AGENT } from '../lib/config';
import { fetchJson, num, obj, str } from '../lib/http';
import { Feed, feedRegistry } from '../lib/cache';
import type { SourceMeta } from '../../src/shared/dataState';

export const AIR_SOURCE: SourceMeta = {
  provider: 'Open-Meteo Air Quality (Copernicus CAMS)',
  kind: 'model',
  attribution: 'Air quality data from Copernicus CAMS via Open-Meteo.com (CC-BY 4.0)',
  url: 'https://open-meteo.com/en/docs/air-quality-api',
  note: 'CAMS global model, ~45 km grid cell. Modelled estimate — not a CPCB ground-station measurement.',
  cadenceSeconds: 3600,
};

export interface AirQualityReading {
  observedAt: string | null;
  usAqi: number | null;
  /** US EPA category for the reported index, using the published breakpoints. */
  usAqiCategory: string | null;
  pm25: number | null;
  pm10: number | null;
  nitrogenDioxide: number | null;
  sulphurDioxide: number | null;
  ozone: number | null;
  carbonMonoxide: number | null;
  gridLat: number | null;
  gridLng: number | null;
}

/** US EPA AQI categories (40 CFR Part 58, Appendix G breakpoints). */
function usAqiCategory(aqi: number | null): string | null {
  if (aqi == null) return null;
  if (aqi <= 50) return 'Good';
  if (aqi <= 100) return 'Moderate';
  if (aqi <= 150) return 'Unhealthy for sensitive groups';
  if (aqi <= 200) return 'Unhealthy';
  if (aqi <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

const FIELDS = [
  'pm2_5',
  'pm10',
  'us_aqi',
  'nitrogen_dioxide',
  'sulphur_dioxide',
  'ozone',
  'carbon_monoxide',
].join(',');

async function fetchAirQuality(): Promise<AirQualityReading> {
  const url =
    `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${CITY.lat}&longitude=${CITY.lng}` +
    `&current=${FIELDS}&timezone=Asia%2FKolkata`;

  const payload = obj(await fetchJson(url, { timeoutMs: 8000, headers: { 'User-Agent': USER_AGENT } }));
  const current = obj(payload.current);
  const usAqi = num(current.us_aqi);

  return {
    observedAt: isoFromLocal(str(current.time), num(payload.utc_offset_seconds)),
    usAqi,
    usAqiCategory: usAqiCategory(usAqi),
    pm25: num(current.pm2_5),
    pm10: num(current.pm10),
    nitrogenDioxide: num(current.nitrogen_dioxide),
    sulphurDioxide: num(current.sulphur_dioxide),
    ozone: num(current.ozone),
    carbonMonoxide: num(current.carbon_monoxide),
    gridLat: num(payload.latitude),
    gridLng: num(payload.longitude),
  };
}

function isoFromLocal(local: string | null, offsetSeconds: number | null): string | null {
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

export const airQualityFeed = feedRegistry.register(
  new Feed<AirQualityReading>({
    id: 'air-quality',
    label: 'Air quality (modelled)',
    source: AIR_SOURCE,
    // CAMS global updates twice daily and the API exposes hourly steps.
    ttlSeconds: 900,
    staleAfterSeconds: 7200,
    minIntervalSeconds: 300,
    fetch: fetchAirQuality,
  })
);
