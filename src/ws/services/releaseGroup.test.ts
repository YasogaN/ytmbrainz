import { describe, expect, it } from 'bun:test';
import { FakeSource } from '@/adapters/fake';
import { MbidStore, toMbid } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { releaseGroupService } from '@/ws/services/releaseGroup';

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
  const app = createApp({ source, store, services: { 'release-group': releaseGroupService } });
  return { app, store, source };
};

describe('release-group search', () => {
  it('returns matching release groups as JSON', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release-group?query=music%20has&fmt=json'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      'release-groups': Array<{
        id: string;
        title: string;
        'primary-type': string;
        releases: Array<{ id: string }>;
      }>;
    };
    expect(body.count).toBe(1);
    expect(body['release-groups'][0]?.title).toBe('Music Has the Right to Children');
    expect(body['release-groups'][0]?.id).toBe(toMbid('release-group', 'MPREb_1'));
    expect(body['release-groups'][0]?.['primary-type']).toBe('Album');
    expect(body['release-groups'][0]?.releases[0]?.id).toBe(toMbid('release', 'MPREb_1'));
    store.close();
  });

  it('returns XML by default', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release-group?query=music%20has'),
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<release-group-list count="1" offset="0">');
    expect(text).toContain('<first-release-date>1998</first-release-date>');
    store.close();
  });

  it('filters by type', async () => {
    const { app, store } = makeApp();
    const match = await app(
      new Request(
        'http://localhost/ws/2/release-group?query=releasegroup:"Music Has" AND type:album&fmt=json',
      ),
    );
    expect(((await match.json()) as { count: number }).count).toBe(1);

    const noMatch = await app(
      new Request(
        'http://localhost/ws/2/release-group?query=releasegroup:"Music Has" AND type:ep&fmt=json',
      ),
    );
    expect(((await noMatch.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('returns an empty list for a filter-only query', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release-group?query=secondarytype:compilation&fmt=json'),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('requires the query parameter', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/release-group?fmt=json'));

    expect(response.status).toBe(400);
    store.close();
  });
});

describe('release-group lookup', () => {
  it('returns a full release group with releases', async () => {
    const { app, store } = makeApp();
    store.register('release-group', 'MPREb_1');

    const response = await app(
      new Request(
        `http://localhost/ws/2/release-group/${toMbid('release-group', 'MPREb_1')}?fmt=json`,
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      title: string;
      'primary-type': string;
      releases: Array<{ id: string }>;
    };
    expect(body.title).toBe('Music Has the Right to Children');
    expect(body['primary-type']).toBe('Single');
    expect(body.releases[0]?.id).toBe(toMbid('release', 'MPREb_1'));
    store.close();
  });

  it('resolves an MBID served by a previous search', async () => {
    const { app, store } = makeApp();
    await app(new Request('http://localhost/ws/2/release-group?query=music%20has&fmt=json'));

    const mbid = toMbid('release-group', 'MPREb_1');
    const response = await app(new Request(`http://localhost/ws/2/release-group/${mbid}?fmt=json`));

    expect(response.status).toBe(200);
    store.close();
  });

  it('returns 404 for an unknown MBID', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release-group/00000000-0000-4000-8000-0000000000ff'),
    );

    expect(response.status).toBe(404);
    store.close();
  });

  it('rejects unsupported inc values', async () => {
    const { app, store } = makeApp();
    store.register('release-group', 'MPREb_1');
    const mbid = toMbid('release-group', 'MPREb_1');

    const response = await app(
      new Request(`http://localhost/ws/2/release-group/${mbid}?inc=discids`),
    );

    expect(response.status).toBe(400);
    store.close();
  });
});

describe('release-group browse', () => {
  it('lists release groups by an artist', async () => {
    const { app, store } = makeApp();
    store.register('artist', 'UC-artist');
    const artistMbid = toMbid('artist', 'UC-artist');

    const response = await app(
      new Request(`http://localhost/ws/2/release-group?artist=${artistMbid}&fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      'release-groups': Array<{ title: string }>;
    };
    expect(body.count).toBe(1);
    expect(body['release-groups'][0]?.title).toBe('Music Has the Right to Children');
    store.close();
  });

  it('returns an empty list for an unknown linked entity', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/release-group?artist=00000000-0000-4000-8000-0000000000ff&fmt=json',
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
      new Request(`http://localhost/ws/2/release-group?artist=${artistMbid}&fmt=json`),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('rejects a browse without a linked entity', async () => {
    const { store, source } = makeApp();
    const context = { source, store, format: 'json' as const };

    await expect(releaseGroupService.browse?.(context, new URLSearchParams())).rejects.toThrow();
    store.close();
  });
});
