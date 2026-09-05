/**
 * Aviation — live aircraft over the district.
 *
 * A new destination in the ARKA v2 information architecture, and one of the few
 * with a genuinely live source behind it: `/api/adsb/live` queries the OpenSky
 * Network for the Odisha bounding box (19.8–21.5 N, 84.8–86.8 E). Until now that
 * endpoint existed on the server with nothing on the client reading it.
 *
 * Why this page polls itself rather than going through `src/store/ingest/`: there
 * is no `aircraft` entity kind, and adding one would mean an `EntityKind` that
 * cannot be focused, located or correlated because nothing else in the platform
 * references aircraft. A transient list that lives for as long as the page is
 * open is the honest shape — an aircraft is not an asset ARKA operates, it is
 * traffic ARKA observes passing overhead. When aviation becomes operationally
 * connected (an incident referencing a diversion, say), it earns an entity kind.
 *
 * Three things the endpoint's own shape forces this page to be careful about, all
 * of which are stated on screen rather than smoothed over:
 *
 * - **The destination field is not observed.** The server hardcodes
 *   `destination: 'Bhubaneswar (BPIA)'` for every aircraft in the box. An
 *   aircraft overflying Odisha at cruise is very likely going somewhere else, so
 *   this page does not show a destination column at all.
 * - **`aircraftType` is hardcoded to 'Airbus A320neo'.** OpenSky's state vector
 *   does not carry the type, so the column is omitted rather than repeated.
 * - **`confidence: 96` is a constant in the endpoint, not a measurement.** It is
 *   not surfaced; the state tag and the observation age carry what is knowable.
 *
 * The bounding box is district-wide, so "aircraft in the box" is not "aircraft
 * on approach to BPIA". The header says which question the page answers.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowUp, Gauge, Plane, PlaneLanding, RefreshCw } from 'lucide-react';
import type { FlightNode } from '../../types';
import type { DataError, DataState, SourceMeta } from '../../shared/dataState';
import {
  Button,
  DataTable,
  EmptyState,
  Metric,
  MetricGrid,
  NameCell,
  NumCell,
  Page,
  PageBody,
  PageSection,
  Panel,
  PanelBody,
  PanelFoot,
  PanelHead,
  Provenance,
  UnavailableState,
  type Column,
} from '../../ui';
import { ModuleHeader } from '../../shell/navigation';

/**
 * OpenSky publishes state vectors roughly every 5–10 s for anonymous callers and
 * rate-limits aggressively. 20 s is inside its useful resolution without earning
 * a 429 that would empty the table.
 */
const POLL_SECONDS = 20;

const ADSB_SOURCE: SourceMeta = {
  provider: 'OpenSky Network (via ARKA server)',
  kind: 'observation',
  attribution: 'ADS-B state vectors from the OpenSky Network community receiver mesh',
  url: 'https://opensky-network.org',
  note: 'Crowd-sourced ADS-B coverage over a district-wide bounding box. Aircraft with no receiver in range do not appear, and the feed is not an air-traffic-control source.',
  cadenceSeconds: POLL_SECONDS,
};

/** Below this, an aircraft in the box is plausibly on approach rather than at cruise. */
const APPROACH_CEILING_M = 3000;

interface FlightsPayload {
  success?: boolean;
  classification?: string;
  unavailableReason?: string;
  flights?: unknown;
}

function isFlight(value: unknown): value is FlightNode {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === 'string' && typeof candidate.callsign === 'string';
}

const STATE_VALUES: readonly DataState[] = [
  'LIVE',
  'CACHED',
  'SEED',
  'SIMULATED',
  'FALLBACK',
  'UNAVAILABLE',
];

function stateOf(value: unknown): DataState {
  return typeof value === 'string' && (STATE_VALUES as readonly string[]).includes(value)
    ? (value as DataState)
    : 'UNAVAILABLE';
}

interface Reading {
  flights: FlightNode[];
  state: DataState;
  observedAt: string | null;
  error: DataError | null;
}

const INITIAL: Reading = { flights: [], state: 'UNAVAILABLE', observedAt: null, error: null };

/**
 * Polls the ADS-B endpoint for as long as the page is mounted.
 *
 * Deliberately local rather than a store feed: see the module note. The
 * in-flight guard exists because a slow OpenSky response plus a 20 s timer can
 * otherwise overlap and land out of order, which would make the aircraft count
 * jump backwards.
 */
