/**
 * Reports — the operational briefing and export module.
 *
 * The page composes a briefing from the records ARKA is actually holding and then
 * exports exactly what it displayed. Those two properties are the whole point: a
 * report an operator signs must be reproducible from the same data, and a file
 * that differs from the screen it came from is worse than no file.
 *
 * Fabrications removed:
 *
 * - The initial `aiSummary`, a hardcoded paragraph asserting 14 intelligence
 *   feeds, 6 arterial corridors, a 3.8-minute mean dispatch latency and "92.8%
 *   situational confidence". None of those figures were computed from anything,
 *   and two of the quantities do not exist in this deployment.
 * - `handleGenerateAISummary`, a 1200ms `setTimeout` presented as an LLM
 *   synthesising a document. It asserted "8 IoT radar nodes" and a Daya River
 *   elevation of "+0.4m with zero shelter evacuations required" regardless of
 *   what any feed said. There is no summarisation model wired to this page, so
 *   the briefing is composed deterministically from the records instead and is
 *   labelled as composed, not synthesised.
 * - The subtitle's "Automated PDF/CSV Export Engine & LLM Intelligence Document
 *   Synthesizer". The export is a text or CSV file the browser assembles; there
 *   is no PDF pipeline and no synthesiser.
 *
 * Real defects fixed:
 *
 * - `handleDownload(format)` ignored its argument and always wrote the same
 *   `.txt`. There are now two real formats, and the CSV is the attached record
 *   table rather than prose.
 * - The object URL was never revoked, leaking a blob per export for the lifetime
 *   of the tab.
 * - The timeframe control relabelled the report without narrowing it. It now
 *   filters the records, and says how many carry no parseable timestamp instead
 *   of quietly dropping them.
 * - The scope control produced an identical document for all five choices.
 */

import { useCallback, useMemo, useState } from 'react';
import { Building2, CloudRain, Download, FileText, Printer, Siren, Car } from 'lucide-react';
import type { Incident, LandmarkNode, TrafficSummary, WeatherData } from '../../types';
import {
  Button,
  DataTable,
  EmptyState,
  FieldLine,
  FilterGroup,
  Inset,
  Metric,
  MetricGrid,
  NameCell,
  OperationalBadge,
  Page,
  PageBody,
  PageHeader,
  PageSection,
  Panel,
  PanelBody,
  PanelFoot,
  PanelHead,
  Segmented,
  SEVERITY_RAIL,
  SeverityBadge,
  StatusBadge,
  useStoredState,
  type Column,
} from '../../ui';

interface ReportsViewProps {
  incidents: Incident[];
  weather: WeatherData;
  trafficSummary?: TrafficSummary;
  landmarks?: LandmarkNode[];
}

type Scope = 'DAILY' | 'INCIDENT' | 'WEATHER' | 'TRAFFIC' | 'INFRASTRUCTURE';
type Timeframe = '24H' | '7D' | '30D';

const SCOPE_LABEL: Record<Scope, string> = {
  DAILY: 'Daily situation report',
  INCIDENT: 'Incident report',
  WEATHER: 'Weather and flood report',
  TRAFFIC: 'Traffic report',
  INFRASTRUCTURE: 'Infrastructure report',
};

const TIMEFRAME_HOURS: Record<Timeframe, number> = { '24H': 24, '7D': 24 * 7, '30D': 24 * 30 };

/** One label/value pair in the document. Null renders and exports as unreported. */
interface ReportRow {
  label: string;
  value: string | null;
}

interface ReportBlock {
  heading: string;
  /** Why the block reads the way it does — a caveat, not a caption. */
  note?: string;
  rows?: ReportRow[];
  /** Free lines, for listings such as non-operational assets. */
  lines?: string[];
}

/**
 * Which records fall inside the reporting window.
 *
 * An incident whose timestamp cannot be parsed is neither included nor silently
 * discarded: it is counted as undated and reported as such. The fixture records
 * carry a wall-clock string with no date, so this is the common case rather than
 * an edge one, and a report that quietly showed nothing would be the worst
 * possible outcome.
 */
