/**
 * Infrastructure — the register of critical city facilities.
 *
 * Rebuilt on the ARKA design system, sharing `AssetCard` and `DataTable` with the
 * drone, camera and utility modules so a hospital looks like a hospital wherever
 * it is listed. Assets sort worst-first: an asset in ALERT is the reason an
 * operator opened this page, so it is not below the fold behind nine healthy ones.
 *
 * What the register actually is, stated on the page: a static list of real
 * facilities at real coordinates, compiled into the build. No SCADA gateway or
 * structural-health telemetry is connected, so every record carries `SEED` from
 * its envelope and the status field is labelled as register state rather than a
 * live reading.
 *
 * Fabrications removed:
 *
 * - "98.2% health uptime" under the operational count. Nothing measured it.
 * - "Voltage variance detected" under the alert count, asserted regardless of
 *   which asset was in alert or what the register said about it. The alert reason
 *   now comes from the asset's own `details`.
 * - "Preventive overhaul" under the maintenance count, likewise asserted.
 * - The subtitle's "Isolation Forest Structural Health Scoring, SCADA Sensor
 *   Telemetry & Predictive Maintenance". None of those three exist in this
 *   deployment.
 * - "Inspect SCADA" on every card, which promised a telemetry view there is no
 *   feed for.
 *
 * Also fixed: the type filter was a hardcoded list of eight of the ten categories,
 * so airport, station and university assets could not be filtered to at all. The
 * options are now derived from the register with real counts, and `{alertCount}
 * Node` no longer reads "3 Node".
 */

import { useMemo } from 'react';
import {
  Building2,
  GraduationCap,
  HeartPulse,
  Landmark,
  Map as MapIcon,
  Plane,
  Radio,
  ShieldAlert,
  Siren,
  Train,
  Droplets,
  Zap,
} from 'lucide-react';
import type { LandmarkNode } from '../../types';
import {
  AssetCard,
  Button,
  DataTable,
  EmptyState,
  FilterBar,
  FilterGroup,
  Metric,
  MetricGrid,
  NameCell,
  OperationalBadge,
  Page,
  PageBody,
  PageSection,
  Panel,
  Provenance,
  SearchInput,
  Segmented,
  StatusBadge,
  useStoredState,
  type Column,
} from '../../ui';
import { ModuleHeader } from '../../shell/navigation';
import { FACILITY_REGISTER_SOURCE, landmarkEnvelope } from './adapters';

interface InfrastructureViewProps {
  landmarks: LandmarkNode[];
  onSelectLandmark: (lm: LandmarkNode) => void;
  onJumpToMap?: () => void;
}

type AssetType = LandmarkNode['type'];
type ViewMode = 'CARDS' | 'TABLE';

/** Operator-facing category names, so a card does not shout POWER at anyone. */
const TYPE_LABEL: Record<AssetType, string> = {
  HOSPITAL: 'Hospital',
  POLICE: 'Police',
  FIRE: 'Fire and rescue',
  POWER: 'Power',
  WATER: 'Water',
  TELECOM: 'Telecom',
  AIRPORT: 'Airport',
  STATION: 'Rail station',
  GOVT: 'Government',
  UNIVERSITY: 'Education',
};

/**
 * One glyph per category, drawn in the structural ink colour.
 *
 * Deliberately monochrome: colour on this page means status, and a rose hospital
 * icon next to a green status badge is two colour systems arguing.
 */
const TYPE_ICON: Record<AssetType, typeof Building2> = {
  HOSPITAL: HeartPulse,
  POLICE: ShieldAlert,
  FIRE: Siren,
  POWER: Zap,
  WATER: Droplets,
  TELECOM: Radio,
  AIRPORT: Plane,
  STATION: Train,
  GOVT: Landmark,
  UNIVERSITY: GraduationCap,
};

/** Worst first. An asset in alert is why this page is open. */
const STATUS_RANK: Record<LandmarkNode['status'], number> = {
  ALERT: 0,
  MAINTENANCE: 1,
  OPERATIONAL: 2,
};

