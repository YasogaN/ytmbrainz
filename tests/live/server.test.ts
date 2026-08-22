import { describe, expect, it } from 'bun:test';
import { CachingSource, TtlCache } from '@/server/cache';
import { RateLimitedSource } from '@/server/rateLimit';
import { firstId, makeApp, sharedSource } from './helpers';

const runLive = Boolean(process.env.RUN_LIVE);

const makeProductionApp = () => {
  const source = new CachingSource(
    new RateLimitedSource(sharedSource, 500),
    new TtlCache(3600_000),
  );
  return makeApp(source);
};

describe.skipIf(!runLive)('production stack (live)', () => {
  it('serves a recording search through the cache and rate limiter', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/recording?query=roygbiv&fmt=json'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      recordings: Array<{ length: number | null }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.recordings[0]?.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);

  it('serves a repeated search from the cache', async () => {
    const { app, store } = makeProductionApp();
    const first = await app(new Request('http://localhost/ws/2/recording?query=roygbiv&fmt=json'));
    const second = await app(new Request('http://localhost/ws/2/recording?query=roygbiv&fmt=json'));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    const [a, b] = await Promise.all([first.json(), second.json()]);
    expect((a as { count: number }).count).toBe((b as { count: number }).count);
    store.close();
  }, 60_000);

  it('round-trips a search to a lookup through the stack', async () => {
    const { app, store } = makeProductionApp();
    const mbid = await firstId(app, 'http://localhost/ws/2/recording?query=roygbiv&fmt=json');

    const lookup = await app(new Request(`http://localhost/ws/2/recording/${mbid}?fmt=json`));
    expect(lookup.status).toBe(200);
    const body = (await lookup.json()) as { length: number | null };
    expect(body.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);
});
