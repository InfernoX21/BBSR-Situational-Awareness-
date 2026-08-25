/**
 * Intelligence ingestion: civic news and advisories.
 *
 * `/api/news/bhubaneswar` aggregates Google News for Bhubaneswar. It is a
 * third-party aggregation of other publishers, so `SourceKind` is `aggregator`
 * and the provider shown to the operator is the publisher that actually wrote
 * the piece — 'The New Indian Express' rather than 'ARKA'. A headline is not an
 * observation ARKA made.
 *
 * Two things about identity, because this endpoint makes both non-obvious.
 *
 * **The upstream id is unusable.** The server stamps `Date.now()` into every
 * item id, so the same article arrives with a different id every five minutes.
 * Ids are rebuilt here by hashing the article's URL and headline together —
 * neither contains a clock, so the identity survives polls, and the pair
 * discriminates articles that share a fallback link.
 *
 * **The seen-set is not pruned.** Unlike the traffic feed, which forgets ids that
 * leave the tick so a returning corridor is compared afresh, this feed remembers
 * every article announced for the life of the session. Google reorders its top
 * ten constantly; an article that drops out and returns is not new, and
 * announcing it twice would make the ticker untrustworthy. Ten items per poll is
 * a set small enough that never forgetting costs nothing.
 */

import type { DataError, SourceMeta } from '../../shared/dataState';
import type { IntelligenceItem } from '../../types';
import { arkaStore } from '../ArkaStore';
import type { EntityHealth, IntelligenceEntity } from '../entities';
import type { ArkaEventInput } from '../events';
import type { FeedDefinition, FeedOutcome } from '../transport';
import { asArray, asRecord, dataStateOf, isoOr, oneOf, optStr, stableId, str } from './coerce';

export const INTELLIGENCE_FEED_ID = 'intelligence';

const AGGREGATOR: SourceMeta = {
  provider: 'Google News — Bhubaneswar, Odisha',
  kind: 'aggregator',
  attribution: 'Headlines via Google News RSS',
  url: 'https://news.google.com/',
  note: 'Third-party news aggregation. Reporting by the named publisher, not verified by ARKA and not an official government advisory unless the publisher is a government body.',
  cadenceSeconds: 300,
};

/** Google News refreshes on the order of minutes; five is ample. */
const CADENCE_SECONDS = 300;

const ITEM_SOURCES = ['GOOGLE_NEWS', 'GOVT_ADVISORY', 'WEATHER_BULLETIN', 'TRAFFIC_FEED'] as const;

/** Categories the server derives by keyword. Anything else passes through as-is. */
const ATTENTION_CATEGORIES = new Set(['WEATHER_ADVISORY', 'TRAFFIC_ALERT', 'POWER_GRID']);

/**
 * Articles already announced this session.
 *
 * Separate from the entity bucket: the bucket is replaced wholesale each tick and
 * holds what is currently on the wire, while this records what the operator has
 * already been told about.
 */
const announced = new Set<string>();
let coldStart = true;

export function createIntelligenceFeed(): FeedDefinition {
  return {
    id: INTELLIGENCE_FEED_ID,
    label: 'Civic intelligence — news and advisories',
    source: AGGREGATOR,
    cadenceSeconds: CADENCE_SECONDS,
    transports: [{ kind: 'poll', url: '/api/news/bhubaneswar' }],
    handler: handleIntelligence,
    onUnavailable: clearIntelligence,
  };
}

/**
 * A headline is not infrastructure, so 'nominal' versus 'attention' here reflects
 * the source's own category tag — which the server derives by keyword from the
 * headline — and nothing more. It is a routing hint for the operator's eye, not
 * an assessment of the story.
 */
function healthForCategory(category: string): EntityHealth {
  return ATTENTION_CATEGORIES.has(category) ? 'attention' : 'nominal';
}

