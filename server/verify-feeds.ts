/**
 * Provider verification harness.
 *
 * Run with: npm run verify:feeds
 *
 * This makes REAL network calls to the configured upstream providers, so it is a
 * manual check rather than a unit test. It exists because the claim "this field
 * is live" has to be reproducible by a reviewer, not taken on trust.
 *
 * It checks four things the data-integrity rules depend on:
 *   1. each provider actually returns usable data for Bhubaneswar
 *   2. repeat reads are served from cache (provider quotas are respected)
 *   3. failure modes degrade to CACHED or UNAVAILABLE — never to a substitute
 *   4. credentials never appear in a log line
 *
 * Exit code is 1 if any live feed fails, so this can gate a deployment.
 */

import { Feed, feedRegistry, type FeedStatus } from './lib/cache';
import { fetchJson, fetchText, ProviderError, redactUrl, num, numInRange, str } from './lib/http';
import { weatherFeed } from './providers/weather';
import { airQualityFeed } from './providers/airQuality';
import { hydrologyFeed } from './providers/hydrology';
import { airspaceFeed } from './providers/aircraft';
import { advisoryFeed } from './providers/advisories';
import { missingError } from '../src/shared/missingIntegrations';
import { live, type DataEnvelope, type SourceMeta } from '../src/shared/dataState';

const TEST_SOURCE: SourceMeta = { provider: 'Verification stub', kind: 'model' };
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const at = (msAgo: number) => new Date(Date.now() - msAgo).toISOString();

let failures = 0;

function heading(text: string): void {
  console.log(`\n${text}\n${'-'.repeat(text.length)}`);
}