function useLiveFlights(): { reading: Reading; loading: boolean; refresh: () => void } {
  const [reading, setReading] = useState<Reading>(INITIAL);
  const [loading, setLoading] = useState(true);
  const inFlight = useRef(false);
  const alive = useRef(true);

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setLoading(true);
    try {
      const response = await fetch('/api/adsb/live');
      const payload = (await response.json()) as FlightsPayload;
      if (!alive.current) return;

      if (payload.success !== true) {
        setReading({
          flights: [],
          state: 'UNAVAILABLE',
          observedAt: null,
          error: {
            code: 'SOURCE_UNAVAILABLE',
            message:
              payload.unavailableReason ??
              'The ADS-B endpoint returned no aircraft and gave no reason.',
            requiredIntegration: 'OpenSky Network API access, or a local ADS-B receiver feed',
          },
        });
        return;
      }

      const flights = Array.isArray(payload.flights) ? payload.flights.filter(isFlight) : [];
      setReading({
        flights,
        state: stateOf(payload.classification),
        // The provenance stamp travels per aircraft; they share one fetch, so the
        // first is the reading's moment. Absent that, no timestamp is claimed.
        observedAt: flights[0]?.provenance?.timestamp ?? null,
        error: null,
      });
    } catch (error) {
      if (!alive.current) return;
      setReading({
        flights: [],
        state: 'UNAVAILABLE',
        observedAt: null,
        error: {
          code: 'FETCH_FAILED',
          message: error instanceof Error ? error.message : 'The request to the ARKA server failed.',
        },
      });
    } finally {
      inFlight.current = false;
      if (alive.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    alive.current = true;
    void load();
    const timer = setInterval(() => void load(), POLL_SECONDS * 1000);
    return () => {
      alive.current = false;
      clearInterval(timer);
    };
  }, [load]);

  return { reading, loading, refresh: () => void load() };
}

/** Compass point for a heading, so the column reads without mental arithmetic. */
const POINTS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'] as const;

function compass(heading: number): string {
  const index = Math.round(((heading % 360) + 360) % 360 / 45) % POINTS.length;
  return POINTS[index];
}

