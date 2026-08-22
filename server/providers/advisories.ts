/**
 * Advisories and news — configured RSS feeds.
 *
 * The feed list comes from ADVISORY_RSS_FEEDS and defaults to the Google News
 * RSS query this platform already used. Two honesty rules apply:
 *
 *   1. Google News is a *media aggregator*, not a government advisory channel.
 *      Its items are labelled as such so nobody reads a news headline as an
 *      OSDMA or IMD instruction.
 *   2. No summary, highlight or category is invented. Only the publisher's own
 *      title, link, timestamp and snippet are passed through, with HTML
 *      stripped. The previous implementation generated "highlights" that read
 *      like analyst notes; those are gone.
 *
 * Per-feed failures are reported individually, so one dead publisher does not
 * silently empty the panel.
 */

import Parser from 'rss-parser';
import { ADVISORY_FEEDS, USER_AGENT } from '../lib/config';
import { fetchText, hostOf, ProviderError } from '../lib/http';
import { Feed, feedRegistry } from '../lib/cache';
import type { SourceMeta } from '../../src/shared/dataState';

export const ADVISORY_SOURCE: SourceMeta = {
  provider: ADVISORY_FEEDS.map((f) => f.publisher).join(', ') || 'No feed configured',
  kind: 'aggregator',
  attribution: 'Headlines remain the property of their publishers.',
  note: 'Public RSS feeds. Media reports are not official advisories and are not verified by this platform.',
  cadenceSeconds: 900,
};

export interface Advisory {
  id: string;
  title: string;
  link: string | null;
  publishedAt: string | null;
  /** Publisher as stated by the feed. Null when the feed does not say. */
  publisher: string | null;
  feedHost: string;
  /** Publisher's own snippet, HTML stripped. Never generated. */
  summary: string | null;
}

export interface FeedOutcome {
  host: string;
  publisher: string;
  ok: boolean;
  itemCount: number;
  error?: string;
}

export interface AdvisoryBundle {
  items: Advisory[];
  feeds: FeedOutcome[];
}

const parser = new Parser({
  customFields: { item: [['source', 'sourceTag']] },
});

function stripHtml(input: string | undefined | null, maxLength = 600): string | null {
  if (!input) return null;
  const text = input
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return null;
  return text.length > maxLength ? `${text.slice(0, maxLength)}…` : text;
}

/**
 * Google News encodes the publisher in the title as "Headline - Publisher" and
 * also in a <source> element. Prefer the element; fall back to the suffix only
 * when it is present. Never substitute a made-up publisher name.
 */
function splitPublisher(title: string, sourceTag: unknown): { title: string; publisher: string | null } {
  const fromTag =
    typeof sourceTag === 'string'
      ? sourceTag
      : sourceTag && typeof sourceTag === 'object' && '_' in (sourceTag as any)
        ? String((sourceTag as any)._)
        : null;

  if (fromTag && fromTag.trim()) {
    const suffix = ` - ${fromTag.trim()}`;
    return {
      title: title.endsWith(suffix) ? title.slice(0, -suffix.length).trim() : title,
      publisher: fromTag.trim(),
    };
  }

  const idx = title.lastIndexOf(' - ');
  if (idx > 20 && idx < title.length - 3) {
    return { title: title.slice(0, idx).trim(), publisher: title.slice(idx + 3).trim() };
  }
  return { title, publisher: null };
}

async function fetchAdvisories(): Promise<AdvisoryBundle> {
  if (ADVISORY_FEEDS.length === 0) {
    throw new ProviderError({
      code: 'NOT_CONFIGURED',
      message: 'No advisory RSS feed is configured.',
      requiredIntegration: 'Set ADVISORY_RSS_FEEDS to one or more publisher RSS URLs.',
    });
  }

  const outcomes: FeedOutcome[] = [];
  const items: Advisory[] = [];

  for (const feed of ADVISORY_FEEDS) {
    const host = hostOf(feed.url);
    try {
      const xml = await fetchText(feed.url, {
        timeoutMs: 10000,
        maxBytes: 2 * 1024 * 1024,
        headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml, text/xml' },
      });
      const parsed = await parser.parseString(xml);
      const feedItems = (parsed.items || []).slice(0, 20);

      for (const [index, item] of feedItems.entries()) {
        const rawTitle = (item.title || '').trim();
        if (!rawTitle) continue;
        const { title, publisher } = splitPublisher(rawTitle, (item as any).sourceTag);
        const published = item.isoDate || item.pubDate;
        const publishedAt = published ? new Date(published).toISOString() : null;

        items.push({
          id: item.guid || item.link || `${host}-${index}`,
          title,
          link: item.link || null,
          publishedAt: publishedAt && !Number.isNaN(Date.parse(publishedAt)) ? publishedAt : null,
          publisher,
          feedHost: host,
          summary: stripHtml(item.contentSnippet || (item as any).content || item.content),
        });
      }

      outcomes.push({ host, publisher: feed.publisher, ok: true, itemCount: feedItems.length });
    } catch (err) {
      outcomes.push({
        host,
        publisher: feed.publisher,
        ok: false,
        itemCount: 0,
        error: err instanceof ProviderError ? `${err.detail.code}: ${err.detail.message}` : 'Feed error',
      });
    }
  }

  // Every configured feed failed — this is an outage, not an empty news day.
  if (items.length === 0 && outcomes.every((o) => !o.ok)) {
    throw new ProviderError({
      code: 'ALL_FEEDS_FAILED',
      message: outcomes.map((o) => `${o.host} (${o.error})`).join('; '),
    });
  }

  items.sort((a, b) => {
    if (!a.publishedAt) return 1;
    if (!b.publishedAt) return -1;
    return Date.parse(b.publishedAt) - Date.parse(a.publishedAt);
  });

  return { items: items.slice(0, 40), feeds: outcomes };
}

export const advisoryFeed = feedRegistry.register(
  new Feed<AdvisoryBundle>({
    id: 'advisories',
    label: 'News and advisory feeds',
    source: ADVISORY_SOURCE,
    ttlSeconds: 600,
    staleAfterSeconds: 3600,
    // Publishers rate-limit bursts; PIB reset connections during audit probing.
    minIntervalSeconds: 300,
    fetch: fetchAdvisories,
  })
);