function partitionByWindow(incidents: readonly Incident[], hours: number, now: number) {
  const cutoff = now - hours * 3_600_000;
  const inWindow: Incident[] = [];
  const undated: Incident[] = [];
  for (const incident of incidents) {
    const at = Date.parse(incident.timestamp);
    if (!Number.isFinite(at)) undated.push(incident);
    else if (at >= cutoff && at <= now) inWindow.push(incident);
  }
  return { inWindow, undated };
}

/** Whether a record carries a date the reporting window can act on at all. */
function isDated(incident: Incident): boolean {
  return Number.isFinite(Date.parse(incident.timestamp));
}

function tallyBy<T extends string>(values: readonly T[]): string {
  const counts = new Map<T, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  if (counts.size === 0) return 'none';
  return [...counts.entries()].map(([key, count]) => `${key} ${count}`).join(', ');
}

function weatherBlock(weather: WeatherData): ReportBlock {
  return {
    heading: 'Weather and flood risk',
    note: weather.provenance?.source ? `Source: ${weather.provenance.source}` : undefined,
    rows: [
      { label: 'Condition', value: weather.condition || null },
      { label: 'Temperature', value: `${weather.temperature} °C` },
      { label: 'Humidity', value: `${weather.humidity}%` },
      { label: 'Visibility', value: `${weather.visibility} km` },
      { label: 'Wind', value: `${weather.windSpeed} km/h ${weather.windDirection}`.trim() },
      { label: 'Rain intensity', value: `${weather.rainIntensity} mm/h` },
      { label: 'Flood risk', value: weather.floodRiskLevel },
      { label: 'Forecast', value: weather.forecast || null },
    ],
  };
}

function trafficBlock(summary: TrafficSummary | undefined): ReportBlock {
  if (!summary) {
    return {
      heading: 'Traffic',
      note: 'The traffic feed returned no city summary for this window.',
      rows: [{ label: 'City summary', value: null }],
    };
  }
  return {
    heading: 'Traffic',
    rows: [
      { label: 'City average speed', value: `${summary.cityAvgSpeedKmh} km/h` },
      { label: 'Free-flow reference', value: `${summary.cityFreeFlowAvgSpeedKmh} km/h` },
      { label: 'Active bottlenecks', value: String(summary.activeBottlenecks) },
      { label: 'Throughput', value: `${summary.totalVehiclesPerMin} vehicles/min` },
      { label: 'Congestion trend', value: summary.congestionTrend },
      { label: 'Worst corridor', value: summary.highestCongestionCorridor || null },
    ],
  };
}

function infrastructureBlock(landmarks: readonly LandmarkNode[]): ReportBlock {
  if (landmarks.length === 0) {
    return {
      heading: 'Infrastructure',
      note: 'No facility register is loaded in this build.',
      rows: [{ label: 'Assets on register', value: null }],
    };
  }
  const degraded = landmarks.filter((asset) => asset.status !== 'OPERATIONAL');
  return {
    heading: 'Infrastructure',
    note: 'Status is the value held in the facility register, not live telemetry.',
    rows: [
      { label: 'Assets on register', value: String(landmarks.length) },
      { label: 'Operational', value: String(landmarks.length - degraded.length) },
      { label: 'Alert or maintenance', value: String(degraded.length) },
    ],
    lines: degraded.map((asset) => `${asset.status} · ${asset.name} — ${asset.details}`),
  };
}

/**
 * The incident block.
 *
 * Severity and status are tallied over everything the report attaches — the
 * window plus the undated tail — because that is the set the reader can see in
 * the table underneath. Tallying the window alone produced a briefing that said
 * "by severity: none" above five listed incidents, which is a worse lie than
 * either number on its own.
 */
function incidentBlock(inWindow: readonly Incident[], undated: readonly Incident[], timeframe: Timeframe): ReportBlock {
  const attached = [...inWindow, ...undated];
  const open = attached.filter((incident) => incident.status !== 'RESOLVED');
  return {
    heading: 'Incidents',
    note:
      undated.length > 0
        ? `${undated.length} of ${attached.length} attached record${attached.length === 1 ? '' : 's'} carry no parseable date, so the reporting window can neither include nor exclude them. They are attached and counted below, and flagged in the table.`
        : undefined,
    rows: [
      { label: `Timestamped within ${timeframe}`, value: String(inWindow.length) },
      { label: 'Undated but attached', value: String(undated.length) },
      { label: 'Attached, still open', value: `${open.length} of ${attached.length}` },
      { label: 'By severity', value: tallyBy(attached.map((incident) => incident.priority)) },
      { label: 'By status', value: tallyBy(attached.map((incident) => incident.status)) },
    ],
  };
}

