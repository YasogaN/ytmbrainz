import { describe, expect, it } from 'bun:test';
import { FakeSource } from '@/adapters/fake';
import { MbidStore, toMbid } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { releaseService } from '@/ws/services/release';

const album = {
  id: 'MPREb_1',
  name: 'Music Has the Right to Children',
  artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
  year: '1998',
  description: 'The debut album.',
  tracks: [
    {
      id: 'video-1',
      title: 'Roygbiv',
      artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
      album: null,
      durationSeconds: 148,
      year: '1998',
    },
    {
      id: 'video-2',
      title: 'Turquoise Hexagon Sun',
      artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
      album: null,
      durationSeconds: 240,
      year: '1998',
    },
  ],
};

const makeApp = () => {
  const source = new FakeSource().seedAlbum(album).seedArtist({
    id: 'UC-artist',
    name: 'Boards of Canada',
    albums: [
      {
        id: 'MPREb_1',
        name: 'Music Has the Right to Children',
        artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
        year: '1998',
      },
    ],
    singles: [],
    topTracks: [],
  });
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { release: releaseService } });
  return { app, store, source };
};

describe('release search', () => {
  it('returns matching releases as JSON', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release?query=music%20has%20the%20right&fmt=json'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      releases: Array<{ id: string; title: string; 'release-group': { 'primary-type': string } }>;
    };
    expect(body.count).toBe(1);
    expect(body.releases[0]?.title).toBe('Music Has the Right to Children');
    expect(body.releases[0]?.id).toBe(toMbid('release', 'MPREb_1'));
    expect(body.releases[0]?.['release-group']?.['primary-type']).toBe('Album');
    store.close();
  });

  it('returns XML by default', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release?query=music%20has%20the%20right'),
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<release-list count="1" offset="0">');
    expect(text).toContain('<title>Music Has the Right to Children</title>');
    store.close();
  });

  it('filters by primary type', async () => {
    const { app, store } = makeApp();
    const albumMatch = await app(
      new Request(
        'http://localhost/ws/2/release?query=release:"Music Has the Right" AND primarytype:album&fmt=json',
      ),
    );
    expect(((await albumMatch.json()) as { count: number }).count).toBe(1);

    const noMatch = await app(
      new Request(
        'http://localhost/ws/2/release?query=release:"Music Has the Right" AND primarytype:single&fmt=json',
      ),
    );
    expect(((await noMatch.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('requires the query parameter', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/release?fmt=json'));

    expect(response.status).toBe(400);
    store.close();
  });

  it('returns an empty list for a filter-only query', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release?query=format:"Digital Media"&fmt=json'),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });
});

describe('release lookup', () => {
  it('returns a full release with media', async () => {
    const { app, store } = makeApp();
    store.register('release', 'MPREb_1');

    const response = await app(
      new Request(`http://localhost/ws/2/release/${toMbid('release', 'MPREb_1')}?fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      title: string;
      media: Array<{
        position: number;
        format: string;
        'track-count': number;
        track: Array<{ number: string; title: string; length: number }>;
      }>;
    };
    expect(body.title).toBe('Music Has the Right to Children');
    expect(body.media).toHaveLength(1);
    expect(body.media[0]?.format).toBe('Digital Media');
    expect(body.media[0]?.['track-count']).toBe(2);
    expect(body.media[0]?.track[1]).toMatchObject({
      number: '2',
      title: 'Turquoise Hexagon Sun',
      length: 240000,
    });
    store.close();
  });

  it('resolves an MBID served by a previous search', async () => {
    const { app, store } = makeApp();
    await app(new Request('http://localhost/ws/2/release?query=music%20has&fmt=json'));

    const mbid = toMbid('release', 'MPREb_1');
    const response = await app(new Request(`http://localhost/ws/2/release/${mbid}?fmt=json`));

    expect(response.status).toBe(200);
    store.close();
  });

  it('returns 404 for an unknown MBID', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release/00000000-0000-4000-8000-0000000000ff'),
    );

    expect(response.status).toBe(404);
    store.close();
  });

  it('rejects unsupported inc values', async () => {
    const { app, store } = makeApp();
    store.register('release', 'MPREb_1');
    const mbid = toMbid('release', 'MPREb_1');

    const response = await app(new Request(`http://localhost/ws/2/release/${mbid}?inc=bogus`));

    expect(response.status).toBe(400);
    store.close();
  });
});

describe('release browse', () => {
  it('lists releases by an artist', async () => {
    const { app, store } = makeApp();
    store.register('artist', 'UC-artist');
    const artistMbid = toMbid('artist', 'UC-artist');

    const response = await app(
      new Request(`http://localhost/ws/2/release?artist=${artistMbid}&fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; releases: Array<{ title: string }> };
    expect(body.count).toBe(1);
    expect(body.releases[0]?.title).toBe('Music Has the Right to Children');
    store.close();
  });

  it('returns a release for a release-group browse', async () => {
    const { app, store } = makeApp();
    store.register('release-group', 'MPREb_1');
    const rgMbid = toMbid('release-group', 'MPREb_1');

    const response = await app(
      new Request(`http://localhost/ws/2/release?release-group=${rgMbid}&fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; releases: Array<{ title: string }> };
    expect(body.count).toBe(1);
    expect(body.releases[0]?.title).toBe('Music Has the Right to Children');
    store.close();
  });

  it('returns an empty list for an unknown linked entity', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/release?artist=00000000-0000-4000-8000-0000000000ff&fmt=json',
      ),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('returns an empty list when the artist page is unavailable', async () => {
    const { app, store } = makeApp();
    store.register('artist', 'UC-other');
    const artistMbid = toMbid('artist', 'UC-other');

    const response = await app(
      new Request(`http://localhost/ws/2/release?artist=${artistMbid}&fmt=json`),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('returns an empty list when the release-group is unknown', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/release?release-group=00000000-0000-4000-8000-0000000000ff&fmt=json',
      ),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('returns an empty list when the release-group album is unavailable', async () => {
    const { app, store } = makeApp();
    store.register('release-group', 'MPREb_missing');
    const rgMbid = toMbid('release-group', 'MPREb_missing');

    const response = await app(
      new Request(`http://localhost/ws/2/release?release-group=${rgMbid}&fmt=json`),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('rejects a browse without a linked entity', async () => {
    const { store, source } = makeApp();
    const context = { source, store, format: 'json' as const };

    await expect(releaseService.browse?.(context, new URLSearchParams())).rejects.toThrow();
    store.close();
  });
});
