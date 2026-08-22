/**
 * Hydrology — Open-Meteo Flood API (Copernicus GloFAS v4).
 *
 * Verified 2026-08-23: keyless, HTTP 200, returned a 14-day daily discharge
 * series for the grid point 20.275 N / 85.825 E.
 *
 * Honest-labelling constraints this provider imposes:
 *   - It is river *discharge* in m³/s for the largest river within about 5 km
 *     of the requested coordinate — NOT a gauge water level, and NOT an urban
 *     inundation forecast for Bhubaneswar's drains.
 *   - The grid point the provider answers for is offset from the request, so we
 *     surface that coordinate rather than implying a named local gauge.
 *   - It is a model forecast, so it must never be presented as an official
 *     Central Water Commission or OSDMA flood warning.
 */

import { CITY, USER_AGENT } from '../lib/config';
import { fetchJson, num, obj, str } from '../lib/http';
import { Feed, feedRegistry } from '../lib/cache';
import type { SourceMeta } from '../../src/shared/dataState';

export const HYDROLOGY_SOURCE: SourceMeta = {
  provider: 'Open-Meteo Flood API (Copernicus GloFAS v4)',
  kind: 'model',
  attribution: 'River discharge from Copernicus GloFAS via Open-Meteo.com (CC-BY 4.0)',
  url: 'https://open-meteo.com/en/docs/flood-api',
  note: 'Modelled daily discharge (m³/s) for the largest river within ~5 km, on a 0.05° grid. Not a gauge reading and not an official flood warning.',
  cadenceSeconds: 86400,
};

export interface DischargeDay {
  date: string;
  /** Deterministic run value. */
  dischargeM3s: number | null;
  /** Ensemble mean, forecast days only. */
  meanM3s: number | null;
  /** Ensemble maximum, forecast days only. */
  maxM3s: number | null;
  /** True when this day is in the future relative to the fetch. */
  forecast: boolean;
}

export interface RiverDischarge {
  unit: string;
  days: DischargeDay[];
  latestDate: string | null;
  latestDischargeM3s: number | null;
  /** Change against the same measure 24 h earlier, if both are present. */
  change24hM3s: number | null;
  gridLat: number | null;
  gridLng: number | null;
}

const PAST_DAYS = 7;
const FORECAST_DAYS = 7;

async function fetchDischarge(): Promise<RiverDischarge> {
  const url =
    `https://flood-api.open-meteo.com/v1/flood?latitude=${CITY.lat}&longitude=${CITY.lng}` +
    `&daily=river_discharge,river_discharge_mean,river_discharge_max` +
    `&past_days=${PAST_DAYS}&forecast_days=${FORECAST_DAYS}`;

  const payload = obj(await fetchJson(url, { timeoutMs: 10000, headers: { 'User-Agent': USER_AGENT } }));
  const daily = obj(payload.daily);
  const units = obj(payload.daily_units);

  const times = Array.isArray(daily.time) ? daily.time : [];
  const discharge = Array.isArray(daily.river_discharge) ? daily.river_discharge : [];
  const mean = Array.isArray(daily.river_discharge_mean) ? daily.river_discharge_mean : [];
  const max = Array.isArray(daily.river_discharge_max) ? daily.river_discharge_max : [];

  const todayIso = new Date().toISOString().slice(0, 10);

  const days: DischargeDay[] = [];
  for (let i = 0; i < times.length; i++) {
    const date = str(times[i], 10);
    if (!date) continue;
    days.push({
      date,
      dischargeM3s: num(discharge[i]),
      meanM3s: num(mean[i]),
      maxM3s: num(max[i]),
      forecast: date > todayIso,
    });
  }

  // "Latest" is the most recent day that is not in the future.
  const observed = days.filter((d) => !d.forecast && d.dischargeM3s != null);
  const latest = observed.length ? observed[observed.length - 1] : null;
  const previous = observed.length > 1 ? observed[observed.length - 2] : null;

  return {
    unit: str(units.river_discharge, 20) ?? 'm³/s',
    days,
    latestDate: latest?.date ?? null,
    latestDischargeM3s: latest?.dischargeM3s ?? null,
    change24hM3s:
      latest?.dischargeM3s != null && previous?.dischargeM3s != null
        ? Math.round((latest.dischargeM3s - previous.dischargeM3s) * 100) / 100
        : null,
    gridLat: num(payload.latitude),
    gridLng: num(payload.longitude),
  };
}

export const hydrologyFeed = feedRegistry.register(
  new Feed<RiverDischarge>({
    id: 'hydrology',
    label: 'River discharge (modelled)',
    source: HYDROLOGY_SOURCE,
    // GloFAS forecast is produced once a day; hourly polling is ample.
    ttlSeconds: 3600,
    staleAfterSeconds: 172800,
    minIntervalSeconds: 900,
    fetch: fetchDischarge,
  })
);
