/**
 * ARKA record cards.
 *
 * Three cards cover every "one record, summarised" surface in the platform: an
 * asset (anything with an entity envelope), an incident, and an OpenClaw agent.
 * The previous interface had a bespoke card per page — the live map alone carried
 * five near-identical telemetry panels — and they drifted until the same camera
 * looked like three different objects depending on where you found it.
 *
 * Two rules apply to all three:
 *
 * 1. **Provenance travels with the record.** Every card can say where its values
 *    came from and how old they are. A card that shows numbers without that is a
 *    card that will be read as live when it is a week-old cache.
 *
 * 2. **Absence is stated.** Missing fields render NOT REPORTED through `Field`,
 *    and an unsupported model score renders UNSCORED. Nothing here substitutes a
 *    plausible number for a value the platform does not have.
 */

import { memo, type KeyboardEvent, type ReactNode } from 'react';
import {
  BarChart2,
  Building2,
  Car,
  ChevronRight,
  CloudRain,
  Cpu,
  Globe,
  MapPin,
  Radio,
  Shield,
} from 'lucide-react';
import type { Incident, OpenClawAgentStatus, OpenClawWorkflowStep, Severity } from '../types';
import type { EntityEnvelope } from '../store/entities';
import { ENTITY_KIND_LABEL } from '../store/entities';
import { cx } from './cx';
import { Field, FieldLine } from './surfaces';
import { Spinner } from './primitives';
import {
  Age,
  Confidence,
  DataStateTag,
  HealthDot,
  OperationalBadge,
  SEVERITY_RAIL,
  SeverityBadge,
  StatusBadge,
  type BadgeTone,
} from './status';

// --- Shared card shell -------------------------------------------------------

/**
 * One value shown on a card.
 *
 * `value` of null is the honest case and renders NOT REPORTED, which is why this
 * is a list of pairs rather than a formatted string the caller builds.
 */
export interface CardStat {
  label: string;
  value: ReactNode | null | undefined;
  hint?: string;
  mono?: boolean;
}

interface CardShellProps {
  children: ReactNode;
  /** Severity rail on the leading edge. Position as well as hue. */
  rail?: Severity | null;
  selected?: boolean;
  onSelect?: () => void;
  /** Accessible name for the whole-card click target. */
  selectLabel?: string;
  className?: string;
}

/**
 * The card frame.
 *
 * Rendered as a `div` with `role="button"` rather than a real `<button>`, because
 * a card carries its own action controls and nesting buttons is invalid. Keyboard
 * activation is wired explicitly, and the action cluster stops propagation so
 * "Acknowledge" never also opens the drawer behind it.
 */
function CardShell({ children, rail, selected = false, onSelect, selectLabel, className }: CardShellProps) {
  const interactive = Boolean(onSelect);

  function activate(event: KeyboardEvent<HTMLDivElement>) {
    if (!onSelect) return;
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onSelect();
    }
  }

  return (
    <div
      className={cx(
        'ark-inset p-2.5 min-w-0',
        rail && `ark-rail ark-rail-${SEVERITY_RAIL[rail]}`,
        interactive && 'ark-inset-interactive',
        selected && 'is-selected',
        className,
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      aria-label={interactive ? selectLabel : undefined}
      aria-current={interactive && selected ? true : undefined}
      onClick={onSelect}
      onKeyDown={interactive ? activate : undefined}
    >
      {children}
    </div>
  );
}

/** Action cluster for a card. Swallows the click so the card does not also fire. */
export function CardActions({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx('flex items-center gap-1.5 shrink-0', className)}
      onClick={(event) => event.stopPropagation()}
      onKeyDown={(event) => event.stopPropagation()}
    >
      {children}
    </div>
  );
}

function StatGrid({ stats, columns = 2 }: { stats: readonly CardStat[]; columns?: 2 | 3 }) {
  if (stats.length === 0) return null;
  return (
    <div className={cx('mt-2 grid gap-x-3 gap-y-1.5', columns === 3 ? 'grid-cols-3' : 'grid-cols-2')}>
      {stats.map((stat) => (
        <Field key={stat.label} label={stat.label} value={stat.value} hint={stat.hint} mono={stat.mono} />
      ))}
    </div>
  );
}

// --- Asset card --------------------------------------------------------------

export interface AssetCardProps {
  /** The canonical record. Supplies identity, health, position and provenance. */
  entity: EntityEnvelope;
  /**
   * Domain status verbatim from the payload — 'PATROLLING', 'CRITICAL_OUTAGE'.
   * The health dot is the coarse roll-up; this is the precise word.
   */
  status?: string | null;
  /** Overrides the kind name in the eyebrow, e.g. 'Pump station' for a utility. */
  kindLabel?: string;
  stats?: readonly CardStat[];
  statColumns?: 2 | 3;
  /** Extra badges after the status, e.g. a stream-quality tag. */
  badges?: ReactNode;
  actions?: ReactNode;
  /** Rendered below the stats: a sparkline, a meter, a thumbnail. */
  children?: ReactNode;
  selected?: boolean;
  onSelect?: () => void;
  /** Drops the stat grid and the position line, for a dense roster column. */
  compact?: boolean;
  className?: string;
}

