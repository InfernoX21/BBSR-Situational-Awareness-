/**
 * The dashboard's bottom workbench.
 *
 * Four resizable, reorderable panels under the map. Reordering and the panel
 * height persist per operator, which is the brief's "custom dashboards" and
 * "persistent filters" requirement met at the level this surface actually needs:
 * a duty officer who wants cameras first should not rearrange them every shift.
 *
 * Charts arrive through `ui/chart`, which keeps Recharts behind `React.lazy` and
 * does not even reference it until the panel is on screen. This file previously
 * imported nine Recharts symbols directly, which put the whole library in the
 * initial bundle for a strip that starts 180px tall.
 *
 * Fabrications removed:
 *
 * - The severity donut's `criticalCount || 1`, `highCount || 2`, `mediumCount || 3`,
 *   `lowCount || 1`, `resolvedCount || 4`. With no incidents at all the chart drew
 *   a full five-slice ring summing to eleven. Zero now reads as zero, and an empty
 *   city reads as NO RECORDS.
 * - `timelineData`, six hardcoded hourly rows commented "Timeline Mock Hourly
 *   Data". The timeline is now bucketed from the incidents' own timestamps.
 * - `trafficSummary?.cityAvgSpeedKmh || 25`, which asserted a city average speed
 *   when the traffic feed had reported nothing.
 * - `unit="k"` on the speed axis, which labelled 32 km/h as "32k".
 */

import { memo, useCallback, useMemo, useState, type DragEvent, type MouseEvent, type ReactNode, type TouchEvent } from 'react';
import { BarChart2, ChevronDown, ChevronUp, GripHorizontal, GripVertical, PieChart } from 'lucide-react';
import type { Incident, ResourceUnit, TrafficCorridor, TrafficSummary, WeatherData } from '../types';
import { LiveNewsPanel } from './LiveNewsPanel';
import { LiveTrafficCameraPanel } from './LiveTrafficCameraPanel';
import {
  Chart,
  DistributionBar,
  IconButton,
  SEVERITY_COLOR,
  STATUS,
  SURFACE,
  Segmented,
  Tally,
  cx,
  useStoredState,
  type ChartSeries,
} from '../ui';

interface BottomAnalyticsProps {
  incidents: Incident[];
  resources: ResourceUnit[];
  weather: WeatherData;
  trafficCorridors?: TrafficCorridor[];
  trafficSummary?: TrafficSummary;
}

type WidgetId = 'INCIDENTS' | 'TRAFFIC' | 'NEWS' | 'CAMERAS';

const DEFAULT_ORDER: WidgetId[] = ['INCIDENTS', 'TRAFFIC', 'NEWS', 'CAMERAS'];
const DEFAULT_HEIGHT = 208;
const MIN_HEIGHT = 120;
const MAX_HEIGHT = 520;
const COLLAPSED_HEIGHT = 30;

const TRAFFIC_SERIES: readonly ChartSeries[] = [
  { key: 'observed', label: 'Observed', kind: 'bar', color: STATUS.highFill },
  // Free-flow is a reference value, not a reading, so it takes a structural grey
  // rather than a slot on the status ramp.
  { key: 'freeFlow', label: 'Free flow', kind: 'bar', color: SURFACE.lineStrong },
];

const TIMELINE_SERIES: readonly ChartSeries[] = [
  { key: 'CRITICAL', label: 'Critical', kind: 'bar', color: SEVERITY_COLOR.CRITICAL },
  { key: 'HIGH', label: 'High', kind: 'bar', color: SEVERITY_COLOR.HIGH },
  { key: 'MEDIUM', label: 'Medium', kind: 'bar', color: SEVERITY_COLOR.MEDIUM },
  { key: 'LOW', label: 'Low', kind: 'bar', color: SEVERITY_COLOR.LOW },
];

