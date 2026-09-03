/**
 * Weather and disaster risk.
 *
 * Rebuilt on the ARKA design system, and reduced to what the deployment can
 * actually observe. The city weather record arrives from `/api/weather/live`,
 * which proxies Open-Meteo's gridded model for the city-centre point; the flood
 * indicator is ARKA's own threshold applied to that model's precipitation figure.
 * Both of those facts are on the page, because "MODERATE FLOOD RISK" and "OSDMA
 * has issued a warning" are different claims and an operator must be able to tell
 * which one they are looking at.
 *
 * The observation trend is accumulated in this component from the readings that
 * arrive while the page is open. That is a real series — each point is a reading
 * the feed delivered — but it is short, it starts empty, and it is not history:
 * nothing in this build stores weather, so navigating away discards it. The panel
 * says so rather than implying a database behind it.
 *
 * Fabrications removed:
 *
 * - The entire `floodForecastData` series: six hardcoded points of Daya river
 *   level, rain-gauge reading and "InundationRisk" percentage, presented as the
 *   output of a "ConvLSTM Neural Network Time-Series Hydrological Model". No such
 *   model exists in this codebase, no river gauge is connected, and the numbers
 *   never changed regardless of the weather.
 * - The four cyclone shelters with capacities and live occupancy (1200/140,
 *   2500/0, 800/45, 600/20), all four permanently READY. There is no shelter
 *   register and no occupancy feed; the progress bars were animating fiction.
 * - "58 AQI / Good Air Quality", hardcoded. No air-quality source is configured,
 *   so the tile now states that.
 * - "Heat Index: {temperature + 3}°C". Heat index is a humidity-dependent
 *   function, not three degrees; a fabricated formula presented as a derived
 *   reading. Replaced with the apparent-temperature caveat the model supports.
 * - "IMD Radar Ingestion" and "Continuous satellite radar monitoring" in the
 *   subtitle. Nothing here touches IMD radar. The upstream `forecast` string
 *   still says something similar, so it is shown as the provider's text rather
 *   than as ARKA's own assertion.
 * - "Radar Clear" under visibility, which was a caption on a constant: the
 *   endpoint returns a fixed 8.5 km because Open-Meteo's current block does not
 *   include visibility. It is now labelled as not observed.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  CloudRain,
  Droplets,
  Eye,
  Map as MapIcon,
  Thermometer,
  Waves,
  Wind,
} from 'lucide-react';
import type { WeatherData } from '../../types';
import {
  Button,
  Chart,
  DataStateTag,
  EmptyState,
  FieldLine,
  Metric,
  MetricGrid,
  Page,
  PageBody,
  PageHeader,
  PageSection,
  Panel,
  PanelBody,
  PanelFoot,
  PanelHead,
  Provenance,
  SeverityBadge,
  StatusBadge,
  Timeline,
  TimelineItem,
  UnavailableState,
  type ChartSeries,
} from '../../ui';
import { useEntitiesOfKind, useFeed, useFilteredEvents } from '../../store/useArka';
import { EMPTY_EVENT_FILTER } from '../../store/events';
import { WEATHER_FEED_ID } from '../../store/ingest/weather';

interface WeatherDisasterViewProps {
  weather: WeatherData;
  onJumpToMap?: () => void;
}

/**
 * How the flood indicator maps onto the platform's severity language.
 *
 * LOW is deliberately unbadged. A LOW severity chip on a clear day reads as a
 * live concern that does not exist — the same rule the ingest layer follows when
 * it declines to grade a quiet city.
 */
const FLOOD_SEVERITY = {
  CRITICAL: 'CRITICAL',
  HIGH: 'HIGH',
  MODERATE: 'MEDIUM',
  LOW: null,
} as const;

/** Points kept in the in-session trend. At ~5 min cadence this is a few hours. */
const TREND_LIMIT = 48;

/** Indexed so it satisfies `ChartProps['data']`, which is deliberately open. */
interface TrendPoint extends Record<string, unknown> {
  /** Clock label for the axis. The full instant is in `at`. */
  time: string;
  at: string;
  rain: number;
  temperature: number;
  humidity: number;
}

const TREND_SERIES: readonly ChartSeries[] = [
  { key: 'rain', label: 'Precipitation (mm)', kind: 'area', color: 'var(--color-info-fill)' },
  { key: 'temperature', label: 'Temperature (°C)', kind: 'line', color: 'var(--color-accent)' },
];

/**
 * Accumulates the readings that arrive while this page is mounted.
 *
 * Keyed on the observation timestamp, so a re-poll that returns the same reading
 * does not extend the line and a StrictMode double-mount does not double it.
 */
