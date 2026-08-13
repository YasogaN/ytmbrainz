import { describe, expect, it } from 'bun:test';
import { FakeSource } from '@/adapters/fake';
import { MbidStore, toMbid } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { artistService } from '@/ws/services/artist';

const makeApp = () => {
  const source = new FakeSource().seedArtist({
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
    topTracks: [
      {
        id: 'video-1',
        title: 'Roygbiv',
        artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
        album: null,
        durationSeconds: 148,
        year: '1998',
      },
    ],
  });
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { artist: artistService } });
  return { app, store };
};

describe('artist search', () => {
  it('returns matching artists as JSON', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/artist?query=boards&fmt=json'));

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      artists: Array<{ id: string; name: string; 'sort-name': string }>;
    };
    expect(body.count).toBe(1);
    expect(body.artists[0]?.name).toBe('Boards of Canada');
    expect(body.artists[0]?.['sort-name']).toBe('Boards of Canada');
    expect(body.artists[0]?.id).toBe(toMbid('artist', 'UC-artist'));
    store.close();
  });

  it('returns XML by default', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/artist?query=boards'));

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<artist-list count="1" offset="0">');
    expect(text).toContain('<name>Boards of Canada</name>');
    expect(text).toContain('<life-span><ended>false</ended></life-span>');
    store.close();
  });

  it('parses fielded queries', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/artist?query=artist:"Boards of Canada"&fmt=json'),
    );

    expect(((await response.json()) as { count: number }).count).toBe(1);
    store.close();
  });

  it('returns an empty list for a filter-only query', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/artist?query=ended:true&fmt=json'),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('requires the query parameter', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/artist?fmt=json'));

    expect(response.status).toBe(400);
    store.close();
  });
});

describe('artist lookup', () => {
  it('resolves an MBID served by a previous search', async () => {
    const { app, store } = makeApp();
    await app(new Request('http://localhost/ws/2/artist?query=boards&fmt=json'));

    const mbid = toMbid('artist', 'UC-artist');
    const response = await app(new Request(`http://localhost/ws/2/artist/${mbid}?fmt=json`));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { name: string; 'life-span': { ended: boolean } };
    expect(body.name).toBe('Boards of Canada');
    expect(body['life-span'].ended).toBe(false);
    store.close();
  });

  it('returns 404 for an unknown MBID', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/artist/00000000-0000-4000-8000-0000000000ff'),
    );

    expect(response.status).toBe(404);
    store.close();
  });

  it('returns 404 when the MBID maps to a different entity', async () => {
    const { app, store } = makeApp();
    store.register('recording', 'video-1');
    const recordingMbid = toMbid('recording', 'video-1');

    const response = await app(new Request(`http://localhost/ws/2/artist/${recordingMbid}`));

    expect(response.status).toBe(404);
    store.close();
  });

  it('rejects unsupported inc values', async () => {
    const { app, store } = makeApp();
    store.register('artist', 'UC-artist');
    const mbid = toMbid('artist', 'UC-artist');

    const response = await app(new Request(`http://localhost/ws/2/artist/${mbid}?inc=discids`));

    expect(response.status).toBe(400);
    store.close();
  });

  it('accepts supported inc values', async () => {
    const { app, store } = makeApp();
    store.register('artist', 'UC-artist');
    const mbid = toMbid('artist', 'UC-artist');

    const response = await app(
      new Request(`http://localhost/ws/2/artist/${mbid}?inc=aliases+url-rels&fmt=json`),
    );

    expect(response.status).toBe(200);
    store.close();
  });

  it('populates recordings, releases, and release groups with inc', async () => {
    const { app, store } = makeApp();
    store.register('artist', 'UC-artist');
    const mbid = toMbid('artist', 'UC-artist');

    const response = await app(
      new Request(
        `http://localhost/ws/2/artist/${mbid}?inc=recordings+releases+release-groups&fmt=json`,
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      recordings: Array<{ title: string }>;
      releases: Array<{ id: string }>;
      'release-groups': Array<{ id: string }>;
    };
    expect(body.recordings).toHaveLength(1);
    expect(body.recordings[0]?.title).toBe('Roygbiv');
    expect(body.releases).toHaveLength(1);
    expect(body.releases[0]?.id).toBe(toMbid('release', 'MPREb_1'));
    expect(body['release-groups']).toHaveLength(1);
    expect(body['release-groups'][0]?.id).toBe(toMbid('release-group', 'MPREb_1'));
    store.close();
  });
});
