/**
 * Starts and supervises every live feed.
 *
 * One entry point, called once from the application shell. Before this existed
 * each view ran its own `setInterval` and its own `fetch`, which is why the
 * dashboard, the map and the traffic page could show three different pictures of
 * the same minute. Now there is a single set of feeds, a single store behind them,
 * and a single place that decides when polling happens.
 *
 * What this file adds on top of `transportManager`:
 *
 * **Operator control.** The cadence override and the pause-when-hidden preference
 * from settings are applied here and re-applied whenever they change, so the
 * settings page genuinely governs the platform's behaviour rather than writing to
 * a key nothing reads.
 *
 * **Feed transitions in the event stream.** A source dropping out is an
 * operational event and belongs in the ticker alongside everything else. Only
 * *changes* are emitted, and the initial connect is deliberately silent — five
 * "connected" lines at startup would train an operator to scroll past the ticker,
 * which is the one thing it cannot afford.
 *
 * **Safe to start twice.** React's StrictMode mounts every effect, unmounts it and
 * mounts it again. Callers are reference-counted so the second mount does not
 * double-register and the first unmount does not stop the feeds out from under the
 * second.
 */

import { arkaStore } from '../ArkaStore';
import { DATA_STATE_LABEL } from '../../shared/dataState';
import type { DataState } from '../../shared/dataState';
import type { ArkaEventInput } from '../events';
import { transportManager, type FeedDefinition } from '../transport';
import { probeServerDemoMode } from '../demoMode';
import { createWeatherFeed } from './weather';
import { createTrafficFeed } from './traffic';
import { createIntelligenceFeed } from './intelligence';
import { createCameraFeed } from './cameras';
import { createUtilityFeed } from './utilities';
import { createIncidentFeed } from './incidents';

export { WEATHER_FEED_ID, WEATHER_ENTITY_ID } from './weather';
export { TRAFFIC_FEED_ID } from './traffic';
export { INTELLIGENCE_FEED_ID } from './intelligence';
export { CAMERA_FEED_ID } from './cameras';
export { UTILITY_FEED_ID } from './utilities';
export { INCIDENT_FEED_ID } from './incidents';

/**
 * Every feed ARKA runs.
 *
 * Ordered by how much of the operational picture depends on them, which is the
 * order they will be listed in the source panel. Adding a city system means
 * adding one factory here and nothing else.
 */
function allFeeds(): FeedDefinition[] {
  return [
    createIncidentFeed(),
    createTrafficFeed(),
    createWeatherFeed(),
    createCameraFeed(),
    createUtilityFeed(),
    createIntelligenceFeed(),
  ];
}

/** Reference count of live `startIngestion` callers. */
let callers = 0;
/** Set while polling is suspended because the tab is hidden. */
let pausedForVisibility = false;

/**
 * Last state announced per feed, and whether the feed has ever worked.
 *
 * The second flag is what keeps startup quiet: a feed moving from its initial
 * UNAVAILABLE registration to LIVE for the first time is the console coming up,
 * not news. The same transition later in the shift is a recovery, and is.
 */
const lastAnnounced = new Map<string, DataState>();
const hasSucceeded = new Set<string>();

let unsubscribeFeeds: (() => void) | null = null;
let unsubscribeSettings: (() => void) | null = null;