export function InfrastructureView({ landmarks, onSelectLandmark, onJumpToMap }: InfrastructureViewProps) {
  const [mode, setMode] = useStoredState<ViewMode>('infrastructure.view', 'CARDS');
  const [types, setTypes] = useStoredState<AssetType[]>('infrastructure.types', []);
  const [query, setQuery] = useStoredState<string>('infrastructure.query', '');

  const tally = useMemo(() => {
    const byType = new Map<AssetType, number>();
    let operational = 0;
    let alert = 0;
    let maintenance = 0;
    for (const asset of landmarks) {
      byType.set(asset.type, (byType.get(asset.type) ?? 0) + 1);
      if (asset.status === 'OPERATIONAL') operational += 1;
      else if (asset.status === 'ALERT') alert += 1;
      else maintenance += 1;
    }
    // Only categories the register actually contains become filter chips: a chip
    // that can only ever return nothing is a dead control.
    const options = [...byType.entries()]
      .sort((a, b) => TYPE_LABEL[a[0]].localeCompare(TYPE_LABEL[b[0]]))
      .map(([value, count]) => ({ value, label: TYPE_LABEL[value], count }));
    return { options, operational, alert, maintenance };
  }, [landmarks]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return landmarks
      .filter((asset) => {
        if (types.length > 0 && !types.includes(asset.type)) return false;
        if (needle === '') return true;
        return (
          asset.name.toLowerCase().includes(needle) ||
          asset.details.toLowerCase().includes(needle) ||
          TYPE_LABEL[asset.type].toLowerCase().includes(needle)
        );
      })
      .sort(
        (a, b) => STATUS_RANK[a.status] - STATUS_RANK[b.status] || a.name.localeCompare(b.name),
      );
  }, [landmarks, types, query]);

  const columns = useMemo<Column<LandmarkNode>[]>(
    () => [
      {
        key: 'name',
        header: 'Asset',
        render: (asset) => {
          const Icon = TYPE_ICON[asset.type];
          return <NameCell primary={asset.name} secondary={asset.details} icon={<Icon size={12} />} />;
        },
        sortable: true,
        sortValue: (asset) => asset.name,
      },
      {
        key: 'type',
        header: 'Category',
        render: (asset) => <span className="text-[11.5px] text-ink-muted">{TYPE_LABEL[asset.type]}</span>,
        sortable: true,
        sortValue: (asset) => TYPE_LABEL[asset.type],
        width: '10rem',
      },
      {
        key: 'status',
        header: 'Register state',
        render: (asset) => <OperationalBadge status={asset.status} />,
        sortable: true,
        sortValue: (asset) => STATUS_RANK[asset.status],
        width: '10rem',
      },
      {
        key: 'position',
        header: 'Position',
        hideBelow: 'lg',
        render: (asset) => (
          <span className="ark-mono text-[11px] text-ink-subtle">
            {asset.lat.toFixed(4)}, {asset.lng.toFixed(4)}
          </span>
        ),
        width: '11rem',
      },
    ],
    [],
  );

  const activeFilters = types.length + (query.trim() === '' ? 0 : 1);

  return (
    <Page>
      <ModuleHeader
        item="Infrastructure"
        subtitle="Register of critical city facilities: health, emergency services, transport, utilities and government estate."
        meta={
          <>
            <Provenance state="SEED" source={FACILITY_REGISTER_SOURCE} />
            <StatusBadge
              label="REGISTER STATE"
              tone="medium"
              hint="Status is the value held in the facility register. No SCADA or structural-health telemetry is connected to these assets, so it is not a live reading."
            />
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
          <FilterBar
            activeCount={activeFilters}
            onReset={() => {
              setTypes([]);
              setQuery('');
            }}
            showing={{ shown: filtered.length, total: landmarks.length }}
          >
            <SearchInput
              value={query}
              onChange={setQuery}
              label="Search infrastructure"
              placeholder="Search assets"
            />
            <FilterGroup label="Category" options={tally.options} selected={types} onChange={setTypes} />
            <Segmented<ViewMode>
              label="Register layout"
              value={mode}
              options={[
                { value: 'CARDS', label: 'CARDS', hint: 'One card per asset' },
                { value: 'TABLE', label: 'TABLE', hint: 'Sortable register table' },
              ]}
              onChange={setMode}
            />
          </FilterBar>
        }
      />

      <PageBody>
        <MetricGrid columns={4}>
          <Metric
            label="On register"
            value={landmarks.length}
            hint="Facilities ARKA holds a record for."
            icon={<Building2 size={13} />}
          />
          <Metric
            label="Operational"
            value={tally.operational}
            unit={`/ ${landmarks.length}`}
            tone="success"
          />
          <Metric
            label="In alert"
            value={tally.alert}
            tone={tally.alert > 0 ? 'critical' : 'default'}
            hint="Register records a fault or degraded state."
          />
          <Metric
            label="Under maintenance"
            value={tally.maintenance}
            tone={tally.maintenance > 0 ? 'medium' : 'default'}
            hint="Register records planned work."
          />
        </MetricGrid>

        <PageSection
          title="Assets"
          hint={filtered.length === landmarks.length ? 'Worst state first' : `${filtered.length} matching`}
        >
          {filtered.length === 0 ? (
            <Panel>
              <EmptyState
                compact
                title={landmarks.length === 0 ? 'No facilities on the register' : 'No assets match'}
                detail={
                  landmarks.length === 0
                    ? 'The facility register is empty in this build.'
                    : 'Clear the category filter or the search term to see the rest of the register.'
                }
              />
            </Panel>
          ) : mode === 'TABLE' ? (
            <Panel flush>
              <DataTable
                rows={filtered}
                columns={columns}
                rowKey={(asset: LandmarkNode) => asset.id}
                label="Infrastructure register"
                onRowClick={(asset: LandmarkNode) => onSelectLandmark(asset)}
                rowAccent={(asset: LandmarkNode) =>
                  asset.status === 'ALERT' ? 'critical' : asset.status === 'MAINTENANCE' ? 'medium' : null
                }
              />
            </Panel>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
              {filtered.map((asset) => (
                <AssetCard
                  key={asset.id}
                  entity={landmarkEnvelope(asset)}
                  kindLabel={TYPE_LABEL[asset.type]}
                  status={asset.status}
                  onSelect={() => onSelectLandmark(asset)}
                >
                  <p className="text-[11.5px] text-ink-subtle leading-relaxed">{asset.details}</p>
                </AssetCard>
              ))}
            </div>
          )}
        </PageSection>
      </PageBody>
    </Page>
  );
}
