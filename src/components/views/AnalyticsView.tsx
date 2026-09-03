/**
 * Analytics — distributions over the records ARKA currently holds.
 *
 * Every figure on this page is counted, in the browser, from the incident and
 * corridor records on screen elsewhere in the platform. That is a narrow claim
 * and the page makes it plainly: this is a cross-section of the present state,
 * not a time series, because nothing in this deployment stores history. A
 * "response time trend" needs a store of resolved incidents with dispatch and
 * clearance stamps, and there isn't one.
 *
 * Fabrications removed — the previous version was almost entirely invented:
 *
 * - `agencyData`: five agencies with response minutes (3.8, 4.2, 6.5, 8.1, 9.0),
 *   targets and dispatch counts, drawn as a bar chart of "Agency Response
 *   Efficiency". No dispatch timing is recorded anywhere in this codebase.
 * - `aiTrendData`: a six-point "AI Bayesian Model Confidence % vs City Risk
 *   Score" series. There is no Bayesian model, no city risk score, and the
 *   numbers were constants.
 * - The four KPI tiles: "4.2 Minutes / -1.4 min faster than target", "Gemini AI
 *   Precision 96.4% Accuracy", "Incident Containment 92.8% Rate", "Traffic Delay
 *   Reduction -18% Bottleneck / Adaptive Signal Loop". Nothing measured any of
 *   them; there is no adaptive signal loop.
 * - The "Export Analytics Dataset" button, which had no handler at all.
 * - The subtitle's "Bayesian Risk Score Distributions, Multi-Agency Response
 *   Efficiency & Predictive AI Accuracy".
 *
 * The pie chart is gone too, for a design reason rather than an honesty one: six
 * slices with rotated outside labels is unreadable at panel size. Composition is
 * now a `DistributionBar`, which is legible on a wall display and needs no legend
 * geometry.
 *
 * The one genuine derived figure — mean detection confidence — is shown with its
 * basis (how many records carry a score) rather than as a bare percentage, and
 * the export writes exactly the rows on screen.
 */

import { useCallback, useMemo } from 'react';
import { BarChart3, Car, Download, Siren } from 'lucide-react';
import type { Incident, Severity, TrafficCorridor, WeatherData } from '../../types';
import {
  ACCENT,
  Button,
  Chart,
  CONGESTION_COLOR,
  DataTable,
  DistributionBar,
  EmptyState,
  FieldLine,
  Metric,
  MetricGrid,
  OperationalBadge,
  Page,
  PageBody,
  PageHeader,
  PageSection,
  Panel,
  PanelBody,
  PanelFoot,
  PanelHead,
  SEVERITY_COLOR,
  STATUS,
  StatusBadge,
  SURFACE,
  UnavailableState,
  type ChartSeries,
  type Column,
  type RailTone,
} from '../../ui';

interface AnalyticsViewProps {
  incidents: Incident[];
  trafficCorridors: TrafficCorridor[];
  weather: WeatherData;
}

const SEVERITY_ORDER: readonly Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

const STATUS_ORDER: readonly Incident['status'][] = ['ACTIVE', 'DISPATCHED', 'CONTAINED', 'RESOLVED'];

/**
 * Incident status → colour.
 *
 * Not on the severity ramp: CONTAINED and RESOLVED are progress, not danger, so
 * they take the steel and green steps rather than the amber and yellow ones an
 * operator reads as "getting worse".
 */
const STATUS_COLOR: Record<Incident['status'], string> = {
  ACTIVE: STATUS.criticalFill,
  DISPATCHED: STATUS.highFill,
  CONTAINED: STATUS.infoFill,
  RESOLVED: STATUS.lowFill,
};

/** Congestion bands, worst first, matching the map and the traffic module. */
const CONGESTION_ORDER: readonly TrafficCorridor['congestionLevel'][] = [
  'SEVERE',
  'JAMMED',
  'SLOW',
  'CLEAR',
];

/** Congestion band → row rail, so the table reads as position and not only hue. */
const CONGESTION_RAIL: Record<TrafficCorridor['congestionLevel'], RailTone> = {
  SEVERE: 'critical',
  JAMMED: 'high',
  SLOW: 'medium',
  CLEAR: 'low',
};

const CORRIDOR_SERIES: readonly ChartSeries[] = [
  { key: 'speed', label: 'Measured (km/h)', kind: 'bar', color: ACCENT.base },
  { key: 'freeFlow', label: 'Free-flow (km/h)', kind: 'bar', color: SURFACE.lineBright },
];

/** Counts by key, in a fixed order, dropping bands with no records. */
function tally<T extends string>(values: readonly T[], order: readonly T[]): { key: T; count: number }[] {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return order.map((key) => ({ key, count: counts.get(key) ?? 0 })).filter((row) => row.count > 0);
}

