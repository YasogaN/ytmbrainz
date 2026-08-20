import { describe, expect, it } from 'bun:test';
import { FakeSource } from '@/adapters/fake';
import { imageIdOf } from '@/caa/artwork';
import { handleCoverArt } from '@/caa/handler';
import { MbidStore, toMbid } from '@/core/mbid';

const RELEASE_MBID = toMbid('release', 'MPREb_1');
const GROUP_MBID = toMbid('release-group', 'MPREb_1');
const OTHER_MBID = toMbid('release', 'MPREb_other');
const IMAGE_ID = imageIdOf('MPREb_1');

function makeContext() {
  const store = new MbidStore(':memory:');
  store.register('release', 'MPREb_1');
  store.register('release-group', 'MPREb_1');
  const source = new FakeSource().seedAlbum({
    id: 'MPREb_1',
    name: 'Music Has the Right to Children',
    artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
    year: '1998',
    description: null,
    tracks: [],
    artwork: [
      { url: 'https://img.example.com/a=w120-h120', width: 120, height: 120 },
      { url: 'https://img.example.com/a=w544-h544', width: 544, height: 544 },
      { url: 'https://img.example.com/a=w1200-h1200', width: 1200, height: 1200 },
    ],
  });
  return { store, source };
}

function request(url: string, method = 'GET'): Request {
  return new Request(url, { method });
}