function useObservationTrend(observedAt: string | null, weather: WeatherData | null): TrendPoint[] {
  const [points, setPoints] = useState<TrendPoint[]>([]);
  const lastAt = useRef<string | null>(null);

  useEffect(() => {
    if (!observedAt || !weather) return;
    if (lastAt.current === observedAt) return;
    lastAt.current = observedAt;
    const parsed = new Date(observedAt);
    const time = Number.isFinite(parsed.getTime())
      ? parsed.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '—';
    setPoints((previous) =>
      [
        ...previous,
        {
          time,
          at: observedAt,
          rain: weather.rainIntensity,
          temperature: weather.temperature,
          humidity: weather.humidity,
        },
      ].slice(-TREND_LIMIT),
    );
  }, [observedAt, weather]);

  return points;
}

export function WeatherDisasterView({ weather, onJumpToMap }: WeatherDisasterViewProps) {
  // The store's record is the authority on provenance; the prop is the same
  // payload delivered by `App`'s own poll and is used only as a fallback so the
  // page has something to render before the first feed tick lands.
  const entities = useEntitiesOfKind('weather');
  const entity = entities[0] ?? null;
  const feed = useFeed(WEATHER_FEED_ID);
  const reading = entity?.data ?? weather;

  const trend = useObservationTrend(entity?.observedAt ?? null, entity?.data ?? null);

  const alertFilter = useMemo(
    () => ({ ...EMPTY_EVENT_FILTER, kinds: ['WEATHER_ALERT' as const] }),
    [],
  );
  const alerts = useFilteredEvents(alertFilter);

  const risk = reading.floodRiskLevel;
  const severity = FLOOD_SEVERITY[risk];
  const state = entity?.state ?? 'FALLBACK';

  return (
    <Page>
      <PageHeader
        title="Weather and disaster risk"
        subtitle="City-centre weather observation and ARKA's derived flood-risk indicator."
        meta={
          <>
            <Provenance
              state={state}
              source={entity?.source ?? feed?.source}
              fetchedAt={entity?.observedAt}
              error={feed?.error}
            />
            <StatusBadge
              label="DERIVED INDICATOR"
              tone="info"
              hint="Flood risk is ARKA's threshold applied to the model's precipitation figure. It is not a warning issued by OSDMA or IMD, and it is not a river-gauge reading."
            />
            {severity && <SeverityBadge severity={severity} />}
          </>
        }
        actions={
          onJumpToMap && (
            <Button variant="outline" size="sm" icon={<MapIcon size={12} />} onClick={onJumpToMap}>
              Weather overlays
            </Button>
          )
        }
      />

      <PageBody>
        <MetricGrid columns={6}>
          <Metric
            label="Temperature"
            value={reading.temperature}
            unit="°C"
            icon={<Thermometer size={13} />}
            hint="Model air temperature at 2 m for the city-centre point."
          />
          <Metric
            label="Precipitation"
            value={reading.rainIntensity}
            unit="mm"
            tone={reading.rainIntensity > 10 ? 'critical' : reading.rainIntensity > 2 ? 'medium' : 'default'}
            icon={<CloudRain size={13} />}
            hint="Current precipitation from the model's current block. This figure is what the flood indicator is derived from."
          />
          <Metric
            label="Humidity"
            value={reading.humidity}
            unit="%"
            icon={<Droplets size={13} />}
          />
          <Metric
            label="Wind"
            value={reading.windSpeed}
            unit="km/h"
            icon={<Wind size={13} />}
            meta={
              <span className="ark-mono text-[10.5px]">Direction {reading.windDirection || '—'}</span>
            }
          />
          <Metric
            label="Visibility"
            value={null}
            icon={<Eye size={13} />}
            hint="Open-Meteo's current block does not publish visibility for this point, and no in-city instrument is connected."
          />
          <Metric
            label="Air quality"
            value={null}
            icon={<Activity size={13} />}
            hint="No air-quality source is configured in this deployment. Connect a CPCB or OSPCB station feed to populate this."
          />
        </MetricGrid>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-2">
          {/* --- Observation trend ------------------------------------------- */}
          <PageSection
            title="Observation trend"
            hint="This session only"
            className="lg:col-span-2"
          >
            <Panel>
              <PanelHead
                title="Precipitation and temperature"
                icon={<Waves size={13} />}
                meta={
                  <span className="ark-tag">
                    {trend.length} READING{trend.length === 1 ? '' : 'S'}
                  </span>
                }
              />
              <PanelBody>
                <Chart
                  // A single reading is not a trend: one point draws an axis pair
                  // with an invisible dot, which reads as a broken chart. Held at
                  // the empty state until there are two points to join.
                  data={trend.length < 2 ? [] : trend}
                  xKey="time"
                  series={TREND_SERIES}
                  height={216}
                  showGrid
                  showLegend
                  label="Precipitation and temperature over the readings received this session"
                  emptyTitle={trend.length === 1 ? 'One reading so far' : 'No readings yet'}
                  emptyDetail={
                    trend.length === 1
                      ? `Received ${reading.rainIntensity} mm and ${reading.temperature} °C. The line appears once a second observation arrives, roughly every five minutes.`
                      : 'The trend fills as observations arrive from the weather feed. Nothing in this build stores weather history, so it starts empty on every visit.'
                  }
                  unavailable={
                    feed?.error
                      ? {
                          source: 'Open-Meteo weather feed',
                          reason: feed.error.message,
                        }
                      : null
                  }
                />
              </PanelBody>
              <PanelFoot>
                <span className="text-[11px] text-ink-faint">
                  Each point is one reading delivered to this browser. Not a stored series: no
                  weather history is persisted anywhere in this deployment.
                </span>
              </PanelFoot>
            </Panel>
          </PageSection>

          {/* --- Flood indicator -------------------------------------------- */}
          <PageSection title="Flood indicator">
            <Panel>
              <PanelHead title={`Indicator: ${risk}`} icon={<CloudRain size={13} />} />
              <PanelBody className="space-y-1">
                <FieldLine label="Derived from" value={`${reading.rainIntensity} mm`} />
                <FieldLine label="Indicator" value={risk} />
                <FieldLine label="Condition" value={reading.condition || null} mono={false} />
                <FieldLine
                  label="Official warning"
                  value={null}
                  hint="No OSDMA or IMD warning feed is connected, so ARKA cannot say whether an official warning is in force."
                />
                <FieldLine label="River gauge" value={null} hint="No river-level telemetry is connected." />
                <p className="pt-1.5 mt-1 border-t border-line text-[11px] text-ink-faint leading-relaxed">
                  ARKA grades over 10 mm as HIGH and over 2 mm as MODERATE. The threshold is ARKA's;
                  the measurement is Open-Meteo's, for the city-centre grid point rather than a ward.
                </p>
                {reading.forecast && (
                  <p className="text-[11px] text-ink-subtle leading-relaxed">
                    <span className="ark-label">Provider note</span>
                    <br />
                    {reading.forecast}
                  </p>
                )}
              </PanelBody>
            </Panel>
          </PageSection>
        </div>

        {/* --- Alert history ------------------------------------------------- */}
        <PageSection title="Weather events" hint={`${alerts.length} this session`}>
          <Panel>
            <PanelBody>
              {alerts.length === 0 ? (
                <EmptyState
                  compact
                  title="No weather events this session"
                  detail="The feed emits an event when the flood indicator or the reported condition changes. A steady forecast produces none, and events from before this session are not retained."
                />
              ) : (
                <Timeline>
                  {alerts.map((event) => (
                    <TimelineItem
                      key={event.id}
                      title={event.title}
                      at={event.at}
                      actor={event.provider}
                      detail={event.detail}
                      state={event.tone === 'resolved' ? 'done' : 'current'}
                      meta={
                        <>
                          {event.severity && <SeverityBadge severity={event.severity} />}
                          <DataStateTag state={event.state} />
                        </>
                      }
                    >
                      {event.sourceSignals.length > 0 && (
                        <ul className="space-y-0.5">
                          {event.sourceSignals.map((signal) => (
                            <li key={signal} className="ark-mono text-[10.5px] text-ink-faint">
                              {signal}
                            </li>
                          ))}
                        </ul>
                      )}
                    </TimelineItem>
                  ))}
                </Timeline>
              )}
            </PanelBody>
          </Panel>
        </PageSection>

        {/* --- Shelters: honestly absent ------------------------------------ */}
        <PageSection title="Cyclone shelters">
          <Panel>
            <PanelBody>
              <UnavailableState
                notConfigured
                source="Shelter register and occupancy"
                reason="ARKA holds no shelter register and receives no occupancy telemetry. Connect the OSDMA multipurpose-shelter register for locations and capacity, and a district reporting feed for live occupancy, before this panel can show readiness."
              />
            </PanelBody>
          </Panel>
        </PageSection>
      </PageBody>
    </Page>
  );
}