/** Counts by an open-ended key, largest first. Used for categories and agencies. */
function tallyOpen(values: readonly string[]): { key: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.entries()]
    .map(([key, count]) => ({ key, count }))
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Words that classify a corridor rather than identify it. */
const CORRIDOR_NOISE = /\b(express|expressway|arterial|corridor|link|axis|bypass|road|marg)\b/gi;

/**
 * The identifying part of a corridor name, for a chart tick.
 *
 * Every corridor in the city set carries a class suffix — "Arterial", "IT
 * Corridor", "Administrative Axis" — which is identical across most of them and
 * therefore carries no information at a tick's width. Stripping it leaves the
 * place name, which is what distinguishes one bar from the next. Falls back to
 * the original if stripping would leave nothing.
 */
function shortAxisLabel(name: string): string {
  const stripped = name.replace(CORRIDOR_NOISE, ' ').replace(/\s+/g, ' ').trim();
  return stripped.length > 0 ? stripped : name;
}

/** One corridor, as the chart and the table beneath it both read it. */
interface CorridorRow extends Record<string, unknown> {
  /** Short tick label for the chart. */
  axis: string;
  /** Full corridor name, for the table. */
  name: string;
  road: string;
  speed: number;
  freeFlow: number;
  deficit: number;
  level: TrafficCorridor['congestionLevel'];
}

const CORRIDOR_COLUMNS: ReadonlyArray<Column<CorridorRow>> = [
  {
    key: 'name',
    header: 'Corridor',
    render: (row) => (
      <div className="min-w-0">
        <div className="text-[12.5px] text-ink truncate">{row.name}</div>
        <div className="text-[10.5px] text-ink-faint truncate">{row.road}</div>
      </div>
    ),
    sortable: true,
    sortValue: (row) => row.name,
  },
  {
    key: 'speed',
    header: 'Measured',
    hint: 'Average speed the traffic feed reports for this corridor, in km/h.',
    numeric: true,
    render: (row) => `${row.speed}`,
    sortable: true,
    sortValue: (row) => row.speed,
    width: '6.5rem',
  },
  {
    key: 'freeFlow',
    header: 'Free-flow',
    hint: "The corridor's configured reference speed, not a measurement.",
    numeric: true,
    hideBelow: 'sm',
    render: (row) => `${row.freeFlow}`,
    sortable: true,
    sortValue: (row) => row.freeFlow,
    width: '6.5rem',
  },
  {
    key: 'deficit',
    header: 'Shortfall',
    hint: 'Free-flow minus measured. How much speed the corridor is currently losing.',
    numeric: true,
    render: (row) => (
      <span className={row.deficit > 0 ? 'text-ink' : 'text-ink-faint'}>
        {row.deficit > 0 ? `-${row.deficit}` : '0'}
      </span>
    ),
    sortable: true,
    sortValue: (row) => row.deficit,
    width: '6.5rem',
  },
  {
    key: 'level',
    header: 'Band',
    render: (row) => <OperationalBadge status={row.level} />,
    sortable: true,
    sortValue: (row) => CONGESTION_ORDER.indexOf(row.level),
    width: '7.5rem',
  },
];

