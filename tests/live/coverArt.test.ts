import { beforeAll, describe, expect, it } from 'bun:test';
import type { YtAlbum, YtAlbumRef } from '@/adapters/types';
import { imageIdOf } from '@/caa/artwork';
import { toMbid } from '@/core/mbid';
import { makeApp, sharedSource } from './helpers';

const runLive = Boolean(process.env.RUN_LIVE);

async function findAlbumWithArtwork(source: {
  searchAlbums(query: string, limit?: number): Promise<YtAlbumRef[]>;
  getAlbum(id: string): Promise<YtAlbum | null>;
}): Promise<YtAlbum & { id: string }> {
  const albums = await source.searchAlbums('Music Has the Right to Children Boards of Canada');
  for (const ref of albums) {
    if (ref.id === null) {
      continue;
    }
    const album = await source.getAlbum(ref.id);
    if (album !== null && album.id !== null && album.artwork.length > 0) {
      return album as YtAlbum & { id: string };
    }
  }
  throw new Error('No album with artwork found.');
}

describe.skipIf(!runLive)('cover art routes (live)', () => {
  // Finding an album with artwork is the heaviest part of this suite; resolve
  // it once so the eight tests share the fixture instead of re-searching.
  let fixture!: YtAlbum & { id: string };
  beforeAll(async () => {
    fixture = await findAlbumWithArtwork(sharedSource);
  });

  it('serves an index with thumbnails for a release', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    store.register('release', album.id);

    const response = await app(new Request(`http://localhost/release/${releaseMbid}`));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/json');

    const body = (await response.json()) as {
      images: Array<{ id: string; image: string; thumbnails: Record<string, string> }>;
      release: string;
    };
    expect(body.images.length).toBeGreaterThan(0);
    const image = body.images[0];
    expect(image?.image).toMatch(/^https?:\/\//);
    expect(image?.id).toBe(imageIdOf(album.id));
    expect(image?.thumbnails['250']).toContain('-250.jpg');
    expect(image?.thumbnails['500']).toContain('-500.jpg');
    expect(image?.thumbnails['1200']).toContain('-1200.jpg');
    expect(body.release).toBe(`http://localhost/release/${releaseMbid}`);
    store.close();
  }, 60_000);

  it('redirects front to the largest artwork', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    store.register('release', album.id);

    const response = await app(new Request(`http://localhost/release/${releaseMbid}/front`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toMatch(/^https?:\/\//);
    store.close();
  }, 60_000);

  it('rewrites a sized front to the requested dimensions', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    store.register('release', album.id);

    const response = await app(new Request(`http://localhost/release/${releaseMbid}/front-500`));
    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toContain('=w500-h500');
    store.close();
  }, 60_000);

  it('serves an image variant for the album', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    store.register('release', album.id);
    const imageId = imageIdOf(album.id);

    const full = await app(new Request(`http://localhost/release/${releaseMbid}/${imageId}.jpg`));
    expect(full.status).toBe(307);
    expect(full.headers.get('location')).toMatch(/^https?:\/\//);

    const sized = await app(
      new Request(`http://localhost/release/${releaseMbid}/${imageId}-500.jpg`),
    );
    expect(sized.status).toBe(307);
    expect(sized.headers.get('location')).toContain('=w500-h500');
    store.close();
  }, 60_000);

  it('returns 404 for back cover', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    store.register('release', album.id);

    const response = await app(new Request(`http://localhost/release/${releaseMbid}/back`));
    expect(response.status).toBe(404);
    store.close();
  }, 60_000);

  it('returns 404 for an unknown image id', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    store.register('release', album.id);

    const response = await app(new Request(`http://localhost/release/${releaseMbid}/deadbeef.jpg`));
    expect(response.status).toBe(404);
    store.close();
  }, 60_000);

  it('serves the release-group index pointing at the release', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    const groupMbid = toMbid('release-group', album.id);
    store.register('release-group', album.id);

    const response = await app(new Request(`http://localhost/release-group/${groupMbid}`));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { release: string };
    expect(body.release).toBe(`http://localhost/release/${releaseMbid}`);
    store.close();
  }, 60_000);

  it('serves a HEAD index without a body', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    store.register('release', album.id);

    const response = await app(
      new Request(`http://localhost/release/${releaseMbid}`, { method: 'HEAD' }),
    );
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('');
    store.close();
  }, 60_000);

  it('front redirect points at a reachable image', async () => {
    const { app, store } = makeApp(sharedSource);
    const album = fixture;

    const releaseMbid = toMbid('release', album.id);
    store.register('release', album.id);

    const redirect = await app(new Request(`http://localhost/release/${releaseMbid}/front`));
    const location = redirect.headers.get('location');
    expect(location).toBeTruthy();

    const image = await fetch(location ?? '', { method: 'HEAD' });
    expect(image.status).toBeGreaterThanOrEqual(200);
    expect(image.status).toBeLessThan(400);
    store.close();
  }, 60_000);
});