export function AviationView() {
  const { reading, loading, refresh } = useLiveFlights();
  const { flights, state, observedAt, error } = reading;

  const summary = useMemo(() => {
    if (flights.length === 0) return null;
    const low = flights.filter((flight) => flight.altitudeMeters < APPROACH_CEILING_M).length;
    const landed = flights.filter((flight) => flight.status === 'LANDED').length;
    const highest = flights.reduce(
      (max, flight) => Math.max(max, flight.altitudeMeters),
      0,
    );
    return { low, landed, highest };
  }, [flights]);

  const columns = useMemo<Column<FlightNode>[]>(
    () => [
      {
        key: 'callsign',
        header: 'Callsign',
        render: (flight) => (
          <NameCell primary={flight.callsign} secondary={flight.id} icon={<Plane size={12} />} />
        ),
        sortable: true,
        sortValue: (flight) => flight.callsign,
      },
      {
        key: 'status',
        header: 'Phase',
        width: '9rem',
        sortable: true,
        sortValue: (flight) => flight.status,
        render: (flight) => (
          <span
            className={
              flight.status === 'APPROACHING' ? 'ark-tag text-accent border-accent-border' : 'ark-tag'
            }
          >
            {flight.status}
          </span>
        ),
      },
      {
        key: 'altitude',
        header: 'Altitude',
        numeric: true,
        width: '8.5rem',
        sortable: true,
        sortValue: (flight) => flight.altitudeMeters,
        render: (flight) => <NumCell value={flight.altitudeMeters} unit=" m" />,
      },
      {
        key: 'speed',
        header: 'Ground speed',
        numeric: true,
        width: '9.5rem',
        sortable: true,
        sortValue: (flight) => flight.speedKmh,
        render: (flight) => <NumCell value={flight.speedKmh} unit=" km/h" />,
      },
      {
        key: 'heading',
        header: 'Track',
        numeric: true,
        width: '7.5rem',
        sortable: true,
        sortValue: (flight) => flight.heading,
        render: (flight) => (
          <span className="ark-mono text-[11px]">
            {Math.round(flight.heading)}°
            <span className="text-ink-faint ml-1">{compass(flight.heading)}</span>
          </span>
        ),
      },
      {
        key: 'origin',
        header: 'Reported origin',
        hideBelow: 'lg',
        render: (flight) => (
          <span className="text-[11.5px] text-ink-subtle truncate">{flight.origin}</span>
        ),
      },
      {
        key: 'position',
        header: 'Position',
        hideBelow: 'xl',
        width: '11rem',
        render: (flight) => (
          <span className="ark-mono text-[11px] text-ink-subtle">
            {flight.lat.toFixed(3)}, {flight.lng.toFixed(3)}
          </span>
        ),
      },
    ],
    [],
  );

  return (
    <Page>
      <ModuleHeader
        item="Aviation"
        subtitle="Aircraft currently visible to ADS-B receivers over the Khordha–Puri district box. Not an air-traffic-control feed."
        meta={
          <>
            <Provenance state={state} source={ADSB_SOURCE} fetchedAt={observedAt} error={error} />
            <span className="text-[11px] text-ink-faint">
              Polls every {POLL_SECONDS} s while this page is open
            </span>
          </>
        }
        actions={
          <Button
            variant="outline"
            size="sm"
            icon={<RefreshCw size={12} className={loading ? 'ark-spin' : undefined} />}
            onClick={refresh}
            disabled={loading}
          >
            Refresh
          </Button>
        }
      />

      <PageBody>
        {error ? (
          <UnavailableState
            source="ADS-B aircraft positions"
            reason={error.message}
            onRetry={refresh}
          />
        ) : (
          <>
            <MetricGrid columns={4}>
              <Metric
                label="Aircraft in box"
                value={flights.length}
                icon={<Plane size={13} />}
                hint="Within 19.8–21.5 N, 84.8–86.8 E. Aircraft with no receiver in range are invisible to this feed."
              />
              <Metric
                label={`Below ${APPROACH_CEILING_M / 1000} km`}
                value={summary?.low ?? null}
                tone={summary && summary.low > 0 ? 'accent' : 'default'}
                icon={<PlaneLanding size={13} />}
                hint="Low enough to be climbing or descending rather than at cruise. ARKA does not receive an approach clearance, so this is an altitude observation, not a phase-of-flight assignment."
              />
              <Metric
                label="Highest"
                value={summary?.highest ?? null}
                unit=" m"
                icon={<ArrowUp size={13} />}
              />
              <Metric
                label="Reported landed"
                value={summary?.landed ?? null}
                icon={<Gauge size={13} />}
                hint="The endpoint marks an aircraft LANDED from its altitude alone."
              />
            </MetricGrid>

            <PageSection title="Aircraft" hint={`${flights.length} tracked`}>
              <Panel flush>
                {flights.length === 0 ? (
                  <EmptyState
                    title={loading ? 'Querying the receiver mesh' : 'No aircraft in range'}
                    detail={
                      loading
                        ? 'Waiting on the first state vector from OpenSky.'
                        : 'No ADS-B receiver in the community mesh is currently reporting an aircraft inside the district box. That is a coverage statement, not a guarantee the sky is empty.'
                    }
                    icon={<Plane size={18} />}
                  />
                ) : (
                  <DataTable
                    rows={flights}
                    columns={columns}
                    rowKey={(flight) => flight.id}
                    label="Aircraft currently visible to ADS-B"
                    defaultSort={{ key: 'altitude', dir: 'asc' }}
                    rowAccent={(flight) => (flight.status === 'APPROACHING' ? 'info' : null)}
                  />
                )}
              </Panel>
            </PageSection>
          </>
        )}

        {/* --- What this feed is not ---------------------------------------- */}
        <PageSection title="Feed limits">
          <Panel>
            <PanelHead title="How to read this page" icon={<Plane size={13} />} />
            <PanelBody className="space-y-1.5 text-[11.5px] text-ink-subtle leading-relaxed">
              <p>
                <span className="ark-label">Coverage is crowd-sourced</span>
                <br />
                OpenSky aggregates volunteer receivers. An aircraft not in range of one does not
                appear, so an empty table means no coverage rather than no traffic.
              </p>
              <p>
                <span className="ark-label">Destination and aircraft type are not observed</span>
                <br />
                The state vector carries position, altitude, speed and track. It does not carry a
                flight plan, so no destination or airframe column is shown — the endpoint fills
                those with constants and ARKA will not repeat a constant as an observation.
              </p>
              <p>
                <span className="ark-label">Not an ATC integration</span>
                <br />
                Nothing here is coordinated with BPIA or the Airports Authority of India. Connect an
                AAI data-sharing agreement for movements, clearances and diversions.
              </p>
            </PanelBody>
            <PanelFoot>
              <span className="text-[11px] text-ink-faint">
                No aircraft position is written to the store: aviation is traffic ARKA observes, not
                an asset it operates, so nothing here can be focused or correlated.
              </span>
            </PanelFoot>
          </Panel>
        </PageSection>
      </PageBody>
    </Page>
  );
}