/**
 * The one card for any tracked asset: camera, drone, hydrant, substation, unit.
 *
 * It takes an `EntityEnvelope` rather than loose props so that a page cannot
 * render an asset without its data state — the envelope makes provenance
 * structurally unavoidable, and this card is where that pays off.
 */
export const AssetCard = memo(function AssetCard({
  entity,
  status,
  kindLabel,
  stats = [],
  statColumns = 2,
  badges,
  actions,
  children,
  selected = false,
  onSelect,
  compact = false,
  className,
}: AssetCardProps) {
  const kind = kindLabel ?? ENTITY_KIND_LABEL[entity.kind].one;

  return (
    <CardShell
      rail={entity.severity}
      selected={selected}
      onSelect={onSelect}
      selectLabel={`Inspect ${entity.label}`}
      className={className}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <HealthDot health={entity.health} className="mt-[5px]" live={entity.state === 'LIVE'} />
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-ink truncate" title={entity.label}>
              {entity.label}
            </div>
            <div className="mt-0.5 flex items-center gap-1.5 flex-wrap">
              <span className="ark-label">{kind}</span>
              {status && <OperationalBadge status={status} />}
              {badges}
            </div>
          </div>
        </div>
        {actions ? <CardActions>{actions}</CardActions> : onSelect ? (
          <ChevronRight size={13} className="text-ink-faint shrink-0 mt-0.5" aria-hidden />
        ) : null}
      </div>

      {!compact && <StatGrid stats={stats} columns={statColumns} />}
      {children && <div className="mt-2">{children}</div>}

      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <DataStateTag state={entity.state} source={entity.source} error={null} />
        <div className="flex items-center gap-2 min-w-0">
          {!compact && entity.position && (
            <span className="ark-mono text-[10px] text-ink-faint truncate" title="Reported position">
              <MapPin size={9} className="inline mr-0.5 -mt-0.5" aria-hidden />
              {entity.position.lat.toFixed(4)}, {entity.position.lng.toFixed(4)}
            </span>
          )}
          <Age iso={entity.observedAt} />
        </div>
      </div>
    </CardShell>
  );
});

// --- Incident card -----------------------------------------------------------

const ESCALATION_TONE: Record<NonNullable<Incident['escalationRisk']>, BadgeTone> = {
  CRITICAL: 'critical',
  HIGH: 'high',
  MODERATE: 'medium',
  LOW: 'low',
};

/**
 * Signals behind an incident's confidence score.
 *
 * Mirrors the gate in `src/store/ingest/incidents.ts`: a score is only shown when
 * the record also carries the evidence or the reasoning that produced it. The old
 * incident panel printed a flat "CONFIDENCE 94%" on every incident including ones
 * no model had ever seen.
 */
function confidenceBasis(incident: Incident): string[] {
  const sources = incident.evidenceSources ?? [];
  if (sources.length > 0) return sources;
  return incident.reasoning ? ['Model reasoning attached'] : [];
}

export interface IncidentCardProps {
  incident: Incident;
  /** Provenance of the record, from its entity envelope. */
  state?: EntityEnvelope['state'];
  source?: EntityEnvelope['source'] | null;
  selected?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
  /** Title, severity, location and age only. For the map list and the ticker rail. */
  compact?: boolean;
  className?: string;
}

/**
 * The one incident summary.
 *
 * Used on the dashboard, in the incident centre, in the map's inline drawer and
 * in the intelligence feed. Severity is carried by the rail *and* the badge word,
 * so it survives a washed-out wall display.
 */
export const IncidentCard = memo(function IncidentCard({
  incident,
  state,
  source,
  selected = false,
  onSelect,
  actions,
  compact = false,
  className,
}: IncidentCardProps) {
  const basis = confidenceBasis(incident);

  return (
    <CardShell
      rail={incident.priority}
      selected={selected}
      onSelect={onSelect}
      selectLabel={`Open incident ${incident.id}: ${incident.title}`}
      className={className}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <SeverityBadge severity={incident.priority} solid={incident.priority === 'CRITICAL'} />
            <span className="ark-tag">{incident.category}</span>
            <OperationalBadge status={incident.status} />
            {incident.escalationRisk && (
              <StatusBadge
                label={`ESC ${incident.escalationRisk}`}
                tone={ESCALATION_TONE[incident.escalationRisk]}
                hint="Assessed risk of this incident escalating if not resolved."
              />
            )}
          </div>
          <h4 className="mt-1.5 text-[13px] font-semibold text-ink leading-snug line-clamp-2" title={incident.title}>
            {incident.title}
          </h4>
          <div className="mt-1 flex items-center gap-1 min-w-0 text-[11.5px] text-ink-subtle">
            <MapPin size={10} className="shrink-0" aria-hidden />
            <span className="truncate" title={incident.location.address}>
              {incident.location.name}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="ark-mono text-[10px] text-ink-faint">{incident.id}</span>
          <Age iso={incident.timestamp} />
        </div>
      </div>

      {!compact && (
        <>
          <div className="mt-2 grid grid-cols-2 gap-x-3">
            <FieldLine label="Agency" value={incident.agencyAssigned} mono={false} />
            <FieldLine label="Units dispatched" value={incident.unitsDispatched ?? null} />
            <FieldLine
              label="Est. resolution"
              value={incident.estimatedResolutionMin != null ? `${incident.estimatedResolutionMin} min` : null}
            />
            <FieldLine label="Impact" value={incident.estimatedImpact} mono={false} />
          </div>

          {incident.recommendedAction && (
            <div className="mt-2">
              <div className="ark-label">Recommended action</div>
              <p className="mt-0.5 text-[11.5px] text-ink-muted leading-relaxed line-clamp-2">
                {incident.recommendedAction}
              </p>
            </div>
          )}
        </>
      )}

      <div className="mt-2 flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 min-w-0">
          {state && <DataStateTag state={state} source={source ?? null} error={null} />}
          <Confidence value={incident.aiConfidence} basis={basis} />
        </div>
        {actions && <CardActions>{actions}</CardActions>}
      </div>
    </CardShell>
  );
});