export function AnalyticsView({ incidents, trafficCorridors, weather }: AnalyticsViewProps) {
  const bySeverity = useMemo(
    () => tally(incidents.map((incident) => incident.priority), SEVERITY_ORDER),
    [incidents],
  );
  const byStatus = useMemo(
    () => tally(incidents.map((incident) => incident.status), STATUS_ORDER),
    [incidents],
  );
  const byCategory = useMemo(
    () => tallyOpen(incidents.map((incident) => incident.category)),
    [incidents],
  );
  const byAgency = useMemo(
    () => tallyOpen(incidents.map((incident) => incident.agencyAssigned)),
    [incidents],
  );
  const byCongestion = useMemo(
    () => tally(trafficCorridors.map((corridor) => corridor.congestionLevel), CONGESTION_ORDER),
    [trafficCorridors],
  );

  /**
   * Mean detection confidence over the records that actually carry one.
   *
   * `basis` is reported alongside it, because "91% over 5 records" and "91% over
   * one" are different statements and the platform's rule is that a confidence
   * figure shows its working.
   */
  const confidence = useMemo(() => {
    const scored = incidents.filter(
      (incident) => typeof incident.aiConfidence === 'number' && incident.aiConfidence > 0,
    );
    if (scored.length === 0) return { mean: null, basis: 0 };
    const sum = scored.reduce((total, incident) => total + incident.aiConfidence, 0);
    return { mean: Math.round(sum / scored.length), basis: scored.length };
  }, [incidents]);

  const open = useMemo(
    () => incidents.filter((incident) => incident.status !== 'RESOLVED').length,
    [incidents],
  );

  /** Dispatched units, summed over the records that report the field. */
  const dispatched = useMemo(() => {
    const reporting = incidents.filter((incident) => typeof incident.unitsDispatched === 'number');
    if (reporting.length === 0) return { total: null, basis: 0 };
    return {
      total: reporting.reduce((sum, incident) => sum + (incident.unitsDispatched ?? 0), 0),
      basis: reporting.length,
    };
  }, [incidents]);

  /**
   * Speed against free-flow, worst deficit first.
   *
   * Two labels per corridor, because one cannot serve both surfaces. `axis` is
   * the corridor's short name with its road-class suffix dropped — "Janpath
   * Commercial Corridor" becomes "Janpath" — since eight full names across a
   * 240px-tall chart collapse into an unreadable band of overlapping text. The
   * full name and the road it follows stay in the table beneath, which is where
   * an operator goes to identify a specific corridor.
   */
  const corridorRows = useMemo<CorridorRow[]>(
    () =>
      trafficCorridors
        .map((corridor) => ({
          axis: shortAxisLabel(corridor.name),
          name: corridor.name,
          road: corridor.roadName,
          speed: corridor.avgSpeedKmh,
          freeFlow: corridor.freeFlowSpeedKmh,
          deficit: corridor.freeFlowSpeedKmh - corridor.avgSpeedKmh,
          level: corridor.congestionLevel,
        }))
        .sort((a, b) => b.deficit - a.deficit)
        .slice(0, 8),
    [trafficCorridors],
  );

  const exportCounts = useCallback(() => {
    const rows: string[][] = [['dimension', 'value', 'records']];
    for (const row of bySeverity) rows.push(['incident severity', row.key, String(row.count)]);
    for (const row of byStatus) rows.push(['incident status', row.key, String(row.count)]);
    for (const row of byCategory) rows.push(['incident category', row.key, String(row.count)]);
    for (const row of byAgency) rows.push(['assigned agency', row.key, String(row.count)]);
    for (const row of byCongestion) rows.push(['corridor congestion', row.key, String(row.count)]);
    const body = rows.map((row) => row.map(csvCell).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([body], { type: 'text/csv' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `ARKA_distributions_${new Date().toISOString().slice(0, 16).replace(/[:T]/g, '')}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking immediately can race the download in some browsers; a short grace
    // period releases the blob without doing that.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }, [bySeverity, byStatus, byCategory, byAgency, byCongestion]);

  const hasIncidents = incidents.length > 0;
  const hasCorridors = trafficCorridors.length > 0;

  return (
    <Page>
      <PageHeader
        title="Analytics"
        subtitle="Distributions across the incident and corridor records ARKA currently holds."
        meta={
          <>
            <StatusBadge
              label="CURRENT STATE"
              tone="info"
              hint="Counted in the browser from the records on screen. This is a cross-section of now, not a time series: no incident or traffic history is stored in this deployment."
            />
            <span className="text-[11px] text-ink-faint">
              {incidents.length} incident{incidents.length === 1 ? '' : 's'} · {trafficCorridors.length}{' '}
              corridor{trafficCorridors.length === 1 ? '' : 's'}
            </span>
          </>
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            icon={<Download size={12} />}
            onClick={exportCounts}
            disabled={!hasIncidents && !hasCorridors}
          >
            Export counts
          </Button>
        }
      />

      <PageBody>
        <MetricGrid columns={4}>
          <Metric
            label="Records held"
            value={incidents.length}
            hint="Incidents ARKA currently holds, at any status."
            icon={<Siren size={13} />}
          />
          <Metric
            label="Open"
            value={open}
            unit={`/ ${incidents.length}`}
            tone={open > 0 ? 'critical' : 'success'}
            hint="Not at RESOLVED."
          />
          <Metric
            label="Mean detection confidence"
            value={confidence.mean}
            unit={confidence.mean == null ? undefined : '%'}
            hint="Mean of the confidence each record's detector reported. Records without a score are excluded rather than counted as zero."
            meta={
              <span className="ark-mono text-[10.5px] text-ink-faint">
                over {confidence.basis} of {incidents.length} scored
              </span>
            }
          />
          <Metric
            label="Units dispatched"
            value={dispatched.total}
            hint="Summed from the records that report a unit count. This is what the records say was sent, not a live roster."
            meta={
              <span className="ark-mono text-[10.5px] text-ink-faint">
                over {dispatched.basis} of {incidents.length} reporting
              </span>
            }
          />
        </MetricGrid>

        {/* --- Incident composition ------------------------------------------ */}
        <PageSection title="Incident composition" hint={`${incidents.length} records`}>
          {!hasIncidents ? (
            <Panel>
              <EmptyState
                compact
                title="No incidents held"
                detail="Distributions appear once ARKA holds incident records."
              />
            </Panel>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-2">
              <Panel>
                <PanelHead title="By severity" icon={<Siren size={13} />} />
                <PanelBody className="space-y-3">
                  <DistributionBar
                    label="Incidents by severity"
                    segments={bySeverity.map((row) => ({
                      label: row.key,
                      value: row.count,
                      color: SEVERITY_COLOR[row.key],
                    }))}
                  />
                  <div>
                    {byStatus.length > 0 && (
                      <>
                        <h4 className="ark-label mb-1.5">By status</h4>
                        <DistributionBar
                          label="Incidents by status"
                          segments={byStatus.map((row) => ({
                            label: row.key,
                            value: row.count,
                            color: STATUS_COLOR[row.key],
                          }))}
                        />
                      </>
                    )}
                  </div>
                </PanelBody>
              </Panel>

              <Panel>
                <PanelHead title="By category and agency" icon={<BarChart3 size={13} />} />
                <PanelBody>
                  <h4 className="ark-label mb-1">Category</h4>
                  <div className="mb-2">
                    {byCategory.map((row) => (
                      <FieldLine key={row.key} label={row.key} value={String(row.count)} />
                    ))}
                  </div>
                  <h4 className="ark-label mb-1">Assigned agency</h4>
                  <div>
                    {byAgency.map((row) => (
                      <FieldLine key={row.key} label={row.key} value={String(row.count)} mono={false} />
                    ))}
                  </div>
                </PanelBody>
                <PanelFoot>
                  <span className="text-[11px] text-ink-faint">
                    Assignment as recorded on the incident. Not a measure of agency performance —
                    nothing here times a response.
                  </span>
                </PanelFoot>
              </Panel>
            </div>
          )}
        </PageSection>

        {/* --- Corridor speeds ----------------------------------------------- */}
        <PageSection
          title="Corridor speeds"
          hint={hasCorridors ? 'Largest shortfall against free-flow first' : undefined}
        >
          <Panel>
            <PanelHead
              title="Measured against free-flow reference"
              icon={<Car size={13} />}
              meta={
                byCongestion.length > 0 ? (
                  <span className="ark-tag">
                    {byCongestion.map((row) => `${row.key} ${row.count}`).join(' · ')}
                  </span>
                ) : undefined
              }
            />
            <PanelBody className="space-y-3">
              <Chart
                data={corridorRows}
                xKey="axis"
                series={CORRIDOR_SERIES}
                height={240}
                showGrid
                showLegend
                label="Measured corridor speed against the free-flow reference"
                emptyTitle="No corridors measured"
                emptyDetail="The traffic feed has not delivered corridor speeds."
              />
              {byCongestion.length > 0 && (
                <DistributionBar
                  label="Corridors by congestion band"
                  segments={byCongestion.map((row) => ({
                    label: row.key,
                    value: row.count,
                    color: CONGESTION_COLOR[row.key],
                  }))}
                />
              )}
              {/* The chart's ticks are abbreviated; this is where a corridor is
                  identified in full, and where the shortfall is readable as a
                  number rather than as the gap between two bars. */}
              {hasCorridors && (
                <DataTable
                  rows={corridorRows}
                  columns={CORRIDOR_COLUMNS}
                  rowKey={(row) => row.name}
                  label="Corridor speeds against their free-flow reference"
                  defaultSort={{ key: 'deficit', dir: 'desc' }}
                  rowAccent={(row) => CONGESTION_RAIL[row.level]}
                />
              )}
            </PanelBody>
            <PanelFoot>
              <span className="text-[11px] text-ink-faint">
                Free-flow is the corridor's configured reference speed, not a measurement taken
                tonight.
                {trafficCorridors.length > corridorRows.length &&
                  ` Showing the ${corridorRows.length} worst of ${trafficCorridors.length} corridors.`}{' '}
                Weather at the time of this reading: {weather.condition || 'not reported'}.
              </span>
            </PanelFoot>
          </Panel>
        </PageSection>

        {/* --- What this page cannot show ------------------------------------ */}
        <PageSection title="Performance analytics">
          <Panel>
            <PanelBody>
              <UnavailableState
                notConfigured
                source="Response timing and outcome history"
                reason="Response times, containment rates and trends over time need a store of resolved incidents with dispatch and clearance stamps. ARKA holds only the current record set in memory, so any such figure would be invented. Connect an incident-history store to populate this."
              />
            </PanelBody>
          </Panel>
        </PageSection>
      </PageBody>
    </Page>
  );
}
