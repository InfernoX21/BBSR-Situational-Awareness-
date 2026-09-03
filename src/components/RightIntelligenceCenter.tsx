/**
 * The dashboard's right column: alerts, intelligence and fleet availability.
 *
 * Three stacked panels sharing one vocabulary — `IncidentCard` for alerts (the
 * same card the incident centre and the map drawer use), `Row` for bulletins,
 * `Meter` for availability. The previous version hand-rolled all three, which is
 * why a critical incident looked different here than it did two panels away.
 *
 * Removed deliberately:
 *
 * - The cyan glow, `animate-pulse` and slide-in on items whose `publishedTime`
 *   read "Just now". Those were fed by a pool of pre-written headlines that no
 *   longer exists, and a pulsing border is a decorative animation regardless.
 * - `item.classification || 'LIVE'`, which stamped LIVE on any bulletin whose
 *   feed did not classify it. Unclassified now reads as unclassified.
 * - The pulsing radio icon on the fleet header.
 */

import { memo, useMemo, useState } from 'react';
import { ChevronRight, ExternalLink, Newspaper, Siren, Truck } from 'lucide-react';
import type { Incident, IntelligenceItem, ResourceUnit, Severity } from '../types';
import {
  Age,
  Button,
  EmptyState,
  FilterGroup,
  IncidentCard,
  Meter,
  Panel,
  PanelBody,
  PanelHead,
  Row,
  StatusBadge,
  cx,
} from '../ui';

interface RightIntelligenceCenterProps {
  incidents: Incident[];
  intelligenceItems: IntelligenceItem[];
  resources?: ResourceUnit[];
  onSelectIncident: (incident: Incident) => void;
  onOpenArticle: (item: IntelligenceItem) => void;
  onViewAllAlerts: () => void;
}

const SEVERITIES: readonly Severity[] = ['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'];

/** Availability tone: plenty free, thin, or effectively committed. */
function availabilityTone(pct: number | null): 'low' | 'medium' | 'critical' {
  if (pct == null) return 'medium';
  if (pct > 60) return 'low';
  if (pct > 25) return 'medium';
  return 'critical';
}