function feedTransitionEvents(): ArkaEventInput[] {
  const feeds = arkaStore.getFeeds();
  const events: ArkaEventInput[] = [];

  for (const feed of Object.values(feeds)) {
    const previous = lastAnnounced.get(feed.id);
    const working = feed.state !== 'UNAVAILABLE';
    const firstEverSuccess = working && !hasSucceeded.has(feed.id);

    if (working) hasSucceeded.add(feed.id);
    lastAnnounced.set(feed.id, feed.state);

    if (previous === undefined || previous === feed.state) continue;
    // Initial connect. Real, but not worth a line in the ticker.
    if (firstEverSuccess && previous === 'UNAVAILABLE') continue;

    const lost = feed.state === 'UNAVAILABLE';
    const at = feed.lastAttemptAt ?? new Date().toISOString();

    events.push({
      // Keyed on the transition rather than the clock, so a flapping source
      // cannot fill the stream with one entry per retry within the same second.
      id: `feed-${feed.id}-${previous}-${feed.state}-${at}`,
      at,
      kind: 'FEED_STATUS',
      tone: lost ? 'medium' : 'resolved',
      severity: null,
      title: lost
        ? `${feed.label} — source unavailable`
        : `${feed.label} — ${DATA_STATE_LABEL[feed.state].toLowerCase()}`,
      detail: lost
        ? `${feed.error?.message ?? 'The source stopped responding.'}` +
          (feed.error?.requiredIntegration
            ? ` Requires: ${feed.error.requiredIntegration}.`
            : '') +
          ' Records from this source have been cleared rather than left on screen.'
        : `${feed.label} is delivering over ${feed.transport}` +
          (feed.recordCount != null ? `, ${feed.recordCount} records` : '') +
          `. Previous state: ${DATA_STATE_LABEL[previous].toLowerCase()}.`,
      provider: feed.source.provider,
      // The event describes ARKA's own connection, which ARKA observes directly.
      state: 'LIVE',
      subjects: [],
      position: null,
      confidence: null,
      sourceSignals: [],
    });
  }

  return events;
}

function applySettings(): void {
  const settings = arkaStore.getSettings();
  transportManager.setCadence(settings.refresh.cadenceSeconds);

  // A preference change can mean polling should resume immediately — the operator
  // turning pause-when-hidden off while the tab is in the background.
  if (pausedForVisibility && !settings.refresh.pauseWhenHidden) {
    pausedForVisibility = false;
    transportManager.startAll();
  }
}

function handleVisibilityChange(): void {
  if (callers === 0) return;
  const { pauseWhenHidden } = arkaStore.getSettings().refresh;
  if (!pauseWhenHidden) return;

  if (document.visibilityState === 'hidden') {
    if (transportManager.isRunning) {
      pausedForVisibility = true;
      transportManager.stopAll();
    }
    return;
  }

  if (pausedForVisibility) {
    pausedForVisibility = false;
    // Resuming polls immediately rather than waiting a full cadence: the operator
    // has just looked back at the wall and the first thing they see should not be
    // a minute-old picture.
    transportManager.startAll();
  }
}

/**
 * Registers and starts every feed.
 *
 * Returns a disposer. Call it on unmount; the feeds keep running while any other
 * caller is still active.
 */
export function startIngestion(): () => void {
  callers += 1;

  if (callers === 1) {
    for (const feed of allFeeds()) transportManager.register(feed);

    // Seeded before subscribing so the registration pass — which correctly marks
    // every feed UNAVAILABLE, nothing having been attempted yet — is not read as
    // six sources dropping out.
    for (const feed of Object.values(arkaStore.getFeeds())) {
      lastAnnounced.set(feed.id, feed.state);
    }

    unsubscribeFeeds = arkaStore.subscribe('feeds', () => {
      const events = feedTransitionEvents();
      if (events.length > 0) arkaStore.emit(events);
    });
    unsubscribeSettings = arkaStore.subscribe('settings', applySettings);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    applySettings();
    transportManager.startAll();

    // Asks the server whether it is serving fixtures, so the demo badge reflects
    // the responses actually arriving rather than only this build's flag.
    void probeServerDemoMode();
  }

  let disposed = false;
  return () => {
    // Guarded because React may invoke a cleanup more than once in development,
    // and a double decrement would stop feeds another mount still depends on.
    if (disposed) return;
    disposed = true;
    callers -= 1;
    if (callers > 0) return;

    unsubscribeFeeds?.();
    unsubscribeFeeds = null;
    unsubscribeSettings?.();
    unsubscribeSettings = null;
    document.removeEventListener('visibilitychange', handleVisibilityChange);
    transportManager.stopAll();
    pausedForVisibility = false;
    lastAnnounced.clear();
    hasSucceeded.clear();
  };
}

/** Immediate re-poll of one feed, or all of them. For a manual refresh control. */
export function refreshFeeds(id?: string): void {
  transportManager.refresh(id);
}
