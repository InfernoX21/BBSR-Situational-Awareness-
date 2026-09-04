/**
 * Drone feed — the UAV reconnaissance module.
 *
 * Rebuilt on the ARKA design system. The page presents the fleet three ways over
 * one filtered list: cards for triage, a telemetry table for comparison, and a
 * fleet summary above both. The view mode and the status filter persist per
 * operator, so a duty officer who works from the table does not re-pick it every
 * shift.
 *
 * What this page must not do is imply it is receiving video. It is not: no RTSP
 * or MPEG-TS endpoint is configured anywhere in this deployment, and the
 * telemetry is a compiled fixture that `App` steps on a timer. Every card
 * therefore carries the `SIMULATED` state from its envelope (see
 * `views/adapters.ts`), and the video panel states what is missing rather than
 * drawing a black rectangle that looks like a stalled feed.
 *
 * Removed from the previous version:
 *
 * - The cyan `animate-pulse` dot on every drone, which read as a live link.
 * - The per-card "CLASSIFICATION: SIMULATED TELEMETRY (USE_DEMO_DATA=true)"
 *   strip. The state belongs in the envelope, where the shared card renders it in
 *   the same place on every asset in the platform, and the operator does not need
 *   an env-var name repeated four times.
 * - The hand-rolled card, header and empty state, all three of which existed in
 *   near-identical form on four other pages.
 */

import { useMemo } from 'react';
import { Battery, Map as MapIcon, Plane, Video } from 'lucide-react';
import type { DroneUnit, Incident, LandmarkNode } from '../../types';
import {
  AssetCard,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  FilterGroup,
  Meter,
  MetricGrid,
  Metric,
  NameCell,
  NumCell,
  OperationalBadge,
  Page,
  PageBody,
  PageSection,
  Panel,
  PanelBody,
  PanelHead,
  Provenance,
  Segmented,
  UnavailableState,
  useStoredState,
  type Column,
} from '../../ui';
import { ModuleHeader } from '../../shell/navigation';
import { DRONE_FIXTURE_SOURCE, droneEnvelope } from './adapters';

interface DronesViewProps {
  drones?: DroneUnit[];
  incidents?: Incident[];
  landmarks?: LandmarkNode[];
  onSelectDrone?: (drone: DroneUnit) => void;
  onJumpToMap?: () => void;
}

type ViewMode = 'CARDS' | 'TABLE';

const STATUSES: readonly DroneUnit['status'][] = ['PATROLLING', 'DISPATCHED', 'HOVERING', 'CHARGING'];

/** Airborne means the aircraft is in the air, whatever it is doing up there. */
const AIRBORNE: readonly DroneUnit['status'][] = ['PATROLLING', 'DISPATCHED', 'HOVERING'];

/** Below this the aircraft must be recalled, so it reads as critical. */
const RESERVE_PCT = 20;

function batteryTone(battery: number): 'critical' | 'medium' | 'low' {
  if (battery <= RESERVE_PCT) return 'critical';
  if (battery <= 45) return 'medium';
  return 'low';
}

