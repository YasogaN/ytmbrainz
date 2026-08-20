import { describe, expect, it } from 'bun:test';
import { FakeSource } from '@/adapters/fake';
import type { Recording } from '@/core/entities';
import { MbidStore, toMbid } from '@/core/mbid';
import { createApp, type EntityService } from '@/ws/app';

const recording: Recording = {
  entity: 'recording',
  id: '00000000-0000-4000-8000-000000000001',
  title: 'Roygbiv',
  video: false,
  length: 148000,
  firstReleaseDate: '1998',
  disambiguation: null,
  artistCredits: [
    {
      name: 'Boards of Canada',
      sortName: 'Boards of Canada',
      artistId: 'artist-mbid',
      joinPhrase: '',
    },
  ],
  releases: [],
  score: 100,
};

const makeApp = (service: EntityService | undefined, source = new FakeSource()) => {
  const store = new MbidStore(':memory:');
  return {
    store,
    app: createApp({
      source,
      store,
      services: service === undefined ? {} : { recording: service },
    }),
  };
};

describe('createApp', () => {
  it('serves a health endpoint', async () => {
    const { app, store } = makeApp(undefined);
    const response = await app(new Request('http://localhost/health'));

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ status: 'ok' });
    store.close();
  });

  it('returns the search results as JSON', async () => {
    const { app, store } = makeApp({
      search: async () => [recording],
      lookup: async () => null,
    });
    const response = await app(
      new Request('http://localhost/ws/2/recording?query=roygbiv&fmt=json'),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');
    const body = (await response.json()) as {
      count: number;
      offset: number;
      recordings: Array<{ id: string }>;
    };
    expect(body.count).toBe(1);
    expect(body.offset).toBe(0);
    expect(body.recordings[0]?.id).toBe('00000000-0000-4000-8000-000000000001');
    store.close();
  });

  it('returns the search results as XML by default', async () => {
    const { app, store } = makeApp({
      search: async () => [recording],
      lookup: async () => null,
    });
    const response = await app(new Request('http://localhost/ws/2/recording?query=roygbiv'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(await response.text()).toContain('<recording-list count="1" offset="0">');
    store.close();
  });

  it('pages search results with limit and offset', async () => {
    const many: Recording[] = Array.from({ length: 30 }, (_, i) => ({
      ...recording,
      id: `rec-${i}`,
      title: `Track ${i}`,
    }));
    const { app, store } = makeApp({
      search: async () => many,
      lookup: async () => null,
    });
    const response = await app(
      new Request('http://localhost/ws/2/recording?query=x&limit=5&offset=10&fmt=json'),
    );

    const body = (await response.json()) as {
      count: number;
      offset: number;
      recordings: Array<{ id: string }>;
    };
    expect(body.count).toBe(30);
    expect(body.offset).toBe(10);
    expect(body.recordings).toHaveLength(5);
    expect(body.recordings[0]?.id).toBe('rec-10');
    store.close();
  });

  it('returns a lookup entity', async () => {
    const { app, store } = makeApp({
      search: async () => [],
      lookup: async (_context, mbid) =>
        mbid === '00000000-0000-4000-8000-000000000001' ? recording : null,
    });
    const response = await app(
      new Request('http://localhost/ws/2/recording/00000000-0000-4000-8000-000000000001?fmt=json'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { title: string };
    expect(body.title).toBe('Roygbiv');
    store.close();
  });

  it('returns 404 for an unknown mbid', async () => {
    const { app, store } = makeApp({
      search: async () => [],
      lookup: async () => null,
    });
    const response = await app(
      new Request('http://localhost/ws/2/recording/00000000-0000-4000-8000-000000000002'),
    );

    expect(response.status).toBe(404);
    store.close();
  });

  it('returns 400 for a malformed mbid', async () => {
    const { app, store } = makeApp({
      search: async () => [],
      lookup: async () => null,
    });
    const response = await app(new Request('http://localhost/ws/2/recording/not-a-uuid'));

    expect(response.status).toBe(400);
    expect(await response.text()).toContain('<text>Invalid mbid.</text>');
    store.close();
  });

  it('returns 405 for non-GET requests', async () => {
    const { app, store } = makeApp(undefined);
    const response = await app(
      new Request('http://localhost/ws/2/recording?query=x', { method: 'POST' }),
    );

    expect(response.status).toBe(405);
    store.close();
  });

  it('returns 404 for unknown paths', async () => {
    const { app, store } = makeApp(undefined);
    const response = await app(new Request('http://localhost/ws/2/label'));

    expect(response.status).toBe(404);
    store.close();
  });

  it('returns 501 for entities without a registered service', async () => {
    const { app, store } = makeApp(undefined);
    const response = await app(new Request('http://localhost/ws/2/artist?query=x'));

    expect(response.status).toBe(501);
    store.close();
  });

  it('returns 503 when the source fails', async () => {
    const { app, store } = makeApp({
      search: async () => {
        throw new Error('upstream exploded');
      },
      lookup: async () => null,
    });
    const response = await app(new Request('http://localhost/ws/2/recording?query=x&fmt=json'));

    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ error: 'Backend service unavailable.' });
    store.close();
  });

  it('returns 400 for an invalid limit', async () => {
    const { app, store } = makeApp({
      search: async () => [],
      lookup: async () => null,
    });
    const response = await app(new Request('http://localhost/ws/2/recording?query=x&limit=abc'));

    expect(response.status).toBe(400);
    store.close();
  });

  it('serves Cover Art Archive paths through the app', async () => {
    const store = new MbidStore(':memory:');
    store.register('release', 'MPREb_1');
    const releaseMbid = toMbid('release', 'MPREb_1');
    const source = new FakeSource().seedAlbum({
      id: 'MPREb_1',
      name: 'Music Has the Right to Children',
      artists: [],
      year: '1998',
      description: null,
      tracks: [],
      artwork: [{ url: 'https://img.example.com/a=w544-h544', width: 544, height: 544 }],
    });
    const app = createApp({ source, store, services: {} });

    const redirect = await app(new Request(`http://localhost/release/${releaseMbid}/front`));
    expect(redirect.status).toBe(307);
    expect(redirect.headers.get('location')).toBe('https://img.example.com/a=w544-h544');

    const index = await app(new Request(`http://localhost/release/${releaseMbid}`));
    expect(index.status).toBe(200);
    expect(((await index.json()) as { images: unknown[] }).images).toHaveLength(1);

    const wsStillWorks = await app(new Request('http://localhost/ws/2/recording?query=x&fmt=json'));
    expect(wsStillWorks.status).toBe(501);
    store.close();
  });
});
