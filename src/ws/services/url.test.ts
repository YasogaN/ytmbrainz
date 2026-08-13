import { describe, expect, it } from 'bun:test';
import { FakeSource } from '@/adapters/fake';
import { MbidStore, toMbid } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { urlService } from '@/ws/services/url';

const makeApp = () => {
  const source = new FakeSource()
    .seedTrack({
      id: 'video-1',
      title: 'Roygbiv',
      artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
      album: null,
      durationSeconds: 148,
      year: '1998',
    })
    .seedAlbum({
      id: 'MPREb_1',
      name: 'Music Has the Right to Children',
      artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
      year: '1998',
      description: null,
      tracks: [],
    })
    .seedArtist({
      id: 'UC-artist',
      name: 'Boards of Canada',
      albums: [],
      singles: [],
      topTracks: [],
    });
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { url: urlService } });
  return { app, store };
};

describe('url lookup by resource', () => {
  it('maps a watch URL to a recording', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/url?resource=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3Dvideo-1&fmt=json',
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      id: string;
      resource: string;
      relations: Array<{
        type: string;
        target: string;
        direction: string;
        recording: { title: string; length: number };
      }>;
    };
    expect(body.resource).toBe('https://www.youtube.com/watch?v=video-1');
    expect(body.relations[0]?.type).toBe('recording');
    expect(body.relations[0]?.target).toBe(toMbid('recording', 'video-1'));
    expect(body.relations[0]?.recording.title).toBe('Roygbiv');
    expect(body.relations[0]?.recording.length).toBe(148000);
    store.close();
  });

  it('maps an album URL to a release', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/url?resource=https%3A%2F%2Fmusic.youtube.com%2Falbum%2FMPREb_1&fmt=json',
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      relations: Array<{ type: string; release: { title: string } }>;
    };
    expect(body.relations[0]?.type).toBe('release');
    expect(body.relations[0]?.release.title).toBe('Music Has the Right to Children');
    store.close();
  });

  it('maps a channel URL to an artist', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/url?resource=https%3A%2F%2Fwww.youtube.com%2Fchannel%2FUC-artist&fmt=json',
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      relations: Array<{ type: string; artist: { name: string } }>;
    };
    expect(body.relations[0]?.type).toBe('artist');
    expect(body.relations[0]?.artist.name).toBe('Boards of Canada');
    store.close();
  });

  it('returns 404 for an unmapped URL', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/url?resource=https%3A%2F%2Fwww.youtube.com%2Fplaylist%2FPL-123',
      ),
    );

    expect(response.status).toBe(404);
    store.close();
  });

  it('returns 404 when the target entity cannot be resolved', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/url?resource=https%3A%2F%2Fyoutu.be%2Fvideo-missing'),
    );

    expect(response.status).toBe(404);
    store.close();
  });

  it('returns XML by default', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/url?resource=https%3A%2F%2Fyoutu.be%2Fvideo-1'),
    );

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<url id="');
    expect(text).toContain('<resource>https://youtu.be/video-1</resource>');
    expect(text).toContain('<relation-list target-type="recording">');
    store.close();
  });

  it('resolves a url by the MBID it served', async () => {
    const { app, store } = makeApp();
    const resource = 'https://www.youtube.com/watch?v=video-1';
    await app(new Request(`http://localhost/ws/2/url?resource=${encodeURIComponent(resource)}`));

    const mbid = toMbid('url', resource);
    const response = await app(new Request(`http://localhost/ws/2/url/${mbid}?fmt=json`));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { resource: string };
    expect(body.resource).toBe(resource);
    store.close();
  });

  it('returns 404 for an unknown url MBID', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/url/00000000-0000-4000-8000-0000000000ff'),
    );

    expect(response.status).toBe(404);
    store.close();
  });

  it('rejects unsupported inc values', async () => {
    const { app, store } = makeApp();
    const resource = 'https://youtu.be/video-1';
    store.register('url', resource);
    const mbid = toMbid('url', resource);

    const response = await app(new Request(`http://localhost/ws/2/url/${mbid}?inc=discids`));

    expect(response.status).toBe(400);
    store.close();
  });
});

describe('url search', () => {
  it('finds a url entity from a url query', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/url?query=url:%22https%3A%2F%2Fyoutu.be%2Fvideo-1%22&fmt=json',
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; urls: Array<{ resource: string }> };
    expect(body.count).toBe(1);
    expect(body.urls[0]?.resource).toBe('https://youtu.be/video-1');
    store.close();
  });

  it('returns an empty list for a non-url query', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/url?query=boards%20of%20canada&fmt=json'),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('requires the query parameter', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/url?fmt=json'));

    expect(response.status).toBe(400);
    store.close();
  });
});