export function DronesView({ drones = [], onSelectDrone, onJumpToMap }: DronesViewProps) {
  const [mode, setMode] = useStoredState<ViewMode>('drones.view', 'CARDS');
  const [statuses, setStatuses] = useStoredState<DroneUnit['status'][]>('drones.status', []);

  const counts = useMemo(() => {
    const tally = {} as Record<DroneUnit['status'], number>;
    for (const status of STATUSES) tally[status] = 0;
    for (const drone of drones) tally[drone.status] += 1;
    return tally;
  }, [drones]);

  const fleet = useMemo(() => {
    const airborne = drones.filter((d) => AIRBORNE.includes(d.status)).length;
    const reserve = drones.filter((d) => d.battery <= RESERVE_PCT).length;
    // An empty fleet has no mean charge. Zero would read as four flat batteries.
    const meanBattery =
      drones.length === 0
        ? null
        : Math.round(drones.reduce((sum, d) => sum + d.battery, 0) / drones.length);
    const lowest = drones.reduce<DroneUnit | null>(
      (worst, d) => (worst === null || d.battery < worst.battery ? d : worst),
      null,
    );
    return { airborne, reserve, meanBattery, lowest };
  }, [drones]);

  const filtered = useMemo(
    () => (statuses.length === 0 ? drones : drones.filter((d) => statuses.includes(d.status))),
    [drones, statuses],
  );

  const columns = useMemo<Column<DroneUnit>[]>(
    () => [
      {
        key: 'callsign',
        header: 'Aircraft',
        render: (drone) => (
          <NameCell primary={drone.callsign} secondary={drone.targetArea} icon={<Plane size={12} />} />
        ),
        sortable: true,
        sortValue: (drone) => drone.callsign,
      },
      {
        key: 'status',
        header: 'Status',
        render: (drone) => <OperationalBadge status={drone.status} />,
        sortable: true,
        sortValue: (drone) => drone.status,
        width: '9rem',
      },
      {
        key: 'battery',
        header: 'Charge',
        numeric: true,
        sortable: true,
        sortValue: (drone) => drone.battery,
        width: '8rem',
        render: (drone) => (
          <div className="flex items-center gap-2 justify-end">
            <Meter value={drone.battery} tone={batteryTone(drone.battery)} className="w-12" />
            <NumCell value={drone.battery} unit="%" />
          </div>
        ),
      },
      {
        key: 'alt',
        header: 'Altitude',
        numeric: true,
        sortable: true,
        sortValue: (drone) => drone.altMeters,
        render: (drone) => <NumCell value={drone.altMeters} unit=" m" />,
        width: '7rem',
      },
      {
        key: 'speed',
        header: 'Airspeed',
        numeric: true,
        sortable: true,
        sortValue: (drone) => drone.speedKmh,
        render: (drone) => <NumCell value={drone.speedKmh} unit=" km/h" />,
        width: '8rem',
      },
      {
        key: 'position',
        header: 'Position',
        hideBelow: 'lg',
        render: (drone) => (
          <span className="ark-mono text-[11px] text-ink-subtle">
            {drone.lat.toFixed(4)}, {drone.lng.toFixed(4)}
          </span>
        ),
        width: '11rem',
      },
    ],
    [],
  );

  const hasDrones = drones.length > 0;

  return (
    <Page>
      <ModuleHeader
        item="Drones"
        subtitle="Aerial reconnaissance fleet: ground-control telemetry, tasking and video links."
        meta={
          <>
            <Provenance
              state={hasDrones ? 'SIMULATED' : 'UNAVAILABLE'}
              source={DRONE_FIXTURE_SOURCE}
              error={
                hasDrones
                  ? null
                  : {
                      code: 'SOURCE_UNAVAILABLE',
                      message: 'No ground-control station is connected.',
                      requiredIntegration: 'MAVLink / DroneKit GCS telemetry link',
                    }
              }
            />
            <span className="text-[11px] text-ink-faint">
              {drones.length} airframe{drones.length === 1 ? '' : 's'} on the roster
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
          hasDrones && (
            <FilterBar
              activeCount={statuses.length}
              onReset={() => setStatuses([])}
              showing={{ shown: filtered.length, total: drones.length }}
            >
              <FilterGroup
                label="Status"
                options={STATUSES.map((value) => ({ value, label: value, count: counts[value] }))}
                selected={statuses}
                onChange={setStatuses}
              />
              <Segmented<ViewMode>
                label="Fleet layout"
                value={mode}
                options={[
                  { value: 'CARDS', label: 'CARDS', hint: 'One card per airframe' },
                  { value: 'TABLE', label: 'TABLE', hint: 'Sortable telemetry table' },
                ]}
                onChange={setMode}
              />
            </FilterBar>
          )
        }
      />

      <PageBody>
        {!hasDrones ? (
          <UnavailableState
            notConfigured
            source="UAV telemetry and video"
            reason="No MAVLink or DroneKit ground-station receiver and no RTSP/MPEG-TS video endpoint is configured, so ARKA cannot see the fleet. Connect a GCS telemetry port and set the stream URL in the server environment; setting USE_DEMO_DATA=true instead shows simulated airframes for demonstration."
          />
        ) : (
          <>
            <MetricGrid columns={4}>
              <Metric
                label="Airborne"
                value={fleet.airborne}
                unit={`/ ${drones.length}`}
                tone={fleet.airborne > 0 ? 'accent' : 'default'}
                hint="Patrolling, dispatched or holding station."
                icon={<Plane size={13} />}
              />
              <Metric
                label="On charge"
                value={counts.CHARGING}
                tone="info"
                hint="Docked and unavailable for tasking."
                icon={<Battery size={13} />}
              />
              <Metric
                label="Mean charge"
                value={fleet.meanBattery}
                unit="%"
                tone={fleet.meanBattery != null && fleet.meanBattery <= 45 ? 'medium' : 'default'}
              />
              <Metric
                label="Below reserve"
                value={fleet.reserve}
                tone={fleet.reserve > 0 ? 'critical' : 'success'}
                hint={`Charge at or under ${RESERVE_PCT}%. Recall required.`}
                meta={
                  fleet.lowest ? (
                    <span className="ark-mono text-[10.5px]">
                      Lowest {fleet.lowest.callsign} · {fleet.lowest.battery}%
                    </span>
                  ) : undefined
                }
              />
            </MetricGrid>

            <PageSection
              title="Fleet"
              hint={
                statuses.length > 0
                  ? `${filtered.length} of ${drones.length} shown`
                  : 'Select an airframe to inspect its tasking'
              }
            >
              {filtered.length === 0 ? (
                <Panel>
                  <EmptyState
                    compact
                    title="No airframes at this status"
                    detail="Clear the status filter to see the rest of the fleet."
                  />
                </Panel>
              ) : mode === 'TABLE' ? (
                <Panel flush>
                  <DataTable
                    rows={filtered}
                    columns={columns}
                    rowKey={(drone) => drone.id}
                    label="Drone fleet telemetry"
                    defaultSort={{ key: 'battery', dir: 'asc' }}
                    onRowClick={onSelectDrone ? (drone) => onSelectDrone(drone) : undefined}
                  />
                </Panel>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                  {filtered.map((drone) => (
                    <AssetCard
                      key={drone.id}
                      entity={droneEnvelope(drone)}
                      status={drone.status}
                      onSelect={onSelectDrone ? () => onSelectDrone(drone) : undefined}
                      stats={[
                        { label: 'Target zone', value: drone.targetArea },
                        { label: 'Charge', value: `${drone.battery}%`, mono: true },
                        { label: 'Altitude', value: `${drone.altMeters} m`, mono: true },
                        { label: 'Airspeed', value: `${drone.speedKmh} km/h`, mono: true },
                      ]}
                      badges={
                        drone.battery <= RESERVE_PCT ? (
                          <span className="ark-tag text-critical border-critical-border">RECALL</span>
                        ) : undefined
                      }
                    >
                      <Meter value={drone.battery} tone={batteryTone(drone.battery)} />
                    </AssetCard>
                  ))}
                </div>
              )}
            </PageSection>
          </>
        )}

        {/* --- Video links --------------------------------------------------- */}
        <PageSection title="Video downlink">
          <Panel>
            <PanelHead
              title="Aerial video"
              icon={<Video size={13} />}
              meta={<span className="ark-tag">NO STREAM CONFIGURED</span>}
            />
            <PanelBody>
              <UnavailableState
                compact
                notConfigured
                source="RTSP / MPEG-TS video ingest"
                reason={
                  drones.some((drone) => drone.streamUrl)
                    ? 'Some airframes carry a stream URL, but no video relay is configured to decode it, so ARKA cannot display the feed.'
                    : 'No airframe on the roster reports a video endpoint, and no relay is configured to receive one.'
                }
              />
            </PanelBody>
          </Panel>
        </PageSection>
      </PageBody>
    </Page>
  );
}