/** The document, as blocks. One function decides both the screen and the export. */
function composeReport(
  scope: Scope,
  inWindow: readonly Incident[],
  undated: readonly Incident[],
  timeframe: Timeframe,
  weather: WeatherData,
  trafficSummary: TrafficSummary | undefined,
  landmarks: readonly LandmarkNode[],
): ReportBlock[] {
  switch (scope) {
    case 'INCIDENT':
      return [incidentBlock(inWindow, undated, timeframe)];
    case 'WEATHER':
      return [weatherBlock(weather)];
    case 'TRAFFIC':
      return [trafficBlock(trafficSummary)];
    case 'INFRASTRUCTURE':
      return [infrastructureBlock(landmarks)];
    case 'DAILY':
      return [
        incidentBlock(inWindow, undated, timeframe),
        weatherBlock(weather),
        trafficBlock(trafficSummary),
        infrastructureBlock(landmarks),
      ];
  }
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/**
 * Writes a blob and revokes the URL.
 *
 * The previous version never revoked, so every export leaked a blob for the life
 * of the tab. The revoke is deferred a tick because Firefox cancels an in-flight
 * download if the URL dies in the same task as the click.
 */
function saveFile(filename: string, mime: string, body: string): void {
  const url = URL.createObjectURL(new Blob([body], { type: mime }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function ReportsView({ incidents, weather, trafficSummary, landmarks = [] }: ReportsViewProps) {
  const [scope, setScope] = useStoredState<Scope>('reports.scope', 'DAILY');
  const [timeframe, setTimeframe] = useStoredState<Timeframe>('reports.timeframe', '24H');
  // Frozen at compose time so the document, the table and the exported file all
  // describe the same instant rather than three consecutive renders.
  const [composedAt, setComposedAt] = useState(() => new Date());

  const window_ = useMemo(
    () => partitionByWindow(incidents, TIMEFRAME_HOURS[timeframe], composedAt.getTime()),
    [incidents, timeframe, composedAt],
  );

  const blocks = useMemo(
    () =>
      composeReport(scope, window_.inWindow, window_.undated, timeframe, weather, trafficSummary, landmarks),
    [scope, window_, timeframe, weather, trafficSummary, landmarks],
  );

  /** Records attached to the report: the window, then the undated tail. */
  const attached = useMemo(() => [...window_.inWindow, ...window_.undated], [window_]);

  const asText = useCallback(() => {
    const head = [
      `ARKA — ${SCOPE_LABEL[scope]}`,
      `Reporting window: last ${timeframe}`,
      `Composed: ${composedAt.toLocaleString()}`,
      'Composed from the records ARKA held at that moment. Not a model summary.',
    ];
    const body = blocks.flatMap((block) => [
      '',
      block.heading.toUpperCase(),
      ...(block.note ? [`(${block.note})`] : []),
      ...(block.rows ?? []).map((row) => `  ${row.label}: ${row.value ?? 'NOT REPORTED'}`),
      ...(block.lines ?? []).map((line) => `  - ${line}`),
    ]);
    const records = [
      '',
      `ATTACHED RECORDS (${attached.length})`,
      ...attached.map(
        (incident) =>
          `  - [${incident.priority}] #${incident.id} ${incident.title} (${incident.status}) — ` +
          `${incident.location.name}, ${incident.agencyAssigned}, ${incident.timestamp}`,
      ),
    ];
    return [...head, ...body, ...records, ''].join('\n');
  }, [scope, timeframe, composedAt, blocks, attached]);

  const asCsv = useCallback(() => {
    const header = ['id', 'severity', 'title', 'category', 'status', 'location', 'agency', 'timestamp'];
    const rows = attached.map((incident) =>
      [
        incident.id,
        incident.priority,
        incident.title,
        incident.category,
        incident.status,
        incident.location.name,
        incident.agencyAssigned,
        incident.timestamp,
      ].map(csvCell),
    );
    return [header.join(','), ...rows.map((row) => row.join(','))].join('\n');
  }, [attached]);

  const stamp = useMemo(
    () => composedAt.toISOString().slice(0, 16).replace(/[:T]/g, ''),
    [composedAt],
  );

  const columns = useMemo<Column<Incident>[]>(
    () => [
      {
        key: 'id',
        header: 'Record',
        render: (incident) => (
          <NameCell primary={`#${incident.id}`} secondary={incident.title} />
        ),
        sortable: true,
        sortValue: (incident) => incident.id,
        width: '18rem',
      },
      {
        key: 'priority',
        header: 'Severity',
        render: (incident) => <SeverityBadge severity={incident.priority} />,
        sortable: true,
        sortValue: (incident) => incident.priority,
        width: '8rem',
      },
      {
        key: 'status',
        header: 'Status',
        render: (incident) => <OperationalBadge status={incident.status} />,
        sortable: true,
        sortValue: (incident) => incident.status,
        width: '9rem',
      },
      {
        key: 'category',
        header: 'Category',
        hideBelow: 'md',
        render: (incident) => <span className="text-[11.5px] text-ink-muted">{incident.category}</span>,
        sortable: true,
        sortValue: (incident) => incident.category,
        width: '8rem',
      },
      {
        key: 'location',
        header: 'Location',
        render: (incident) => (
          <span className="text-[11.5px] text-ink-muted truncate" title={incident.location.address}>
            {incident.location.name}
          </span>
        ),
        sortable: true,
        sortValue: (incident) => incident.location.name,
      },
      {
        key: 'agency',
        header: 'Agency',
        hideBelow: 'lg',
        render: (incident) => <span className="text-[11.5px] text-ink-muted">{incident.agencyAssigned}</span>,
        sortable: true,
        sortValue: (incident) => incident.agencyAssigned,
        width: '11rem',
      },
      {
        // The briefing's note says undated records are flagged here. This is that
        // flag: without it a reader has no way to tell which five of the attached
        // records the reporting window could not place.
        key: 'reported',
        header: 'Reported',
        hideBelow: 'md',
        render: (incident) =>
          isDated(incident) ? (
            <span className="ark-mono text-[11px] text-ink-subtle">
              {new Date(incident.timestamp).toLocaleString()}
            </span>
          ) : (
            <span
              className="ark-tag text-caution border-caution-border"
              title={`Reported as "${incident.timestamp}", which carries no date. Attached to the report, but the reporting window can neither include nor exclude it.`}
            >
              UNDATED
            </span>
          ),
        sortable: true,
        sortValue: (incident) => (isDated(incident) ? Date.parse(incident.timestamp) : null),
        width: '12rem',
      },
    ],
    [],
  );

  const openHigh = window_.inWindow.filter(
    (incident) =>
      incident.status !== 'RESOLVED' && (incident.priority === 'CRITICAL' || incident.priority === 'HIGH'),
  ).length;

  return (
    <Page>
      <PageHeader
        title="Reports"
        subtitle="Composed operational briefings and record exports for the city command log."
        meta={
          <>
            <StatusBadge
              label="COMPOSED LOCALLY"
              tone="info"
              hint="Every figure below is computed in the browser from the records ARKA holds. No summarisation model is involved, and nothing is asserted that the feeds did not report."
            />
            <span className="ark-mono text-[10.5px] text-ink-faint">
              Composed {composedAt.toLocaleString()}
            </span>
          </>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={12} />}
              onClick={() => saveFile(`ARKA_${scope}_${timeframe}_${stamp}.txt`, 'text/plain', asText())}
            >
              Text
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<Download size={12} />}
              onClick={() => saveFile(`ARKA_${scope}_${timeframe}_${stamp}.csv`, 'text/csv', asCsv())}
            >
              CSV
            </Button>
            <Button variant="outline" size="sm" icon={<Printer size={12} />} onClick={() => window.print()}>
              Print
            </Button>
          </>
        }
        toolbar={
          <>
            <FilterGroup<Scope>
              label="Scope"
              single
              options={(Object.keys(SCOPE_LABEL) as Scope[]).map((value) => ({
                value,
                label: value,
                hint: SCOPE_LABEL[value],
              }))}
              selected={[scope]}
              onChange={(next) => {
                if (next.length > 0) setScope(next[0]);
              }}
            />
            <Segmented<Timeframe>
              label="Reporting window"
              value={timeframe}
              options={[
                { value: '24H', label: '24H' },
                { value: '7D', label: '7D' },
                { value: '30D', label: '30D' },
              ]}
              onChange={setTimeframe}
            />
            <Button variant="quiet" size="xs" onClick={() => setComposedAt(new Date())}>
              Recompose
            </Button>
          </>
        }
      />

      <PageBody>
        <MetricGrid columns={4}>
          <Metric
            label="Records in window"
            value={window_.inWindow.length}
            unit={`/ ${incidents.length}`}
            hint={`Incidents timestamped within the last ${timeframe}.`}
            icon={<Siren size={13} />}
          />
          <Metric
            label="Undated records"
            value={window_.undated.length}
            tone={window_.undated.length > 0 ? 'medium' : 'default'}
            hint="No parseable timestamp, so the window cannot include or exclude them. Attached to the report regardless."
          />
          <Metric
            label="Open at high or above"
            value={openHigh}
            tone={openHigh > 0 ? 'critical' : 'success'}
            icon={<Siren size={13} />}
          />
          <Metric
            label="Flood risk"
            value={weather.floodRiskLevel}
            tone={
              weather.floodRiskLevel === 'CRITICAL'
                ? 'critical'
                : weather.floodRiskLevel === 'HIGH'
                  ? 'high'
                  : weather.floodRiskLevel === 'MODERATE'
                    ? 'medium'
                    : 'success'
            }
            icon={<CloudRain size={13} />}
          />
        </MetricGrid>

        {/* --- The document ---------------------------------------------------- */}
        <PageSection title="Briefing" hint={SCOPE_LABEL[scope]}>
          <Panel>
            <PanelHead
              title={SCOPE_LABEL[scope]}
              icon={<FileText size={13} />}
              meta={<span className="ark-tag">LAST {timeframe}</span>}
            />
            <PanelBody className="space-y-3">
              {blocks.map((block) => (
                <Inset key={block.heading}>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="ark-label">{block.heading}</h3>
                    {block.heading === 'Traffic' && <Car size={12} className="text-ink-faint" aria-hidden />}
                    {block.heading === 'Infrastructure' && (
                      <Building2 size={12} className="text-ink-faint" aria-hidden />
                    )}
                  </div>
                  {block.note && (
                    <p className="mt-1 text-[11px] text-ink-faint leading-relaxed">{block.note}</p>
                  )}
                  {block.rows && (
                    <div className="mt-1.5 grid grid-cols-1 md:grid-cols-2 gap-x-6 divide-y divide-line md:divide-y-0">
                      {block.rows.map((row) => (
                        <FieldLine key={row.label} label={row.label} value={row.value} />
                      ))}
                    </div>
                  )}
                  {block.lines && block.lines.length > 0 && (
                    <ul className="mt-2 space-y-1 border-t border-line pt-2">
                      {block.lines.map((line) => (
                        <li key={line} className="ark-mono text-[11px] text-ink-subtle leading-relaxed">
                          {line}
                        </li>
                      ))}
                    </ul>
                  )}
                </Inset>
              ))}
            </PanelBody>
            <PanelFoot>
              <span className="text-[11px] text-ink-faint">
                The exported file contains exactly these figures and the attached records below.
              </span>
            </PanelFoot>
          </Panel>
        </PageSection>

        {/* --- Attached records ------------------------------------------------ */}
        <PageSection title="Attached records" hint={`${attached.length} incident records`}>
          <Panel flush>
            {attached.length === 0 ? (
              <EmptyState
                compact
                title="No records in this window"
                detail={
                  incidents.length === 0
                    ? 'No incidents have been reported to ARKA.'
                    : 'Widen the reporting window to include older records.'
                }
              />
            ) : (
              <DataTable
                rows={attached}
                columns={columns}
                rowKey={(incident) => incident.id}
                label="Incident records attached to this report"
                defaultSort={{ key: 'priority', dir: 'asc' }}
                rowAccent={(incident) => SEVERITY_RAIL[incident.priority]}
              />
            )}
          </Panel>
        </PageSection>
      </PageBody>
    </Page>
  );
}
