/**
 * Event correlation — where the same thing shows up on two systems.
 *
 * The IA asks for correlation "between events from cameras, traffic, weather,
 * utilities, infrastructure, sensors". ARKA can answer that honestly because the
 * event stream already carries the join: every `ArkaEvent` names the entities it
 * is about in `subjects: EntityRef[]`, and every entity has a `related` list.
 * Two events that name the same entity, or name entities related to each other,
 * within a short window, are talking about one occurrence.
 *
 * **This is a co-occurrence view, not a causal model, and the page says so where
 * an operator will read it.** There is no inference engine in this codebase.
 * Grouping a junction camera detection with a corridor slowdown four minutes
 * later is a statement that both events named the same corridor in the same few
 * minutes — which is genuinely useful, because it saves an operator holding six
 * panels in their head — but it is not a claim that one caused the other, and it
 * carries no confidence score, because nothing computed one.
 *
 * What the grouping is:
 *
 * - **Key:** the subject entity. An event with no subjects cannot be correlated
 *   with anything and is counted separately rather than dropped silently.
 * - **Window:** a configurable span, defaulting to 15 minutes. Two events on the
 *   same subject further apart than the window are separate occurrences, not one
 *   long one.
 * - **Threshold:** a cluster needs events from at least two different systems.
 *   Three camera detections at one junction are one system repeating itself, and
 *   surfacing that as a correlation would fill the page with noise.
 *
 * Nothing here is stored. The event stream is in memory for the session, so a
 * cluster is discarded on reload, and the page states that rather than implying a
 * correlation history.
 */

import { useMemo } from 'react';
import { Clock3, Layers, Link2, Network, ShieldQuestion } from 'lucide-react';
import {
  Button,
  DataStateTag,
  EmptyState,
  FilterBar,
  Metric,
  MetricGrid,
  Page,
  PageBody,
  PageSection,
  Panel,
  PanelBody,
  PanelFoot,
  PanelHead,
  Segmented,
  SeverityBadge,
  Timeline,
  TimelineItem,
  useStoredState,
} from '../../ui';
import { ModuleHeader } from '../../shell/navigation';
import { arkaNav, useEntitySlice, useEvents } from '../../store/useArka';
import { EVENT_KIND_LABEL, EVENT_TONE_RANK, type ArkaEvent, type EventKind } from '../../store/events';
import { ENTITY_KIND_LABEL, refKey, type EntityKind, type EntityRef } from '../../store/entities';

/**
 * Which operational system each event kind belongs to.
 *
 * The cluster threshold counts distinct systems, so this table decides what
 * "two systems agree" means. Incident detection and incident status are one
 * system: a status change following a detection is a workflow, not corroboration.
 */
const SYSTEM_OF: Record<EventKind, string> = {
  INCIDENT_DETECTED: 'Incidents',
  INCIDENT_STATUS: 'Incidents',
  AI_ANOMALY: 'AI analysis',
  CAMERA_DETECTION: 'Cameras',
  SENSOR_EVENT: 'Sensors',
  TRAFFIC_ANOMALY: 'Mobility',
  WEATHER_ALERT: 'Environment',
  INFRASTRUCTURE_EVENT: 'Infrastructure',
  UTILITY_EVENT: 'Utilities',
  DRONE_OBSERVATION: 'Drones',
  RESOURCE_DISPATCH: 'Resources',
  ADVISORY: 'Intelligence',
  FEED_STATUS: 'Platform',
  OPERATOR_ACTION: 'Operator',
};

type WindowChoice = '5' | '15' | '60';

const WINDOW_LABEL: Record<WindowChoice, string> = {
  '5': '5 min',
  '15': '15 min',
  '60': '1 hour',
};

/**
 * Events whose kind is bookkeeping rather than observation.
 *
 * A feed dropping and reconnecting names no city entity, and letting platform
 * chatter into the clusters would correlate ARKA with itself.
 */
const EXCLUDED_KINDS: ReadonlySet<EventKind> = new Set<EventKind>(['FEED_STATUS']);

interface Cluster {
  /** The entity every member event names. */
  subject: EntityRef;
  label: string;
  events: ArkaEvent[];
  systems: string[];
  /** Newest member, which is what the list sorts on. */
  latest: string;
  /** Worst tone across members, for the rail. */
  rank: number;
}

/**
 * Groups events into per-subject clusters inside the window.
 *
 * Time-ordered, so a gap larger than the window starts a new cluster on the same
 * subject rather than stretching one cluster across an afternoon.
 */