export const RightIntelligenceCenter = memo(function RightIntelligenceCenter({
  incidents,
  intelligenceItems,
  resources = [],
  onSelectIncident,
  onOpenArticle,
  onViewAllAlerts,
}: RightIntelligenceCenterProps) {
  // Empty means no constraint, which is the filter component's contract — there
  // is no separate "ALL" chip to keep in sync with the real options.
  const [severity, setSeverity] = useState<Severity[]>([]);

  const counts = useMemo(() => {
    const tally = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 } as Record<Severity, number>;
    for (const incident of incidents) tally[incident.priority] += 1;
    return tally;
  }, [incidents]);

  const filtered = useMemo(
    () => (severity.length === 0 ? incidents : incidents.filter((i) => severity.includes(i.priority))),
    [incidents, severity],
  );

  return (
    <aside
      className="hidden lg:flex w-72 xl:w-80 shrink-0 border-l border-line bg-surface flex-col min-h-0 min-w-0 divide-y divide-line"
      aria-label="Intelligence centre"
    >
      {/* --- Live alerts ---------------------------------------------------- */}
      <Panel flush scroll className="flex-1 basis-0">
        <PanelHead
          title="Live alerts"
          icon={<Siren size={13} />}
          count={incidents.length}
          actions={
            <Button variant="quiet" size="xs" onClick={onViewAllAlerts} trailing={<ChevronRight size={11} />}>
              All
            </Button>
          }
        />
        <div className="shrink-0 px-3 py-2 border-b border-line">
          <FilterGroup
            label="Severity"
            options={SEVERITIES.map((value) => ({ value, label: value.slice(0, 4), count: counts[value] }))}
            selected={severity}
            onChange={setSeverity}
          />
        </div>
        <PanelBody className="space-y-1.5">
          {filtered.length === 0 ? (
            <EmptyState
              compact
              title={incidents.length === 0 ? 'No active alerts' : 'None at this severity'}
              detail={
                incidents.length === 0
                  ? 'Nothing is currently open against the city.'
                  : 'Clear the severity filter to see the rest.'
              }
            />
          ) : (
            filtered
              .slice(0, 12)
              .map((incident) => (
                <IncidentCard
                  key={incident.id}
                  incident={incident}
                  compact
                  onSelect={() => onSelectIncident(incident)}
                />
              ))
          )}
        </PanelBody>
      </Panel>

      {/* --- Intelligence -------------------------------------------------- */}
      <Panel flush scroll className="flex-1 basis-0">
        <PanelHead
          title="Intelligence"
          icon={<Newspaper size={13} />}
          count={intelligenceItems.length}
          meta={<span className="ark-tag">RSS · GOVT</span>}
        />
        <PanelBody className="space-y-1.5">
          {intelligenceItems.length === 0 ? (
            <EmptyState
              compact
              title="No bulletins"
              detail="The intelligence feed has returned nothing for this jurisdiction."
            />
          ) : (
            intelligenceItems.map((item) => (
              <Row key={item.id} onClick={() => onOpenArticle(item)} className="group flex-col items-stretch">
                <div className="flex items-center justify-between gap-2 min-w-0">
                  <span className="text-[11px] font-medium text-accent truncate">{item.publisherName}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.classification ? (
                      <span className="ark-tag">{item.classification}</span>
                    ) : (
                      <span className="ark-unknown" title="The feed did not classify this bulletin.">
                        UNCLASSIFIED
                      </span>
                    )}
                    {/* publishedAt is the orderable moment; publishedTime is a
                        display string that has lost its date, so it cannot be
                        aged and is shown verbatim as the feed wrote it. */}
                    {item.publishedAt ? (
                      <Age iso={item.publishedAt} />
                    ) : (
                      <span className="ark-mono text-[10.5px] text-ink-faint">{item.publishedTime}</span>
                    )}
                  </div>
                </div>
                <h4 className="mt-1 text-[12px] font-medium text-ink leading-snug line-clamp-2 group-hover:text-accent">
                  {item.headline}
                </h4>
                <p className="mt-0.5 text-[11px] text-ink-subtle leading-relaxed line-clamp-2">{item.summary}</p>
                <div className="mt-1.5 flex items-center justify-between gap-2">
                  <span className="ark-tag">{item.category}</span>
                  <span className="flex items-center gap-1 text-[10.5px] text-ink-faint group-hover:text-accent">
                    Summary
                    <ExternalLink size={9} aria-hidden />
                  </span>
                </div>
              </Row>
            ))
          )}
        </PanelBody>
      </Panel>

      {/* --- Fleet availability -------------------------------------------- */}
      <Panel flush className="shrink-0">
        <PanelHead
          title="Fleet availability"
          icon={<Truck size={13} />}
          meta={
            <StatusBadge
              label="STATIC ROSTER"
              tone="medium"
              hint="Establishment strength from the agency roster. ARKA has no vehicle-telematics feed, so these are not live positions."
            />
          }
        />
        <div className="px-3 py-2 space-y-2">
          {resources.length === 0 ? (
            <p className="text-[11px] text-ink-faint">No roster loaded.</p>
          ) : (
            resources.map((unit) => {
              // A pool with no establishment is unknown, not zero per cent.
              const pct = unit.total > 0 ? Math.round((unit.available / unit.total) * 100) : null;
              return (
                <div key={unit.id} className="space-y-1">
                  <div className="flex items-baseline justify-between gap-2 text-[11.5px]">
                    <span className="truncate text-ink-muted">{unit.name}</span>
                    <span className="ark-mono text-[11px] shrink-0">
                      <strong
                        className={cx(
                          'font-semibold',
                          pct == null ? 'text-ink-faint' : pct > 25 ? 'text-success' : 'text-critical',
                        )}
                      >
                        {unit.available}
                      </strong>
                      <span className="text-ink-faint">/{unit.total}</span>
                    </span>
                  </div>
                  <Meter value={pct} tone={availabilityTone(pct)} />
                </div>
              );
            })
          )}
        </div>
      </Panel>
    </aside>
  );
});
