/**
 * Route calculation panel.
 *
 * Shows what the routing engine actually did: which facility was chosen and why,
 * the road distance, the streets traversed, the validation checks that passed,
 * and the dataset the whole thing was calculated against.
 *
 * Two things this panel deliberately does not do. It never shows an ETA, because
 * the road dataset publishes no speed attribute and a plausible-looking number
 * would be a guess. And it never shows a route that failed validation — a failure
 * gets its reason printed instead of a line on the map.
 */

import React, { useState } from 'react';
import {
  AlertTriangle,
  ChevronDown,
  Crosshair,
  HeartPulse,
  ListChecks,
  Loader2,
  Navigation,
  Shield,
  X,
} from 'lucide-react';
import type { DispatchRouteKey, DispatchRouteView, DispatchRoutesState } from './useDispatchRoutes';
import type { RankedRoute } from '../../services/routing/RouteIntelligence';
import { GIS_SOURCE_STATE_LABEL, GIS_SOURCE_STATE_TONE } from '../../services/gis/types';

interface RoutePanelProps extends DispatchRoutesState {
  incidentTitle: string | null;
  /** Corridor resolution progress, so the operator knows why lines are missing. */
  corridorStatus?: {
    resolving: boolean;
    resolvedCount: number;
    unresolvedCount: number;
    unresolved: { id: string; name: string; status: string; note: string | null }[];
  };
  onClose: () => void;
  /** Zoom the map to a calculated route. */
  onFocusRoute?: (route: DispatchRouteView) => void;
}

const ROUTE_ICON: Record<DispatchRouteKey, React.ElementType> = {
  'responder-dispatch': Shield,
  'casualty-evacuation': HeartPulse,
};

function fmt(m: number | null): string {
  if (m === null) return 'unreachable';
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}

const DISPLAY_TONE: Record<RankedRoute['display'], string> = {
  PRIMARY: 'is-success',
  ALTERNATE: 'is-medium',
  BLOCKED: 'is-critical',
};