function buildClusters(
  events: readonly ArkaEvent[],
  windowMs: number,
  labelFor: (ref: EntityRef) => string,
): Cluster[] {
  const bySubject = new Map<string, { ref: EntityRef; events: ArkaEvent[] }>();

  for (const event of events) {
    if (EXCLUDED_KINDS.has(event.kind)) continue;
    for (const subject of event.subjects) {
      const key = refKey(subject);
      const bucket = bySubject.get(key);
      if (bucket) bucket.events.push(event);
      else bySubject.set(key, { ref: subject, events: [event] });
    }
  }

  const clusters: Cluster[] = [];

  for (const { ref, events: subjectEvents } of bySubject.values()) {
    // Oldest first so the window walk is a single pass.
    const ordered = [...subjectEvents].sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    let run: ArkaEvent[] = [];
    let runStart = 0;

    const flush = () => {
      if (run.length < 2) {
        run = [];
        return;
      }
      const systems = [...new Set(run.map((event) => SYSTEM_OF[event.kind]))];
      // One system talking to itself is not a correlation.
      if (systems.length < 2) {
        run = [];
        return;
      }
      clusters.push({
        subject: ref,
        label: labelFor(ref),
        events: [...run].reverse(),
        systems,
        latest: run[run.length - 1].at,
        rank: Math.min(...run.map((event) => EVENT_TONE_RANK[event.tone])),
      });
      run = [];
    };

    for (const event of ordered) {
      const at = Date.parse(event.at);
      if (run.length === 0) {
        run = [event];
        runStart = Number.isNaN(at) ? Date.now() : at;
        continue;
      }
      if (!Number.isNaN(at) && at - runStart > windowMs) {
        flush();
        run = [event];
        runStart = at;
        continue;
      }
      run.push(event);
    }
    flush();
  }

  // Worst first, then most recent: an operator scanning this page is triaging.
  return clusters.sort((a, b) => a.rank - b.rank || Date.parse(b.latest) - Date.parse(a.latest));
}