/**
 * Two-hour buckets over the last twelve hours, from the incidents' own
 * timestamps.
 *
 * Incidents whose timestamp is unparseable or outside the window are excluded
 * rather than dropped into the nearest bucket — an incident of unknown time must
 * not become evidence about a specific hour. Buckets with nothing in them are
 * kept, because an empty two-hour window is a fact about the city.
 */
function bucketByHour(incidents: readonly Incident[], now: number) {
  const SPAN_HOURS = 12;
  const STEP_HOURS = 2;
  const stepMs = STEP_HOURS * 3_600_000;
  const start = Math.floor((now - SPAN_HOURS * 3_600_000) / stepMs) * stepMs;

  const buckets = Array.from({ length: SPAN_HOURS / STEP_HOURS + 1 }, (_, index) => {
    const at = new Date(start + index * stepMs);
    return {
      time: `${String(at.getHours()).padStart(2, '0')}:00`,
      CRITICAL: 0,
      HIGH: 0,
      MEDIUM: 0,
      LOW: 0,
    };
  });

  let placed = 0;
  for (const incident of incidents) {
    const at = Date.parse(incident.timestamp);
    if (!Number.isFinite(at)) continue;
    const index = Math.floor((at - start) / stepMs);
    if (index < 0 || index >= buckets.length) continue;
    buckets[index][incident.priority] += 1;
    placed += 1;
  }

  return { buckets, placed };
}