function check(label: string, pass: boolean, detail = ''): void {
  if (!pass) failures += 1;
  console.log(`  ${pass ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
}

function summarise(env: DataEnvelope<unknown>): string {
  const parts = [`state=${env.state}`, `age=${env.ageSeconds ?? '—'}s`, `stale=${env.stale}`];
  if (env.error) parts.push(`error=${env.error.code}`);
  return parts.join(' ');
}

async function verifyLiveFeeds(): Promise<void> {
  heading('1. Live providers');

  const feeds: Array<[string, Feed<any>, (data: any) => boolean]> = [
    ['weather', weatherFeed, (d) => d.temperatureC != null],
    ['air-quality', airQualityFeed, (d) => d.usAqi != null || d.pm25 != null],
    ['hydrology', hydrologyFeed, (d) => Array.isArray(d.days) && d.days.length > 0],
    // An empty aircraft list is a valid answer: ADS-B coverage is genuinely
    // patchy. Only the envelope has to be sound.
    ['airspace', airspaceFeed, (d) => Array.isArray(d.aircraft)],
    // Publisher feeds are blocked on some networks; report but do not fail.
    ['advisories', advisoryFeed, (d) => Array.isArray(d.items)],
  ];

  for (const [id, feed, isUsable] of feeds) {
    const env = await feed.get();
    const optional = id === 'advisories';
    const ok = env.state === 'LIVE' && env.data != null && isUsable(env.data);

    if (ok) {
      check(`${id}: ${summarise(env)}`, true);
    } else if (optional) {
      console.log(`  SKIP  ${id}: ${summarise(env)} — ${env.error?.message.slice(0, 90) ?? 'no data'}`);
    } else {
      check(`${id}: ${summarise(env)}`, false, env.error?.message.slice(0, 120) ?? 'no usable data');
    }

    if (env.state !== 'UNAVAILABLE') {
      check(`${id}: names a provider and a timestamp`, !!env.source.provider && !!env.fetchedAt);
    }
    // The rule that matters most: UNAVAILABLE must carry no payload at all.
    check(`${id}: UNAVAILABLE carries no data`, env.state !== 'UNAVAILABLE' || env.data === null);
  }
}

async function verifyQuotaProtection(): Promise<void> {
  heading('2. Provider quota protection');

  const callsBefore = feedRegistry.statuses().map((s: FeedStatus) => [s.id, s.upstreamCalls] as const);
  await Promise.all([weatherFeed.get(), airQualityFeed.get(), hydrologyFeed.get(), airspaceFeed.get()]);
  const callsAfter = new Map(feedRegistry.statuses().map((s: FeedStatus) => [s.id, s.upstreamCalls]));

  for (const [id, before] of callsBefore) {
    const after = callsAfter.get(id) ?? -1;
    check(`${id}: repeat read made no extra upstream call`, after === before, `${before} -> ${after}`);
  }

  // Concurrent readers must collapse into a single upstream call.
  let upstream = 0;
  const singleFlight = new Feed<number>({
    id: 'verify-single-flight',
    label: 'Single-flight probe',
    source: TEST_SOURCE,
    ttlSeconds: 60,
    staleAfterSeconds: 120,
    fetch: async () => {
      upstream += 1;
      await sleep(50);
      return upstream;
    },
  });
  await Promise.all(Array.from({ length: 8 }, () => singleFlight.get()));
  check('8 concurrent readers caused 1 upstream call', upstream === 1, `calls=${upstream}`);
}

async function verifyFailureModes(): Promise<void> {
  heading('3. Failure modes');

  // Never succeeded -> UNAVAILABLE with the real error, no payload.
  const broken = new Feed<number>({
    id: 'verify-broken',
    label: 'Always failing',
    source: TEST_SOURCE,
    ttlSeconds: 1,
    staleAfterSeconds: 2,
    fetch: async () => {
      throw new ProviderError({ code: 'HTTP_503', message: 'upstream unavailable' });
    },
  });
  const never = await broken.get();
  check(
    'never-succeeded feed -> UNAVAILABLE, null data, real error',
    never.state === 'UNAVAILABLE' && never.data === null && never.error?.code === 'HTTP_503',
    summarise(never)
  );

  // Succeeded once then failing -> CACHED with the real error and a real age.
  let healthy = true;
  const flappy = new Feed<number>({
    id: 'verify-flappy',
    label: 'Intermittent',
    source: TEST_SOURCE,
    ttlSeconds: 1,
    staleAfterSeconds: 3,
    fetch: async () => {
      if (!healthy) throw new ProviderError({ code: 'TIMEOUT', message: 'provider timed out' });
      return 42;
    },
  });
  const first = await flappy.get();
  check('healthy feed -> LIVE', first.state === 'LIVE' && first.data === 42, summarise(first));

  healthy = false;
  await sleep(1200);
  const degraded = await flappy.get();
  check(
    'failing feed keeps last value as CACHED, not a substitute',
    degraded.state === 'CACHED' && degraded.data === 42 && degraded.error?.code === 'TIMEOUT',
    summarise(degraded)
  );

  await sleep(2300);
  const overdue = await flappy.get();
  check('past its freshness budget -> flagged stale', overdue.stale === true, summarise(overdue));

  // Rounding must never make an overdue value look current.
  check(
    'stale boundary uses exact age, not rounded age',
    live(1, TEST_SOURCE, at(3000), 3).stale === true && live(1, TEST_SOURCE, at(2900), 3).stale === false
  );

  heading('4. Transport error mapping');

  try {
    await fetchText('https://api.open-meteo.com/v1/forecast?latitude=20&longitude=85&current=temperature_2m', {
      timeoutMs: 1,
    });
    check('1 ms budget -> TIMEOUT', false, 'request unexpectedly succeeded');
  } catch (err) {
    const detail = (err as ProviderError).detail;
    check('1 ms budget -> TIMEOUT', detail.code === 'TIMEOUT', detail.message);
  }

  try {
    await fetchJson('https://open-meteo.com/en/docs', { timeoutMs: 10000 });
    check('HTML body -> MALFORMED', false, 'request unexpectedly parsed');
  } catch (err) {
    const detail = (err as ProviderError).detail;
    check(
      'HTML body -> MALFORMED, body not echoed',
      detail.code === 'MALFORMED' && !detail.message.includes('<'),
      detail.message
    );
  }

  try {
    await fetchJson('https://api.open-meteo.com/v1/no-such-endpoint', { timeoutMs: 10000 });
    check('unknown path -> HTTP_4xx', false, 'request unexpectedly succeeded');
  } catch (err) {
    const detail = (err as ProviderError).detail;
    check('unknown path -> HTTP_4xx', detail.code.startsWith('HTTP_4'), detail.code);
  }
}

function verifyValidators(): void {
  heading('5. Payload validation substitutes nothing');

  check('num rejects non-numeric', num('abc') === null && num(null) === null && num(NaN) === null);
  check('num accepts numeric string', num('7') === 7);
  check('numInRange rejects out-of-range', numInRange(500, 0, 100) === null && numInRange(50, 0, 100) === 50);
  check('str rejects empty and non-string', str('') === null && str(5) === null);
}

function verifySecrecy(): void {
  heading('6. Credential redaction');

  const cases = [
    'https://api.example.com/v1/x?api_key=SUPERSECRET&lat=20',
    'https://api.example.com/v1/x?apikey=a&token=b&access_token=c&secret=d&password=e',
    'https://api.data.gov.in/resource/1?api-key=LEAKME&format=json',
  ];
  for (const url of cases) {
    const redacted = redactUrl(url);
    const leaked = ['SUPERSECRET', 'LEAKME', '=a&', '=b&', '=c&', '=d&', '=e'].some((s) => redacted.includes(s));
    check(redacted, !leaked);
  }
}

function verifyMissingIntegrations(): void {
  heading('7. Unconnected domains explain themselves');

  for (const id of ['cctv', 'utilities-scada', 'traffic-flow', 'official-warnings']) {
    const err = missingError(id);
    check(
      `${id}: states a reason and a required integration`,
      err.code === 'NOT_CONFIGURED' && err.message.length > 20 && !!err.requiredIntegration
    );
  }
}

async function main(): Promise<void> {
  console.log('ARKA provider verification — live network calls follow.');
  await verifyLiveFeeds();
  await verifyQuotaProtection();
  await verifyFailureModes();
  verifyValidators();
  verifySecrecy();
  verifyMissingIntegrations();

  console.log(`\n${failures === 0 ? 'All checks passed.' : `${failures} check(s) failed.`}`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error('Verification harness crashed:', err);
  process.exit(1);
});