export const RoutePanel: React.FC<RoutePanelProps> = ({
  routes,
  calculating,
  capability,
  advisories,
  incidentTitle,
  corridorStatus,
  onClose,
  onFocusRoute,
}) => {
  const [openKey, setOpenKey] = useState<DispatchRouteKey | null>('responder-dispatch');
  const [checksOpen, setChecksOpen] = useState<DispatchRouteKey | null>(null);

  const provenance = routes.find((route) => route.network)?.network ?? null;

  return (
    <div className="gov-panel w-[318px] max-w-[calc(100vw-2rem)] flex flex-col max-h-[74vh] shadow-lg">
      <div className="gov-panel-head">
        <div className="min-w-0 flex-1">
          <span className="gov-title block truncate">Route calculation</span>
          <span className="gov-label block truncate">
            {incidentTitle ?? 'No incident selected'}
          </span>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close route panel"
          className="shrink-0 text-ink-subtle hover:text-ink"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      <div className="gov-scroll-thin overflow-y-auto min-h-0 p-2.5 space-y-2.5">
        {!capability.available ? (
          <p className="text-[12px] text-critical leading-relaxed">
            ROAD NETWORK UNAVAILABLE — the configured city GIS provider publishes no routable road
            geometry, so no route can be calculated.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap items-center gap-1">
              <span className="gov-tag is-live">Road network routing</span>
              {calculating && (
                <span className="gov-tag flex items-center gap-1">
                  <Loader2 className="w-2.5 h-2.5 animate-spin" />
                  Calculating
                </span>
              )}
            </div>

            {routes.map((route) => {
              const Icon = ROUTE_ICON[route.key];
              const isOpen = openKey === route.key;
              const recommended = route.ranking?.recommended ?? null;
              const alternates = (route.ranking?.routes ?? []).filter((r) => !r.recommended);

              return (
                <div key={route.key} className="gov-inset p-2 space-y-1.5">
                  <button
                    type="button"
                    onClick={() => setOpenKey(isOpen ? null : route.key)}
                    aria-expanded={isOpen}
                    className="flex items-center gap-1.5 w-full text-left"
                  >
                    <Icon className="w-3.5 h-3.5 text-accent shrink-0" />
                    <span className="gov-label flex-1 truncate">{route.label}</span>
                    {route.status === 'VALID' && recommended && (
                      <span className="gov-mono text-[10px] text-ink">
                        {fmt(recommended.candidate.lengthM)}
                      </span>
                    )}
                    {route.status === 'CALCULATING' && (
                      <Loader2 className="w-3 h-3 animate-spin text-accent" />
                    )}
                    {route.status === 'FAILED' && (
                      <AlertTriangle className="w-3.5 h-3.5 text-critical" />
                    )}
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-ink-subtle transition-transform ${isOpen ? '' : '-rotate-90'}`}
                    />
                  </button>

                  {route.status === 'IDLE' && (
                    <p className="text-[11px] text-ink-muted leading-relaxed">
                      Select an incident to calculate this route.
                    </p>
                  )}

                  {route.status === 'CALCULATING' && (
                    <p className="text-[11px] text-ink-subtle leading-relaxed">
                      Fetching published road segments and searching the network…
                    </p>
                  )}

                  {route.status === 'FAILED' && route.failure && (
                    <div className="space-y-1">
                      <p className="text-[11px] font-semibold text-critical">{route.failure.message}</p>
                      <p className="text-[10px] text-ink-muted leading-relaxed">{route.failure.detail}</p>
                    </div>
                  )}

                  {isOpen && route.status === 'VALID' && recommended && (
                    <div className="space-y-1.5">
                      <dl className="space-y-0">
                        <div className="flex gap-2 py-1 border-b border-line">
                          <dt className="shrink-0 w-[86px] gov-label">From</dt>
                          <dd className="min-w-0 flex-1 text-[11px] text-ink break-words">
                            {route.fromLabel}
                          </dd>
                        </div>
                        <div className="flex gap-2 py-1 border-b border-line">
                          <dt className="shrink-0 w-[86px] gov-label">To</dt>
                          <dd className="min-w-0 flex-1 text-[11px] text-ink break-words">
                            {route.toLabel}
                          </dd>
                        </div>
                        <div className="flex gap-2 py-1 border-b border-line">
                          <dt className="shrink-0 w-[86px] gov-label">By road</dt>
                          <dd className="min-w-0 flex-1 text-[11px] text-ink">
                            {fmt(recommended.candidate.lengthM)}{' '}
                            <span className="text-ink-subtle">
                              over {recommended.candidate.legs.length} segments ·{' '}
                              {recommended.candidate.detourRatio.toFixed(2)}× direct
                            </span>
                          </dd>
                        </div>
                        <div className="flex gap-2 py-1 border-b border-line">
                          <dt className="shrink-0 w-[86px] gov-label">Travel time</dt>
                          <dd className="min-w-0 flex-1 text-[11px] text-caution">
                            UNAVAILABLE
                            <span className="block text-[10px] text-ink-subtle leading-relaxed">
                              {recommended.candidate.travelTime.reason}
                            </span>
                          </dd>
                        </div>
                        <div className="flex gap-2 py-1 border-b border-line last:border-0">
                          <dt className="shrink-0 w-[86px] gov-label">Snapped</dt>
                          <dd className="min-w-0 flex-1 text-[11px] text-ink">
                            {Math.round(recommended.candidate.start.distanceM)} m /{' '}
                            {Math.round(recommended.candidate.end.distanceM)} m from the requested
                            coordinates
                          </dd>
                        </div>
                      </dl>

                      <p className="text-[10px] text-ink-muted leading-relaxed">
                        {recommended.rationale}
                      </p>

                      {/* Streets, from the segments actually traversed. */}
                      {recommended.candidate.steps.some((step) => step.street) && (
                        <div className="space-y-0.5">
                          <span className="gov-label">Road segments traversed</span>
                          {recommended.candidate.steps.slice(0, 8).map((step, index) => (
                            <div
                              key={`${step.street ?? 'unnamed'}-${index}`}
                              className="flex items-center gap-2 py-0.5"
                            >
                              <span className="min-w-0 flex-1 text-[11px] text-ink truncate">
                                {step.street ?? 'Unnamed road'}
                                <span className="text-ink-subtle"> · {step.classLabel}</span>
                              </span>
                              <span className="gov-mono text-[10px] text-ink-muted shrink-0">
                                {fmt(step.lengthM)}
                              </span>
                            </div>
                          ))}
                          {recommended.candidate.steps.length > 8 && (
                            <p className="text-[10px] text-ink-subtle">
                              + {recommended.candidate.steps.length - 8} more
                            </p>
                          )}
                        </div>
                      )}

                      {/* Weighting factors, each with its own provenance. */}
                      {recommended.factors.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="gov-label">Weighting applied</span>
                          {recommended.factors.map((factor) => (
                            <div key={factor.id} className="py-0.5">
                              <div className="flex items-center gap-2">
                                <span className="min-w-0 flex-1 text-[11px] text-ink truncate">
                                  {factor.label}
                                </span>
                                <span className={`gov-badge ${GIS_SOURCE_STATE_TONE[factor.sourceState]} shrink-0`}>
                                  {GIS_SOURCE_STATE_LABEL[factor.sourceState]}
                                </span>
                              </div>
                              <p className="text-[10px] text-ink-subtle leading-relaxed">
                                {factor.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Validation report. */}
                      <button
                        type="button"
                        onClick={() => setChecksOpen(checksOpen === route.key ? null : route.key)}
                        aria-expanded={checksOpen === route.key}
                        className="flex items-center gap-1.5 w-full text-left"
                      >
                        <ListChecks
                          className={`w-3.5 h-3.5 shrink-0 ${
                            recommended.candidate.validation.status === 'VALID'
                              ? 'text-success'
                              : 'text-critical'
                          }`}
                        />
                        <span className="gov-label flex-1">
                          Route status: {recommended.candidate.validation.status}
                        </span>
                        <span className="gov-mono text-[10px] text-ink-subtle">
                          {recommended.candidate.validation.checks.filter((c) => c.passed).length}/
                          {recommended.candidate.validation.checks.length}
                        </span>
                        <ChevronDown
                          className={`w-3.5 h-3.5 text-ink-subtle transition-transform ${
                            checksOpen === route.key ? '' : '-rotate-90'
                          }`}
                        />
                      </button>

                      {checksOpen === route.key && (
                        <div className="space-y-0.5">
                          {recommended.candidate.validation.checks.map((check) => (
                            <div key={check.id} className="flex gap-1.5 py-0.5">
                              <span
                                className={`gov-mono text-[10px] shrink-0 ${
                                  check.passed ? 'text-success' : 'text-critical'
                                }`}
                              >
                                {check.passed ? '✓' : '✕'}
                              </span>
                              <span className="min-w-0 flex-1">
                                <span className="block text-[11px] text-ink">{check.label}</span>
                                <span className="block text-[10px] text-ink-subtle leading-relaxed">
                                  {check.detail}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Alternates, each independently calculated. */}
                      {alternates.length > 0 && (
                        <div className="space-y-0.5">
                          <span className="gov-label">Alternates calculated</span>
                          {alternates.map((alternate) => (
                            <div key={alternate.candidate.id} className="flex items-center gap-2 py-0.5">
                              <span className={`gov-badge ${DISPLAY_TONE[alternate.display]} shrink-0`}>
                                {alternate.display}
                              </span>
                              <span className="min-w-0 flex-1 text-[11px] text-ink truncate">
                                {alternate.candidate.objectiveLabel}
                              </span>
                              <span className="gov-mono text-[10px] text-ink-muted shrink-0">
                                {fmt(alternate.candidate.lengthM)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Facilities compared by road distance, not crow-fly. */}
                      {route.considered.length > 1 && (
                        <div className="space-y-0.5">
                          <span className="gov-label">Compared by road distance</span>
                          {route.considered.map((entry) => (
                            <div key={entry.id} className="flex items-center gap-2 py-0.5">
                              <span className="min-w-0 flex-1 text-[11px] text-ink truncate">
                                {entry.label}
                              </span>
                              <span
                                className={`gov-mono text-[10px] shrink-0 ${
                                  entry.lengthM === null ? 'text-caution' : 'text-ink-muted'
                                }`}
                              >
                                {fmt(entry.lengthM)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      {onFocusRoute && (
                        <button
                          type="button"
                          onClick={() => onFocusRoute(route)}
                          className="gov-btn gov-btn-secondary gov-btn-sm w-full"
                        >
                          <Crosshair className="w-3.5 h-3.5" />
                          Zoom to route
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {corridorStatus && (
              <div className="gov-inset p-2 space-y-1">
                <div className="flex items-center gap-1.5">
                  <Navigation className="w-3.5 h-3.5 text-accent shrink-0" />
                  <span className="gov-label flex-1">Traffic corridors</span>
                  {corridorStatus.resolving && (
                    <Loader2 className="w-3 h-3 animate-spin text-accent" />
                  )}
                </div>
                <p className="text-[10px] text-ink-muted leading-relaxed">
                  {corridorStatus.resolvedCount} of{' '}
                  {corridorStatus.resolvedCount + corridorStatus.unresolvedCount} corridors resolved
                  onto the road network.{' '}
                  {corridorStatus.unresolvedCount > 0 &&
                    'Corridors without connected road geometry are not drawn.'}
                </p>

                {/* Named, with the engine's own reason. */}
                {corridorStatus.unresolved.map((corridor) => (
                  <div key={corridor.id} className="pt-1 border-t border-line">
                    <div className="flex items-center gap-2">
                      <span className="min-w-0 flex-1 text-[11px] text-ink truncate">
                        {corridor.name}
                      </span>
                      <span
                        className={`gov-badge shrink-0 ${
                          corridor.status === 'PARTIAL' ? 'is-medium' : 'is-low'
                        }`}
                      >
                        {corridor.status}
                      </span>
                    </div>
                    {corridor.note && (
                      <p className="text-[10px] text-ink-subtle leading-relaxed">{corridor.note}</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {advisories.length > 0 && (
              <div className="space-y-1">
                <span className="gov-label">Modelling limits</span>
                {advisories.map((note) => (
                  <p key={note} className="text-[10px] text-caution leading-relaxed">
                    · {note}
                  </p>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {provenance && (
        <div className="border-t border-line px-2.5 py-1.5 space-y-0.5">
          <p className="text-[10px] text-ink-subtle leading-relaxed">
            {provenance.segmentCount.toLocaleString('en-IN')} road segments ·{' '}
            {provenance.nodeCount.toLocaleString('en-IN')} junctions · graph built in{' '}
            {provenance.graphBuildMs} ms
            {provenance.truncated ? ' · network truncated by provider record cap' : ''}
          </p>
          <p className="text-[10px] text-ink-subtle leading-relaxed">{provenance.attribution}</p>
        </div>
      )}
    </div>
  );
};
