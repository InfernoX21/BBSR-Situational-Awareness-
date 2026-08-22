/**
 * Server configuration.
 *
 * Every credential is read here from the environment and never sent to the
 * browser. `USE_DEMO_DATA` is the single switch that allows committed demo
 * fixtures to be served; it defaults to OFF so a production deployment cannot
 * accidentally present fixtures as operational data.
 */

/** Bhubaneswar Municipal Corporation area of responsibility. Static geography. */
export const CITY = {
  name: 'Bhubaneswar',
  state: 'Odisha',
  lat: 20.2961,
  lng: 85.8245,
  /** Bounding box used for airspace queries (Odisha). */
  bbox: { latMin: 19.8, lonMin: 84.8, latMax: 21.5, lonMax: 86.8 },
};

function flag(name: string, fallback = false): boolean {
  const raw = process.env[name];
  if (raw == null || raw === '') return fallback;
  return raw === 'true' || raw === '1';
}

/**
 * Demo mode. When false (the default, and required in production) no seeded or
 * simulated payload is served by any endpoint.
 */
export const USE_DEMO_DATA = flag('USE_DEMO_DATA', false);

export const IS_PRODUCTION = process.env.NODE_ENV === 'production';

/** Refuse to serve fixtures in production even if the flag was set. */
export const DEMO_DATA_ENABLED = USE_DEMO_DATA && !IS_PRODUCTION;

/**
 * Advisory/news RSS feeds, newest-first, comma-separated in the environment.
 *
 * Default is the Google News RSS query the platform already used. It is a
 * media aggregator, not an official government advisory channel, and is
 * labelled as such in the UI. Operators can point this at official feeds
 * (for example a PIB regional feed) once they have confirmed the publisher's
 * terms and polling limits.
 */
export const ADVISORY_FEEDS: { url: string; publisher: string }[] = parseFeeds(
  process.env.ADVISORY_RSS_FEEDS
);

function parseFeeds(raw: string | undefined): { url: string; publisher: string }[] {
  if (!raw || !raw.trim()) {
    return [
      {
        url: 'https://news.google.com/rss/search?q=Bhubaneswar+Odisha&hl=en-IN&gl=IN&ceid=IN:en',
        publisher: 'Google News RSS',
      },
    ];
  }
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .map((url) => {
      let publisher = 'Configured RSS feed';
      try {
        publisher = new URL(url).host;
      } catch {
        /* keep the generic label for an unparsable entry */
      }
      return { url, publisher };
    });
}

/** Local Sadaksh YOLO/ByteTrack inference microservice, if the operator runs it. */
export const SADAKSH_URL = (process.env.SADAKSH_AI_URL || 'http://127.0.0.1:8008').replace(/\/$/, '');

/** Gemini. Absent key ⇒ AI fusion reports UNAVAILABLE rather than inventing output. */
export const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';
/**
 * Model id is configurable because model availability changes over time; an
 * unavailable id must surface as a provider error, not as a fabricated result.
 */
export const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

/** Telegram companion bot. */
export const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
/**
 * Shared secret required by state-changing admin endpoints (bot token
 * installation). Without it those endpoints are disabled rather than open.
 */
export const ADMIN_API_TOKEN = process.env.ARKA_ADMIN_TOKEN || '';

/** Contact/URL used in provider attribution strings. */
export const USER_AGENT = 'ARKA-EOC/1.0 (Bhubaneswar municipal situational awareness)';
