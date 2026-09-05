/**
 * Sensors — the instrument estate.
 *
 * A new destination in the ARKA v2 information architecture, but not new data:
 * the roadside detectors it lists were already arriving on the traffic feed and
 * were already being written into the store as `sensor` entities by
 * `src/store/ingest/traffic.ts`. Until now they only ever surfaced as a count on
 * the mobility page. That is the distinction this page exists to draw: Mobility
 * answers "how is the city moving", Sensors answers "is the equipment that tells
 * us working". They are different questions with different duty officers, and a
 * detector that has gone offline is an estate problem even on a day when traffic
 * is clear.
 *
 * Scope is stated plainly rather than implied. The IA names this destination for
 * IoT, environmental and infrastructure sensing; this deployment has exactly one
 * class of instrument feeding it, and the page says so in its own subtitle and in
 * the coverage panel. An operator must not read an estate of eight traffic
 * detectors as the city's full sensor network.
 *
 * Nothing is derived that the feed does not support:
 *
 * - No calibration dates, firmware versions, uptime percentages or battery
 *   levels. `TrafficSensor` carries id, name, position, speed, status and vehicle
 *   rate; anything else would be invented.
 * - No "last seen" per instrument beyond the envelope's own `observedAt`, which
 *   is the feed's tick, not a per-device heartbeat.
 * - The health roll-up is `sensorHealth`, the same mapping the ingest layer
 *   applies, so a status here cannot disagree with the map.
 */

import { useMemo } from 'react';
import { Activity, Gauge, Map as MapIcon, Signpost, WifiOff } from 'lucide-react';
import type { TrafficSensor } from '../../types';
import {
  Button,
  DataTable,
  DistributionBar,
  EmptyState,
  FilterBar,
  FilterGroup,
  HEALTH_COLOR,
  HealthDot,
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
  useStoredState,
  type Column,
} from '../../ui';
import { ModuleHeader } from '../../shell/navigation';
import { arkaNav, useEntitiesOfKind, useFeed } from '../../store/useArka';
import { sensorHealth } from '../../store/entities';
import { TRAFFIC_FEED_ID } from '../../store/ingest/traffic';

interface SensorsViewProps {
  onJumpToMap?: () => void;
}

const STATUSES: readonly TrafficSensor['status'][] = ['ONLINE', 'ALERT', 'OFFLINE'];

/**
 * Instrument classes the IA names, and what each would need.
 *
 * Listed so the gap is legible: an integrator can read this as a work list, and
 * an operator can see that the estate below is one row of this table rather than
 * all of it.
 */
const COVERAGE: readonly { klass: string; connected: string | null; needs: string }[] = [
  {
    klass: 'Traffic detectors',
    connected: 'BSCL traffic speed gateway',
    needs: 'Connected. Vehicle rate and spot speed per detector.',
  },
  {
    klass: 'Air quality',
    connected: null,
    needs: 'A CPCB or OSPCB continuous monitoring station feed.',
  },
  {
    klass: 'Water level and drainage',
    connected: null,
    needs: 'Drain and river-gauge telemetry from the municipal drainage division.',
  },
  {
    klass: 'Structural and utility sensing',
    connected: null,
    needs: 'Per-asset instrumentation on bridges, pumps and substations.',
  },
];