export const BottomAnalytics = memo(function BottomAnalytics({
  incidents,
  trafficCorridors = [],
  trafficSummary,
}: BottomAnalyticsProps) {
  const [height, setHeight] = useStoredState<number>('dashboard.workbench.height', DEFAULT_HEIGHT);
  const [collapsed, setCollapsed] = useStoredState<boolean>('dashboard.workbench.collapsed', false);
  const [order, setOrder] = useStoredState<WidgetId[]>('dashboard.workbench.order', DEFAULT_ORDER);
  const [resizing, setResizing] = useState(false);
  const [dragged, setDragged] = useState<WidgetId | null>(null);
  const [dropTarget, setDropTarget] = useState<WidgetId | null>(null);
  const [trafficMode, setTrafficMode] = useStoredState<'FLOW' | 'TIMELINE'>(
    'dashboard.workbench.trafficMode',
    'FLOW',
  );

  // --- Resize ---------------------------------------------------------------

  const startResize = useCallback(
    (event: MouseEvent | TouchEvent) => {
      event.preventDefault();
      setResizing(true);
      const startY = 'touches' in event ? event.touches[0].clientY : event.clientY;
      const startHeight = height;

      const onMove = (move: globalThis.MouseEvent | globalThis.TouchEvent) => {
        const currentY = 'touches' in move ? move.touches[0].clientY : move.clientY;
        // Dragging up grows the panel.
        setHeight(Math.max(MIN_HEIGHT, Math.min(MAX_HEIGHT, startHeight + (startY - currentY))));
      };
      const onEnd = () => {
        setResizing(false);
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onEnd);
        window.removeEventListener('touchmove', onMove);
        window.removeEventListener('touchend', onEnd);
      };

      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onEnd);
      window.addEventListener('touchmove', onMove);
      window.addEventListener('touchend', onEnd);
    },
    [height, setHeight],
  );

  // --- Reorder --------------------------------------------------------------

  const onDrop = useCallback(
    (event: DragEvent, target: WidgetId) => {
      event.preventDefault();
      setDropTarget(null);
      if (!dragged || dragged === target) {
        setDragged(null);
        return;
      }
      const next = [...order];
      const from = next.indexOf(dragged);
      const to = next.indexOf(target);
      if (from !== -1 && to !== -1) {
        next[from] = target;
        next[to] = dragged;
        setOrder(next);
      }
      setDragged(null);
    },
    [dragged, order, setOrder],
  );

  // --- Derived data ---------------------------------------------------------

  const distribution = useMemo(() => {
    const tally = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<Incident['priority'], number>;
    let resolved = 0;
    for (const incident of incidents) {
      tally[incident.priority] += 1;
      if (incident.status === 'RESOLVED') resolved += 1;
    }
    return [
      { label: 'Critical', value: tally.CRITICAL, color: SEVERITY_COLOR.CRITICAL },
      { label: 'High', value: tally.HIGH, color: SEVERITY_COLOR.HIGH },
      { label: 'Medium', value: tally.MEDIUM, color: SEVERITY_COLOR.MEDIUM },
      { label: 'Low', value: tally.LOW, color: SEVERITY_COLOR.LOW },
      { label: 'Resolved', value: resolved, color: STATUS.infoFill },
    ];
  }, [incidents]);

  const trafficData = useMemo(
    () =>
      trafficCorridors.map((corridor) => ({
        // Corridor names are long by design; the axis gets the road, the tooltip
        // gets the full name through the datum.
        name: corridor.roadName || corridor.name,
        observed: corridor.avgSpeedKmh,
        freeFlow: corridor.freeFlowSpeedKmh,
      })),
    [trafficCorridors],
  );

  // Recomputed only when the incident set changes: a clock-driven window would
  // rebucket every second for a strip nobody is reading that closely.
  const timeline = useMemo(() => bucketByHour(incidents, Date.now()), [incidents]);

  const renderWidget = (id: WidgetId) => {
    switch (id) {
      case 'INCIDENTS':
        return (
          <div className="flex flex-col h-full min-w-0 min-h-0">
            <WidgetHead
              icon={<PieChart size={11} />}
              title="Incident distribution"
              right={<Tally label="Open" count={incidents.filter((i) => i.status !== 'RESOLVED').length} />}
            />
            <div className="flex-1 min-h-0 overflow-y-auto ark-scroll pt-2">
              <DistributionBar segments={distribution} label="Incidents by severity" />
            </div>
          </div>
        );

      case 'TRAFFIC':
        return (
          <div className="flex flex-col h-full min-w-0 min-h-0">
            <WidgetHead
              icon={<BarChart2 size={11} />}
              title={trafficMode === 'FLOW' ? 'Corridor speed' : 'Incidents by hour'}
              right={
                <Segmented<'FLOW' | 'TIMELINE'>
                  label="Workbench chart"
                  value={trafficMode}
                  options={[
                    { value: 'FLOW', label: 'FLOW', hint: 'Observed against free-flow speed, per corridor' },
                    { value: 'TIMELINE', label: 'HRS', hint: 'Incident starts in two-hour buckets' },
                  ]}
                  onChange={setTrafficMode}
                />
              }
            />
            <div className="flex-1 min-h-0 pt-1">
              {trafficMode === 'FLOW' ? (
                <Chart
                  label="Observed versus free-flow speed by corridor"
                  data={trafficData}
                  xKey="name"
                  series={TRAFFIC_SERIES}
                  height={100}
                  showLegend={false}
                  yTickFormat={(value) => `${value}`}
                  tooltipValueFormat={(value) => `${value} km/h`}
                  emptyTitle="No corridors reporting"
                  emptyDetail="The traffic feed has not returned corridor speeds."
                  footer={
                    trafficSummary
                      ? `City average ${trafficSummary.cityAvgSpeedKmh} km/h against ${trafficSummary.cityFreeFlowAvgSpeedKmh} km/h free flow · km/h`
                      : 'km/h · city average not reported'
                  }
                />
              ) : (
                <Chart
                  label="Incident starts by two-hour bucket"
                  data={timeline.buckets}
                  xKey="time"
                  series={TIMELINE_SERIES}
                  stacked
                  height={100}
                  showLegend={false}
                  emptyTitle="No timestamped incidents"
                  footer={
                    timeline.placed === incidents.length
                      ? 'Last 12 hours, two-hour buckets'
                      : `Last 12 hours · ${timeline.placed} of ${incidents.length} incidents fall in this window`
                  }
                />
              )}
            </div>
          </div>
        );

      case 'NEWS':
        return <LiveNewsPanel className="border-0 bg-transparent p-0 h-full rounded-none" />;

      case 'CAMERAS':
        return <LiveTrafficCameraPanel className="border-0 bg-transparent p-0 h-full rounded-none" />;
    }
  };

  return (
    <section
      aria-label="Analytics workbench"
      style={{ height: collapsed ? COLLAPSED_HEIGHT : height }}
      className={cx(
        'w-full shrink-0 bg-surface border-t border-line flex flex-col overflow-hidden min-w-0',
        resizing && 'select-none',
      )}
    >
      {/* --- Resize handle ------------------------------------------------- */}
      <div
        onMouseDown={collapsed ? undefined : startResize}
        onTouchStart={collapsed ? undefined : startResize}
        onDoubleClick={() => setCollapsed((previous) => !previous)}
        role="separator"
        aria-orientation="horizontal"
        aria-label="Resize the analytics workbench"
        title={collapsed ? 'Double-click to expand' : 'Drag to resize · double-click to collapse'}
        className={cx(
          'shrink-0 h-[29px] px-3 border-b border-line bg-sunken flex items-center justify-between gap-3',
          !collapsed && 'cursor-ns-resize',
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <GripHorizontal size={12} className="text-ink-faint shrink-0" aria-hidden />
          <span className="ark-eyebrow truncate">Analytics workbench</span>
          <span className="hidden sm:inline text-[10.5px] text-ink-faint truncate">
            Drag the edge to resize · drag a panel to reorder
          </span>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {!collapsed && <span className="ark-mono text-[10px] text-ink-faint">{Math.round(height)}px</span>}
          <IconButton
            label={collapsed ? 'Expand workbench' : 'Collapse workbench'}
            icon={collapsed ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
            onClick={(event) => {
              event.stopPropagation();
              setCollapsed((previous) => !previous);
            }}
          />
        </div>
      </div>

      {/* --- Panels -------------------------------------------------------- */}
      {!collapsed && (
        <div className="flex-1 min-h-0 min-w-0 grid grid-cols-2 md:grid-cols-4 gap-px bg-line overflow-hidden">
          {order.map((id) => (
            <div
              key={id}
              draggable
              onDragStart={(event) => {
                setDragged(id);
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', id);
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
                if (dropTarget !== id) setDropTarget(id);
              }}
              onDragLeave={() => setDropTarget((current) => (current === id ? null : current))}
              onDrop={(event) => onDrop(event, id)}
              onDragEnd={() => {
                setDragged(null);
                setDropTarget(null);
              }}
              className={cx(
                'relative bg-surface p-2.5 flex flex-col min-w-0 min-h-0 group',
                dragged === id && 'opacity-40',
                dropTarget === id && dragged !== id && 'bg-accent-soft ring-1 ring-inset ring-accent-border',
              )}
            >
              <GripVertical
                size={11}
                aria-hidden
                className="absolute top-2 right-2 text-ink-faint opacity-0 group-hover:opacity-100 cursor-grab active:cursor-grabbing"
              />
              {renderWidget(id)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
});

/** Shared panel header, so the four workbench panels cannot drift apart. */
const WidgetHead = memo(function WidgetHead({
  icon,
  title,
  right,
}: {
  icon: ReactNode;
  title: string;
  right?: ReactNode;
}) {
  return (
    <div className="shrink-0 flex items-center justify-between gap-2 pb-1.5 border-b border-line min-w-0">
      <span className="flex items-center gap-1.5 min-w-0">
        <span className="text-ink-faint shrink-0">{icon}</span>
        <span className="ark-eyebrow truncate">{title}</span>
      </span>
      {right && <div className="shrink-0 mr-4">{right}</div>}
    </div>
  );
});
