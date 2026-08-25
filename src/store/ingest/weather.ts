/**
 * Weather ingestion.
 *
 * One city-scale observation, from `/api/weather/live`, which proxies Open-Meteo
 * for the Bhubaneswar city centre. The record is a *model* reading, not an
 * instrument in a ward, and the source note says so — a gridded forecast value
 * and a rain gauge on Janpath are different claims about the world.
 *
 * `floodRiskLevel` deserves a word. It is derived by the server from measured
 * precipitation, not issued by OSDMA or IMD. That derivation is real, but an
 * operator must not read it as an official warning, so every event this feed
 * emits names the measurement it came from in `sourceSignals` and says in the
 * detail that it is a derived indicator. The measurement is data; the threshold
 * is ARKA's.
 */

import type { DataError, SourceMeta } from '../../shared/dataState';
import type { Severity, WeatherData } from '../../types';
import { arkaStore } from '../ArkaStore';
import type { EntityHealth, WeatherEntity } from '../entities';
import type { ArkaEventInput } from '../events';
import { toneForSeverity } from '../events';
import type { FeedDefinition, FeedOutcome } from '../transport';
import { asRecord, dataStateOf, isoOr, num, oneOf, str } from './coerce';
import { ChangeTracker } from './transitions';

export const WEATHER_FEED_ID = 'weather';

/** One record: the city. Stable so every module can link to the same observation. */
export const WEATHER_ENTITY_ID = 'bhubaneswar-city';

/** The point the forecast is retrieved for. Real configuration, not a reading. */
const CITY_CENTRE = { lat: 20.2961, lng: 85.8245 };

const WEATHER_SOURCE: SourceMeta = {
  provider: 'Open-Meteo WMO forecast mesh',
  kind: 'model',
  attribution: 'Weather data by Open-Meteo.com',
  url: 'https://open-meteo.com/',
  note: 'Gridded model output for the city centre, not a reading from an in-city instrument. Ward-level conditions may differ. Flood risk is derived by ARKA from measured precipitation, not an official OSDMA or IMD warning.',
  cadenceSeconds: 900,
};

const FLOOD_LEVELS = ['LOW', 'MODERATE', 'HIGH', 'CRITICAL'] as const;
type FloodRisk = (typeof FLOOD_LEVELS)[number];

/** Open-Meteo publishes roughly every 15 minutes; polling faster adds load, not freshness. */
const CADENCE_SECONDS = 300;

function severityForFlood(risk: FloodRisk): Severity | null {
  switch (risk) {
    case 'CRITICAL':
      return 'CRITICAL';
    case 'HIGH':
      return 'HIGH';
    case 'MODERATE':
      return 'MEDIUM';
    case 'LOW':
      // Nothing is wrong, so nothing is graded. A LOW severity badge on a clear
      // day reads as a live concern that does not exist.
      return null;
  }
}

function healthForFlood(risk: FloodRisk): EntityHealth {
  switch (risk) {
    case 'CRITICAL':
    case 'HIGH':
      return 'critical';
    case 'MODERATE':
      return 'attention';
    case 'LOW':
      return 'nominal';
  }
}

/** What changed between two ticks, for transition-only event emission. */
interface WeatherSnapshot {
  risk: FloodRisk;
  condition: string;
}

const tracker = new ChangeTracker<WeatherSnapshot>();

export function createWeatherFeed(): FeedDefinition {
  return {
    id: WEATHER_FEED_ID,
    label: 'Weather — Open-Meteo',
    source: WEATHER_SOURCE,
    cadenceSeconds: CADENCE_SECONDS,
    transports: [{ kind: 'poll', url: '/api/weather/live' }],
    handler: handleWeather,
    onUnavailable: clearWeather,
  };
}