// --- Agent card --------------------------------------------------------------

/**
 * Agent avatars.
 *
 * Keyed by the `iconName` strings the orchestrator already emits, resolved
 * statically so the seven icons are the only ones bundled — a dynamic lookup into
 * lucide's index would pull the entire icon set into the chunk.
 */
const AGENT_ICON: Record<string, typeof Shield> = {
  Shield,
  Globe,
  Radio,
  Car,
  CloudRain,
  Building2,
  BarChart2,
};

export interface AgentCardProps {
  agent: OpenClawAgentStatus;
  /** The step this agent is executing right now, when one is in flight. */
  step?: OpenClawWorkflowStep | null;
  /** Steps this agent has completed in the current execution. */
  completedSteps?: number;
  selected?: boolean;
  onSelect?: () => void;
  actions?: ReactNode;
  className?: string;
}

/**
 * One OpenClaw agent, as an operational readout.
 *
 * Deliberately not a chat bubble. An operator supervising seven agents needs to
 * see role, state, the task in hand and the tool being run — the reasoning belongs
 * in the drawer, behind a click, not spread across the workspace as prose.
 */
export const AgentCard = memo(function AgentCard({
  agent,
  step = null,
  completedSteps,
  selected = false,
  onSelect,
  actions,
  className,
}: AgentCardProps) {
  const Icon = AGENT_ICON[agent.iconName] ?? Cpu;
  const awaiting = step?.status === 'AWAITING_CONFIRMATION';

  return (
    <CardShell
      selected={selected}
      onSelect={onSelect}
      selectLabel={`Inspect ${agent.name}`}
      className={cx(awaiting && 'border-warning-border bg-warning-soft', className)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex items-start gap-2">
          <span className="mt-[1px] text-ink-subtle shrink-0" aria-hidden>
            <Icon size={14} strokeWidth={1.6} />
          </span>
          <div className="min-w-0">
            <div className="text-[12.5px] font-semibold text-ink truncate">{agent.name}</div>
            <div className="text-[11px] text-ink-faint truncate" title={agent.role}>
              {agent.role}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {agent.status === 'BUSY' && <Spinner size={11} className="text-accent" />}
          <OperationalBadge status={agent.status} />
        </div>
      </div>

      <div className="mt-2">
        <div className="ark-label">Current task</div>
        {agent.currentTask ? (
          <p className="mt-0.5 text-[11.5px] text-ink-muted leading-relaxed line-clamp-2">{agent.currentTask}</p>
        ) : (
          <div className="ark-unknown mt-0.5" title="This agent has not been assigned work in the current execution.">
            NO TASK ASSIGNED
          </div>
        )}
      </div>

      {step && (
        <div className="mt-2 pt-2 border-t border-line">
          <div className="flex items-center justify-between gap-2">
            <span className="ark-mono text-[11px] text-ink truncate" title={step.description}>
              {step.toolName}
            </span>
            <OperationalBadge status={step.status} />
          </div>
          <div className="mt-1 flex items-center justify-between gap-2">
            <span className="text-[11px] text-ink-faint truncate">{step.description}</span>
            {step.durationMs != null && (
              <span className="ark-mono text-[10px] text-ink-subtle shrink-0">{step.durationMs} ms</span>
            )}
          </div>
        </div>
      )}

      {(completedSteps != null || actions) && (
        <div className="mt-2 flex items-center justify-between gap-2">
          {completedSteps != null ? (
            <span className="ark-mono text-[10px] text-ink-faint">
              {completedSteps} step{completedSteps === 1 ? '' : 's'} this execution
            </span>
          ) : (
            <span />
          )}
          {actions && <CardActions>{actions}</CardActions>}
        </div>
      )}
    </CardShell>
  );
});