export function CorrelationView() {
  const events = useEvents();
  const slice = useEntitySlice();
  const [choice, setChoice] = useStoredState<WindowChoice>('correlation.window', '15');

  const windowMs = Number(choice) * 60_000;

  /**
   * Resolves a ref to the name the rest of the platform uses for it.
   *
   * Falls back to the kind and id when the entity has since left the store — the
   * event is still a true statement about a moment, so it must not vanish because
   * the corridor it named is no longer in the current snapshot.
   */
  const labelFor = useMemo(() => {
    return (ref: EntityRef): string => {
      const found = slice.index.get(refKey(ref));
      if (found) return found.label;
      return `${ENTITY_KIND_LABEL[ref.kind].one} ${ref.id}`;
    };
  }, [slice]);

  const clusters = useMemo(
    () => buildClusters(events, windowMs, labelFor),
    [events, windowMs, labelFor],
  );

  const stats = useMemo(() => {
    const considered = events.filter((event) => !EXCLUDED_KINDS.has(event.kind));
    const unattributed = considered.filter((event) => event.subjects.length === 0).length;
    const correlated = new Set<string>();
    for (const cluster of clusters) for (const event of cluster.events) correlated.add(event.id);
    const systems = new Set<string>();
    for (const cluster of clusters) for (const system of cluster.systems) systems.add(system);
    return {
      considered: considered.length,
      unattributed,
      correlated: correlated.size,
      systems: systems.size,
    };
  }, [events, clusters]);

  /** Which entity kinds are represented, for the coverage note. */
  const kindsSeen = useMemo(() => {
    const kinds = new Set<EntityKind>();
    for (const cluster of clusters) kinds.add(cluster.subject.kind);
    return [...kinds];
  }, [clusters]);

  return (
    <Page>
      <ModuleHeader
        item="Event Correlation"
        subtitle="Events from different systems that named the same city entity within a short window. Co-occurrence, not causation."
        meta={
          <>
            <span className="ark-tag">CO-OCCURRENCE</span>
            <span className="text-[11px] text-ink-faint">
              {stats.considered} event{stats.considered === 1 ? '' : 's'} in this session
            </span>
          </>
        }
        toolbar={
          <FilterBar>
            <Segmented<WindowChoice>
              label="Correlation window"
              value={choice}
              options={(['5', '15', '60'] as WindowChoice[]).map((value) => ({
                value,
                label: WINDOW_LABEL[value],
                hint: `Events on one entity within ${WINDOW_LABEL[value]} of each other are treated as one occurrence`,
              }))}
              onChange={setChoice}
            />
          </FilterBar>
        }
      />

      <PageBody>
        <MetricGrid columns={4}>
          <Metric
            label="Clusters"
            value={clusters.length}
            icon={<Link2 size={13} />}
            tone={clusters.length > 0 ? 'accent' : 'default'}
            hint="Groups where at least two different systems reported on the same entity inside the window."
          />
          <Metric
            label="Events correlated"
            value={stats.correlated}
            unit={`/ ${stats.considered}`}
            icon={<Layers size={13} />}
          />
          <Metric
            label="Systems involved"
            value={stats.systems}
            icon={<Network size={13} />}
            hint="Distinct operational systems contributing to at least one cluster."
          />
          <Metric
            label="Unattributed"
            value={stats.unattributed}
            icon={<ShieldQuestion size={13} />}
            tone={stats.unattributed > 0 ? 'medium' : 'default'}
            hint="Events naming no entity. Nothing can be correlated against them; they are counted rather than hidden."
          />
        </MetricGrid>

        <PageSection
          title="Correlated occurrences"
          hint={`Window ${WINDOW_LABEL[choice]}`}
        >
          {clusters.length === 0 ? (
            <Panel>
              <EmptyState
                title={
                  stats.considered === 0
                    ? 'No events to correlate yet'
                    : 'Nothing corroborated across systems'
                }
                detail={
                  stats.considered === 0
                    ? 'The stream starts empty on every visit — no event history is persisted in this deployment. Clusters appear as the feeds report.'
                    : `${stats.considered} events arrived this session, but no two from different systems named the same entity within ${WINDOW_LABEL[choice]}. Widen the window, or take this as a quiet city: a correlation needs two systems to independently notice one thing.`
                }
                icon={<Network size={18} />}
              />
            </Panel>
          ) : (
            <div className="space-y-2">
              {clusters.map((cluster) => (
                <Panel key={`${refKey(cluster.subject)}-${cluster.latest}`}>
                  <PanelHead
                    title={cluster.label}
                    icon={<Link2 size={13} />}
                    meta={
                      <>
                        <span className="ark-tag">
                          {ENTITY_KIND_LABEL[cluster.subject.kind].one.toUpperCase()}
                        </span>
                        <span className="ark-tag">
                          {cluster.systems.length} SYSTEMS
                        </span>
                        <span className="ark-tag">
                          {cluster.events.length} EVENT{cluster.events.length === 1 ? '' : 'S'}
                        </span>
                      </>
                    }
                    actions={
                      <Button
                        variant="quiet"
                        size="xs"
                        onClick={() => arkaNav.open(cluster.subject)}
                      >
                        Open {ENTITY_KIND_LABEL[cluster.subject.kind].one.toLowerCase()}
                      </Button>
                    }
                  />
                  <PanelBody>
                    <p className="mb-2 text-[11px] text-ink-faint">
                      Reported by {cluster.systems.join(', ')}
                    </p>
                    <Timeline>
                      {cluster.events.map((event) => (
                        <TimelineItem
                          key={event.id}
                          title={event.title}
                          at={event.at}
                          actor={event.provider}
                          detail={event.detail}
                          state={event.tone === 'resolved' ? 'done' : 'current'}
                          meta={
                            <>
                              <span className="ark-tag">{SYSTEM_OF[event.kind]}</span>
                              <span className="ark-tag">{EVENT_KIND_LABEL[event.kind]}</span>
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
                  </PanelBody>
                </Panel>
              ))}
            </div>
          )}
        </PageSection>

        {/* --- What this page is, precisely --------------------------------- */}
        <PageSection title="Method">
          <Panel>
            <PanelHead title="How a cluster is formed" icon={<Clock3 size={13} />} />
            <PanelBody className="space-y-1.5 text-[11.5px] text-ink-subtle leading-relaxed">
              <p>
                <span className="ark-label">The join is the entity, not a model</span>
                <br />
                Every event names the entities it is about. Two events from different systems that
                name the same entity within {WINDOW_LABEL[choice]} are shown together. That is the
                whole rule — there is no inference engine, no learned weighting and no confidence
                score, because nothing in this deployment computes one.
              </p>
              <p>
                <span className="ark-label">Co-occurrence is not causation</span>
                <br />
                A camera detection and a corridor slowdown on the same road in the same ten minutes
                are very often the same event seen twice. They are sometimes two unrelated things.
                This page cannot tell you which, and does not pretend to.
              </p>
              <p>
                <span className="ark-label">One system repeating itself is filtered out</span>
                <br />
                A cluster needs two distinct systems. Three detections from one camera are the camera
                being consistent, not corroboration.
              </p>
              <p>
                <span className="ark-label">Nothing is retained</span>
                <br />
                The event stream lives in memory for this session only. Reloading discards it, so
                this page has no history and cannot be used as an audit record.
              </p>
            </PanelBody>
            <PanelFoot>
              <span className="text-[11px] text-ink-faint">
                {kindsSeen.length === 0
                  ? 'Correlation spans whichever entity kinds the connected feeds report on.'
                  : `Currently correlating across: ${kindsSeen
                      .map((kind) => ENTITY_KIND_LABEL[kind].many.toLowerCase())
                      .join(', ')}.`}
              </span>
            </PanelFoot>
          </Panel>
        </PageSection>
      </PageBody>
    </Page>
  );
}