describe('handleCoverArt', () => {
  it('returns null for non-CAA paths', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request('http://localhost/ws/2/release?query=x'),
      new URL('http://localhost/ws/2/release?query=x'),
      { store, source },
    );

    expect(response).toBeNull();
    store.close();
  });

  it('answers OPTIONS with the allowed methods', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}/front`, 'OPTIONS'),
      new URL(`http://localhost/release/${RELEASE_MBID}/front`),
      { store, source },
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
    store.close();
  });

  it('rejects unsupported methods with 405', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}/front`, 'POST'),
      new URL(`http://localhost/release/${RELEASE_MBID}/front`),
      { store, source },
    );

    expect(response?.status).toBe(405);
    expect(response?.headers.get('allow')).toBe('GET, HEAD, OPTIONS');
    store.close();
  });

  it('rejects malformed MBIDs with 400', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request('http://localhost/release/not-a-uuid/front'),
      new URL('http://localhost/release/not-a-uuid/front'),
      { store, source },
    );

    expect(response?.status).toBe(400);
    store.close();
  });

  it('returns 404 for unknown MBIDs and mismatched entities', async () => {
    const { store, source } = makeContext();

    const unknown = await handleCoverArt(
      request(`http://localhost/release/${OTHER_MBID}/front`),
      new URL(`http://localhost/release/${OTHER_MBID}/front`),
      { store, source },
    );
    expect(unknown?.status).toBe(404);

    const mismatched = await handleCoverArt(
      request(`http://localhost/release/${GROUP_MBID}/front`),
      new URL(`http://localhost/release/${GROUP_MBID}/front`),
      { store, source },
    );
    expect(mismatched?.status).toBe(404);
    store.close();
  });

  it('returns 404 when the album cannot be fetched upstream', async () => {
    const store = new MbidStore(':memory:');
    store.register('release', 'MPREb_gone');
    const goneMbid = toMbid('release', 'MPREb_gone');
    const source = new FakeSource();

    const response = await handleCoverArt(
      request(`http://localhost/release/${goneMbid}/front`),
      new URL(`http://localhost/release/${goneMbid}/front`),
      { store, source },
    );

    expect(response?.status).toBe(404);
    store.close();
  });

  it('returns 404 for back images', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}/back`),
      new URL(`http://localhost/release/${RELEASE_MBID}/back`),
      { store, source },
    );

    expect(response?.status).toBe(404);
    store.close();
  });

  it('returns 404 when the album has no artwork', async () => {
    const store = new MbidStore(':memory:');
    store.register('release', 'MPREb_bare');
    const bareMbid = toMbid('release', 'MPREb_bare');
    const source = new FakeSource().seedAlbum({
      id: 'MPREb_bare',
      name: 'Bare Album',
      artists: [],
      year: null,
      description: null,
      tracks: [],
      artwork: [],
    });

    const front = await handleCoverArt(
      request(`http://localhost/release/${bareMbid}/front`),
      new URL(`http://localhost/release/${bareMbid}/front`),
      { store, source },
    );
    expect(front?.status).toBe(404);

    const index = await handleCoverArt(
      request(`http://localhost/release/${bareMbid}`),
      new URL(`http://localhost/release/${bareMbid}`),
      { store, source },
    );
    expect(index?.status).toBe(404);
    store.close();
  });

  it('answers HEAD error responses without a body', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request('http://localhost/release/not-a-uuid/front', 'HEAD'),
      new URL('http://localhost/release/not-a-uuid/front'),
      { store, source },
    );

    expect(response?.status).toBe(400);
    expect(response?.body).toBeNull();
    store.close();
  });

  it('serves the JSON index for a release', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}`),
      new URL(`http://localhost/release/${RELEASE_MBID}`),
      { store, source },
    );

    expect(response?.status).toBe(200);
    expect(response?.headers.get('content-type')).toContain('application/json');
    const body = (await response?.json()) as {
      images: Record<string, unknown>[];
      release: string;
    };
    expect(body.release).toBe(`http://localhost/release/${RELEASE_MBID}`);
    expect(body.images).toHaveLength(1);
    expect(body.images[0]).toMatchObject({
      types: ['Front'],
      front: true,
      back: false,
      approved: true,
      id: IMAGE_ID,
      image: `http://localhost/release/${RELEASE_MBID}/${IMAGE_ID}.jpg`,
    });
    const thumbnails = body.images[0]?.thumbnails as Record<string, string>;
    expect(thumbnails['250']).toBe(`http://localhost/release/${RELEASE_MBID}/${IMAGE_ID}-250.jpg`);
    expect(thumbnails['500']).toBe(`http://localhost/release/${RELEASE_MBID}/${IMAGE_ID}-500.jpg`);
    expect(thumbnails['1200']).toBe(
      `http://localhost/release/${RELEASE_MBID}/${IMAGE_ID}-1200.jpg`,
    );
    expect(thumbnails.small).toBe(thumbnails['250']);
    expect(thumbnails.large).toBe(thumbnails['500']);
    store.close();
  });

  it('serves the JSON index for a release group pointing at its release', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release-group/${GROUP_MBID}`),
      new URL(`http://localhost/release-group/${GROUP_MBID}`),
      { store, source },
    );

    expect(response?.status).toBe(200);
    const body = (await response?.json()) as {
      images: Record<string, unknown>[];
      release: string;
    };
    expect(body.release).toBe(`http://localhost/release/${RELEASE_MBID}`);
    expect(body.images[0]?.image).toBe(`http://localhost/release/${RELEASE_MBID}/${IMAGE_ID}.jpg`);
    store.close();
  });

  it('serves HEAD requests without a body', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}`, 'HEAD'),
      new URL(`http://localhost/release/${RELEASE_MBID}`),
      { store, source },
    );

    expect(response?.status).toBe(200);
    expect(response?.body).toBeNull();
    store.close();
  });

  it('redirects /front to the largest artwork', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}/front`),
      new URL(`http://localhost/release/${RELEASE_MBID}/front`),
      { store, source },
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('https://img.example.com/a=w1200-h1200');
    store.close();
  });

  it('redirects sized front requests to a rewritten thumbnail url', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}/front-500`),
      new URL(`http://localhost/release/${RELEASE_MBID}/front-500`),
      { store, source },
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('https://img.example.com/a=w500-h500');
    store.close();
  });

  it('redirects image requests for the known image id', async () => {
    const { store, source } = makeContext();

    const match = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}/${IMAGE_ID}-250.jpg`),
      new URL(`http://localhost/release/${RELEASE_MBID}/${IMAGE_ID}-250.jpg`),
      { store, source },
    );
    expect(match?.status).toBe(307);
    expect(match?.headers.get('location')).toBe('https://img.example.com/a=w250-h250');

    const wrongId = await handleCoverArt(
      request(`http://localhost/release/${RELEASE_MBID}/nope-250.jpg`),
      new URL(`http://localhost/release/${RELEASE_MBID}/nope-250.jpg`),
      { store, source },
    );
    expect(wrongId?.status).toBe(404);
    store.close();
  });

  it('serves release-group front redirects through the same album', async () => {
    const { store, source } = makeContext();

    const response = await handleCoverArt(
      request(`http://localhost/release-group/${GROUP_MBID}/front-1200`),
      new URL(`http://localhost/release-group/${GROUP_MBID}/front-1200`),
      { store, source },
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('https://img.example.com/a=w1200-h1200');
    store.close();
  });

  it('falls back to the largest artwork when nothing is big enough', async () => {
    const store = new MbidStore(':memory:');
    store.register('release', 'MPREb_small');
    const smallMbid = toMbid('release', 'MPREb_small');
    const source = new FakeSource().seedAlbum({
      id: 'MPREb_small',
      name: 'Small Art',
      artists: [],
      year: null,
      description: null,
      tracks: [],
      artwork: [{ url: 'https://img.example.com/s=w120-h120', width: 120, height: 120 }],
    });

    const response = await handleCoverArt(
      request(`http://localhost/release/${smallMbid}/front-500`),
      new URL(`http://localhost/release/${smallMbid}/front-500`),
      { store, source },
    );

    expect(response?.status).toBe(307);
    expect(response?.headers.get('location')).toBe('https://img.example.com/s=w500-h500');
    store.close();
  });
});