export function SensorsView({ onJumpToMap }: SensorsViewProps) {
  const entities = useEntitiesOfKind('sensor');
  const feed = useFeed(TRAFFIC_FEED_ID);
  const [statuses, setStatuses] = useStoredState<TrafficSensor['status'][]>('sensors.status', []);

  const counts = useMemo(() => {
    const tally = { ONLINE: 0, ALERT: 0, OFFLINE: 0 } as Record<TrafficSensor['status'], number>;
    for (const entity of entities) tally[entity.data.status] += 1;
    return tally;
  }, [entities]);

  const filtered = useMemo(
    () =>
      statuses.length === 0
        ? entities
        : entities.filter((entity) => statuses.includes(entity.data.status)),
    [entities, statuses],
  );

  /**
   * Reporting rate across the estate.
   *
   * Only over instruments that are actually reporting — averaging a zero from an
   * offline detector into the city figure would understate the traffic it can no
   * longer see.
   */
  const reporting = useMemo(() => {
    const live = entities.filter((entity) => entity.data.status !== 'OFFLINE');
    if (live.length === 0) return null;
    return Math.round(live.reduce((sum, entity) => sum + entity.data.vehicleRatePerMin, 0));
  }, [entities]);

  const segments = useMemo(
    () => [
      { label: 'Online', value: counts.ONLINE, color: HEALTH_COLOR.nominal },
      { label: 'Alert', value: counts.ALERT, color: HEALTH_COLOR.critical },
      { label: 'Offline', value: counts.OFFLINE, color: HEALTH_COLOR.offline },
    ],
    [counts],
  );

  const columns = useMemo<Column<(typeof entities)[number]>[]>(
    () => [
      {
        key: 'name',
        header: 'Instrument',
        render: (entity) => (
          <NameCell
            primary={entity.data.name}
            secondary={entity.id}
            icon={<HealthDot health={entity.health} />}
          />
        ),
        sortable: true,
        sortValue: (entity) => entity.data.name,
      },
      {
        key: 'status',
        header: 'Link',
        width: '8rem',
        sortable: true,
        sortValue: (entity) => entity.data.status,
        render: (entity) => (
          <span
            className={
              entity.data.status === 'OFFLINE'
                ? 'ark-tag text-ink-faint'
                : entity.data.status === 'ALERT'
                  ? 'ark-tag text-critical border-critical-border'
                  : 'ark-tag'
            }
          >
            {entity.data.status}
          </span>
        ),
      },
      {
        key: 'rate',
        header: 'Vehicles / min',
        numeric: true,
        width: '9rem',
        sortable: true,
        // An offline detector has no rate. Sorting it as 0 would rank it below a
        // genuinely quiet junction, which reads as a quiet road rather than a
        // dead instrument; `sortValue` nulls sort last instead.
        sortValue: (entity) => (entity.data.status === 'OFFLINE' ? null : entity.data.vehicleRatePerMin),
        render: (entity) =>
          entity.data.status === 'OFFLINE' ? (
            <span className="ark-mono text-[11px] text-ink-faint">—</span>
          ) : (
            <NumCell value={entity.data.vehicleRatePerMin} />
          ),
      },
      {
        key: 'speed',
        header: 'Spot speed',
        numeric: true,
        width: '9rem',
        sortable: true,
        sortValue: (entity) => (entity.data.status === 'OFFLINE' ? null : entity.data.speed),
        render: (entity) =>
          entity.data.status === 'OFFLINE' ? (
            <span className="ark-mono text-[11px] text-ink-faint">—</span>
          ) : (
            <NumCell value={entity.data.speed} unit=" km/h" />
          ),
      },
      {
        key: 'corridor',
        header: 'Corridor',
        hideBelow: 'md',
        render: (entity) =>
          entity.data.corridorId ? (
            <button
              type="button"
              className="ark-mono text-[11px] text-ink-subtle hover:text-accent underline decoration-line underline-offset-2"
              onClick={(event) => {
                event.stopPropagation();
                arkaNav.open({ kind: 'corridor', id: entity.data.corridorId });
              }}
            >
              {entity.data.corridorId}
            </button>
          ) : (
            <span className="ark-mono text-[11px] text-ink-faint">Unassigned</span>
          ),
      },
      {
        key: 'position',
        header: 'Position',
        hideBelow: 'lg',
        width: '11rem',
        render: (entity) =>
          entity.position ? (
            <span className="ark-mono text-[11px] text-ink-subtle">
              {entity.position.lat.toFixed(4)}, {entity.position.lng.toFixed(4)}
            </span>
          ) : (
            <span className="ark-mono text-[11px] text-ink-faint">No fix</span>
          ),
      },
    ],
    [],
  );

  const first = entities[0] ?? null;
  const hasSensors = entities.length > 0;

  return (
    <Page>
      <ModuleHeader
        item="Sensors"
        subtitle="The instrument estate ARKA reads from. In this deployment that is the roadside traffic detectors and nothing else."
        meta={
          <>
            <Provenance
              state={first?.state ?? 'UNAVAILABLE'}
              source={first?.source ?? feed?.source}
              fetchedAt={first?.observedAt}
              error={feed?.error}
            />
            <span className="text-[11px] text-ink-faint">
              {entities.length} instrument{entities.length === 1 ? '' : 's'}
            </span>
          </>
        }
        actions={
          onJumpToMap && (
            <Button variant="outline" size="sm" icon={<MapIcon size={12} />} onClick={onJumpToMap}>
              View on map
            </Button>
          )
        }
        toolbar={
          hasSensors && (
            <FilterBar
              activeCount={statuses.length}
              onReset={() => setStatuses([])}
              showing={{ shown: filtered.length, total: entities.length }}
            >
              <FilterGroup
                label="Link state"
                options={STATUSES.map((value) => ({ value, label: value, count: counts[value] }))}
                selected={statuses}
                onChange={setStatuses}
              />
            </FilterBar>
          )
        }
      />

      <PageBody>
        {!hasSensors ? (
          <UnavailableState
            source="Sensor telemetry"
            reason={
              feed?.error?.message ??
              'The traffic gateway is the only instrument feed configured, and it is not currently returning detectors.'
            }
            onRetry={undefined}
          />
        ) : (
          <>
            <MetricGrid columns={4}>
              <Metric
                label="Reporting"
                value={counts.ONLINE + counts.ALERT}
                unit={`/ ${entities.length}`}
                icon={<Activity size={13} />}
                hint="Instruments whose link is up, including those raising an alert."
              />
              <Metric
                label="Raising alert"
                value={counts.ALERT}
                tone={counts.ALERT > 0 ? 'critical' : 'success'}
                icon={<Gauge size={13} />}
                hint="The detector is reporting but flagging its own reading."
              />
              <Metric
                label="Off link"
                value={counts.OFFLINE}
                tone={counts.OFFLINE > 0 ? 'medium' : 'default'}
                icon={<WifiOff size={13} />}
                hint="No telemetry. The junction is unobserved, not necessarily clear."
              />
              <Metric
                label="Aggregate rate"
                value={reporting}
                unit=" veh/min"
                hint="Summed across reporting instruments only. Offline detectors contribute nothing rather than a zero."
              />
            </MetricGrid>

            <PageSection title="Estate" hint={`${filtered.length} shown`}>
              {filtered.length === 0 ? (
                <Panel>
                  <EmptyState
                    compact
                    title="No instruments at this link state"
                    detail="Clear the filter to see the rest of the estate."
                  />
                </Panel>
              ) : (
                <Panel flush>
                  <DataTable
                    rows={filtered}
                    columns={columns}
                    rowKey={(entity: any) => entity.id}
                    label="Sensor estate"
                    defaultSort={{ key: 'status', dir: 'desc' }}
                    rowAccent={(entity: any) =>
                      entity.data.status === 'ALERT'
                        ? 'high'
                        : entity.data.status === 'OFFLINE'
                          ? 'neutral'
                          : null
                    }
                    onRowClick={(entity: any) => arkaNav.locate({ kind: 'sensor', id: entity.id })}
                  />
                </Panel>
              )}
            </PageSection>

            <PageSection title="Link health">
              <Panel>
                <PanelBody>
                  <DistributionBar
                    segments={segments}
                    label="Sensor link state across the estate"
                    showLegend
                  />
                </PanelBody>
                <PanelFoot>
                  <span className="text-[11px] text-ink-faint">
                    Health mirrors the mapping the ingest layer applies, so a state here cannot
                    disagree with the same instrument on the map.
                  </span>
                </PanelFoot>
              </Panel>
            </PageSection>
          </>
        )}

        {/* --- What this estate does and does not cover --------------------- */}
        <PageSection title="Coverage">
          <Panel>
            <PanelHead
              title="Instrument classes"
              icon={<Signpost size={13} />}
              meta={
                <span className="ark-tag">
                  1 OF {COVERAGE.length} CONNECTED
                </span>
              }
            />
            <PanelBody className="space-y-1.5">
              {COVERAGE.map((row) => (
                <div
                  key={row.klass}
                  className="flex flex-col sm:flex-row sm:items-baseline gap-x-3 gap-y-0.5 pb-1.5 border-b border-line last:border-0 last:pb-0"
                >
                  <div className="sm:w-52 shrink-0 flex items-center gap-1.5">
                    <HealthDot health={row.connected ? sensorHealth('ONLINE') : 'offline'} />
                    <span className="text-[12px] text-ink">{row.klass}</span>
                  </div>
                  <div className="min-w-0">
                    <p className="text-[11px] text-ink-subtle leading-relaxed">{row.needs}</p>
                    {row.connected && (
                      <p className="ark-mono text-[10.5px] text-ink-faint">{row.connected}</p>
                    )}
                  </div>
                </div>
              ))}
            </PanelBody>
            <PanelFoot>
              <span className="text-[11px] text-ink-faint">
                Three of the four classes this module is named for have no source in this
                deployment. They are listed so the gap is visible rather than absent.
              </span>
            </PanelFoot>
          </Panel>
        </PageSection>
      </PageBody>
    </Page>
  );
}
