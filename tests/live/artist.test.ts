import { describe, expect, it } from 'bun:test';
import { InnerTubeSource } from '@/adapters/innertube';
import { MbidStore } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { artistService } from '@/ws/services/artist';

const runLive = Boolean(process.env.RUN_LIVE);

const makeApp = () => {
  const source = new InnerTubeSource();
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { artist: artistService } });
  return { app, store };
};

describe.skipIf(!runLive)('artist route (live)', () => {
  it('searches for an artist', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/artist?query=artist:"Boards of Canada"&fmt=json'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      artists: Array<{ id: string; name: string }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.artists[0]?.name).toBe('Boards of Canada');
    store.close();
  }, 60_000);

  it('resolves an artist by the MBID it served', async () => {
    const { app, store } = makeApp();
    const search = await app(new Request('http://localhost/ws/2/artist?query=boards&fmt=json'));
    const body = (await search.json()) as { artists: Array<{ id: string }> };
    const mbid = body.artists[0]?.id;
    expect(mbid).toBeTruthy();

    const lookup = await app(new Request(`http://localhost/ws/2/artist/${mbid}?fmt=json`));
    expect(lookup.status).toBe(200);
    const lookupBody = (await lookup.json()) as { name: string };
    expect(lookupBody.name).toBe('Boards of Canada');
    store.close();
  }, 60_000);
});
