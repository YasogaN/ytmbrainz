import { describe, expect, it } from 'bun:test';
import { firstId, makeApp } from './helpers';

const runLive = Boolean(process.env.RUN_LIVE);

describe.skipIf(!runLive)('release route (live)', () => {
  it('searches for an album', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/release?query=release:"Music Has the Right to Children" AND artist:"Boards of Canada"&fmt=json',
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      releases: Array<{ id: string; title: string }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.releases[0]?.title?.toLowerCase()).toContain('music has');
    store.close();
  }, 60_000);

  it('resolves an album by the MBID it served with a full track list', async () => {
    const { app, store } = makeApp();
    const mbid = await firstId(
      app,
      'http://localhost/ws/2/release?query=music%20has%20the%20right&fmt=json',
    );

    const lookup = await app(new Request(`http://localhost/ws/2/release/${mbid}?fmt=json`));
    expect(lookup.status).toBe(200);
    const body = (await lookup.json()) as {
      title: string;
      media: Array<{
        'track-count': number;
        track: Array<{ title: string; length: number | null }>;
      }>;
    };
    expect(body.title.toLowerCase()).toContain('music has');
    expect(body.media[0]?.['track-count']).toBeGreaterThan(0);
    expect(body.media[0]?.track[0]?.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);

  it('returns a lookup in XML with medium-list', async () => {
    const { app, store } = makeApp();
    const mbid = await firstId(
      app,
      'http://localhost/ws/2/release?query=music%20has%20the%20right&fmt=json',
    );

    const response = await app(new Request(`http://localhost/ws/2/release/${mbid}`));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<release id="');
    expect(text).toContain('<medium-list count="');
    expect(text).toContain('<track-list count="');
    store.close();
  }, 60_000);

  it('browses releases by an artist', async () => {
    const { app, store } = makeApp();
    const artistMbid = await firstId(app, 'http://localhost/ws/2/artist?query=boards&fmt=json');

    const response = await app(
      new Request(`http://localhost/ws/2/release?artist=${artistMbid}&fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      releases: Array<{ title: string }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.releases[0]?.title).toBeTruthy();
    store.close();
  }, 60_000);

  it('browses a release by release-group', async () => {
    const { app, store } = makeApp();
    const rgMbid = await firstId(
      app,
      'http://localhost/ws/2/release-group?query=music%20has%20the%20right&fmt=json',
    );

    const response = await app(
      new Request(`http://localhost/ws/2/release?release-group=${rgMbid}&fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      releases: Array<{ title: string }>;
    };
    expect(body.count).toBeGreaterThanOrEqual(1);
    expect(body.releases[0]?.title.toLowerCase()).toContain('music has');
    store.close();
  }, 60_000);
});