function handleIntelligence(payload: unknown, ctx: { receivedAt: string }): FeedOutcome {
  const root = asRecord(payload);
  const declared = dataStateOf(root.classification, 'UNAVAILABLE');

  if (root.success !== true || declared === 'UNAVAILABLE') {
    const reason = str(root.unavailableReason, 'The news aggregator returned no items.');
    const error: DataError = { code: 'SOURCE_UNAVAILABLE', message: reason };
    clearIntelligence(error);
    return { count: 0, unavailable: error };
  }

  const entities: IntelligenceEntity[] = [];
  const events: ArkaEventInput[] = [];
  const seenThisTick = new Set<string>();

  for (const raw of asArray(root.data).map(asRecord)) {
    const headline = optStr(raw.headline);
    if (!headline) continue;

    const url = str(raw.url, '');
    const id = stableId('intel', `${url}|${headline}`);
    // A duplicate within one payload is the same article twice, not two articles.
    if (seenThisTick.has(id)) continue;
    seenThisTick.add(id);

    const publisher = str(raw.publisherName, 'Unattributed');
    const category = str(raw.category, 'CIVIC_UPDATE');
    // Per-item classification wins: the demo branch marks each fixture SEED
    // individually, and an item that says what it is should be believed over the
    // envelope around it.
    const state = dataStateOf(raw.classification, declared);
    // Publication time when the feed supplied one, otherwise the moment it
    // reached us — never a guess at how old the story is.
    const publishedAt = isoOr(raw.publishedAt, ctx.receivedAt);

    const item: IntelligenceItem = {
      id,
      publisherName: publisher,
      publishedTime: str(raw.publishedTime, '—'),
      publishedAt: optStr(raw.publishedAt),
      headline,
      summary: str(raw.summary, ''),
      url: url || 'https://news.google.com',
      source: oneOf(raw.source, ITEM_SOURCES, 'GOOGLE_NEWS'),
      category,
      content: optStr(raw.content) ?? undefined,
      highlights: asArray(raw.highlights).filter((h): h is string => typeof h === 'string'),
      classification: state,
    };

    entities.push({
      id,
      kind: 'intelligence',
      label: headline,
      observedAt: publishedAt,
      state,
      source: {
        ...AGGREGATOR,
        // The publisher is who is making the claim; the aggregator only carried it.
        provider: publisher,
        note:
          item.source === 'GOVT_ADVISORY'
            ? 'Advisory attributed to a government body, carried by the news aggregator. Verify against the issuing authority before acting.'
            : AGGREGATOR.note,
      },
      // News has no coordinates. Geocoding a headline would put a marker on the
      // map that no source placed there.
      position: null,
      health: healthForCategory(category),
      // Nothing grades a news article. An invented severity would rank a headline
      // alongside a measured incident.
      severity: null,
      related: [],
      data: item,
    });

    if (!coldStart && !announced.has(id)) {
      events.push(advisoryEvent(id, item, publishedAt, state));
    }
    announced.add(id);
  }

  // The first payload populates the feed pane without announcing ten stories the
  // operator has not asked about. Everything after it is genuinely arriving.
  coldStart = false;

  arkaStore.batch(() => {
    arkaStore.replaceKind('intelligence', entities);
    if (events.length > 0) arkaStore.emit(events);
  });

  return { count: entities.length, state: declared };
}

function advisoryEvent(
  id: string,
  item: IntelligenceItem,
  publishedAt: string,
  state: IntelligenceEntity['state']
): ArkaEventInput {
  return {
    id: `advisory-${id}`,
    at: publishedAt,
    kind: 'ADVISORY',
    // Cyan/info: an advisory reports what someone published, not a graded
    // condition ARKA measured.
    tone: 'low',
    severity: null,
    title: item.headline,
    detail: item.summary || item.content || null,
    provider: item.publisherName,
    state,
    subjects: [{ kind: 'intelligence', id }],
    position: null,
    // No model produced this and no model scored it.
    confidence: null,
    sourceSignals: [],
  };
}

/**
 * Clears the feed pane.
 *
 * The announced set is deliberately *not* cleared: the aggregator being briefly
 * unreachable does not make the stories the operator already saw new again when
 * it returns.
 */
function clearIntelligence(_error: DataError): void {
  if (arkaStore.getEntities().intelligence.length > 0) {
    arkaStore.replaceKind('intelligence', []);
  }
}