function handleWeather(payload: unknown, ctx: { receivedAt: string }): FeedOutcome {
  const root = asRecord(payload);
  const data = asRecord(root.data);
  const provenance = asRecord(data.provenance);
  const declared = dataStateOf(provenance.classification, 'UNAVAILABLE');

  // The endpoint answers 200 with a zeroed payload when Open-Meteo is
  // unreachable, so `success` and the declared classification are the fields
  // that decide whether there is an observation here — not the HTTP status.
  if (root.success !== true || declared === 'UNAVAILABLE') {
    const reason = str(
      provenance.unavailableReason ?? root.unavailableReason,
      'The weather endpoint reported no current observation.'
    );
    clearWeather({ code: 'SOURCE_UNAVAILABLE', message: reason });
    return { count: 0, unavailable: { code: 'SOURCE_UNAVAILABLE', message: reason } };
  }

  const risk = oneOf<FloodRisk>(data.floodRiskLevel, FLOOD_LEVELS, 'LOW');
  const condition = str(data.condition, 'Not reported');
  const observedAt = isoOr(provenance.timestamp, ctx.receivedAt);

  // Passed through as sent: existing views read this payload shape, and the
  // envelope below — not this object — is what new code trusts for provenance.
  const weather: WeatherData = {
    temperature: num(data.temperature, 0),
    condition,
    humidity: num(data.humidity, 0),
    visibility: num(data.visibility, 0),
    windSpeed: num(data.windSpeed, 0),
    windDirection: str(data.windDirection, '—'),
    rainIntensity: num(data.rainIntensity, 0),
    floodRiskLevel: risk,
    forecast: str(data.forecast, ''),
    provenance: data.provenance as WeatherData['provenance'],
    connectionStatus: 'CONNECTED',
  };

  const entity: WeatherEntity = {
    id: WEATHER_ENTITY_ID,
    kind: 'weather',
    label: `Bhubaneswar — ${condition}`,
    observedAt,
    state: declared,
    source: WEATHER_SOURCE,
    position: CITY_CENTRE,
    health: healthForFlood(risk),
    severity: severityForFlood(risk),
    related: [],
    data: weather,
  };

  const events = weatherEvents(entity, { risk, condition }, observedAt, declared);

  arkaStore.batch(() => {
    arkaStore.replaceKind('weather', [entity]);
    if (events.length > 0) arkaStore.emit(events);
  });

  return { count: 1, state: declared };
}

/**
 * Emits only when the risk level or the reported condition actually changes.
 *
 * On first sight nothing is emitted for a quiet city — an operator opening the
 * console does not need "conditions are normal" in the ticker — but an elevated
 * risk is announced immediately, because arriving mid-event is exactly when that
 * matters most.
 */
function weatherEvents(
  entity: WeatherEntity,
  snapshot: WeatherSnapshot,
  observedAt: string,
  state: WeatherEntity['state']
): ArkaEventInput[] {
  const before = tracker.observe(WEATHER_ENTITY_ID, snapshot);

  const firstSight = before === undefined;
  const riskChanged = before !== undefined && before.risk !== snapshot.risk;
  const conditionChanged = before !== undefined && before.condition !== snapshot.condition;
  const notable = snapshot.risk === 'HIGH' || snapshot.risk === 'CRITICAL';

  if (firstSight ? !notable : !riskChanged && !conditionChanged) return [];

  const rain = entity.data.rainIntensity;
  const improving = before !== undefined && FLOOD_LEVELS.indexOf(snapshot.risk) < FLOOD_LEVELS.indexOf(before.risk);

  return [
    {
      // Keyed on the reading, so a re-poll of the same observation cannot
      // duplicate the entry even if the tracker is reset by a remount.
      id: `weather-${snapshot.risk}-${observedAt}`,
      at: observedAt,
      kind: 'WEATHER_ALERT',
      tone: improving && !notable ? 'resolved' : toneForSeverity(entity.severity),
      severity: entity.severity,
      title: riskChanged
        ? `Flood risk indicator ${snapshot.risk} — ${snapshot.condition}`
        : `Conditions changed to ${snapshot.condition}`,
      detail:
        `Derived flood-risk indicator: ${snapshot.risk}. This is ARKA's threshold applied to measured ` +
        `precipitation of ${rain} mm, not a warning issued by OSDMA or IMD. ` +
        `Temperature ${entity.data.temperature} °C, humidity ${entity.data.humidity} %, ` +
        `wind ${entity.data.windSpeed} km/h ${entity.data.windDirection}.`,
      provider: WEATHER_SOURCE.provider,
      state,
      subjects: [{ kind: 'weather', id: WEATHER_ENTITY_ID }],
      position: CITY_CENTRE,
      // No model reported a confidence for this, and a threshold crossing does
      // not have one. Left null rather than filled with a comfortable number.
      confidence: null,
      sourceSignals: [
        `precipitation ${rain} mm (Open-Meteo current)`,
        `condition "${snapshot.condition}"`,
        `wind ${entity.data.windSpeed} km/h`,
      ],
    },
  ];
}

/**
 * Drops the observation.
 *
 * Keeping the last reading on screen when the source has gone would leave the
 * operator looking at an hour-old temperature with a live-looking badge. The
 * weather panel renders its own "no source" state from the empty bucket.
 */
function clearWeather(_error: DataError): void {
  tracker.clear();
  if (arkaStore.getEntities().weather.length > 0) {
    arkaStore.replaceKind('weather', []);
  }
}
