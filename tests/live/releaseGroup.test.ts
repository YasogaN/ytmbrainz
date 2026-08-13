import { describe, expect, it } from 'bun:test';
import { firstId, makeApp } from './helpers';

const runLive = Boolean(process.env.RUN_LIVE);

describe.skipIf(!runLive)('release-group route (live)', () => {
  it('searches for an album release group', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/release-group?query=music%20has%20the%20right&fmt=json'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      'release-groups': Array<{ id: string; title: string; 'first-release-date': string | null }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body['release-groups'][0]?.title.toLowerCase()).toContain('music has');
    store.close();
  }, 60_000);

  it('resolves a release group by the MBID it served', async () => {
    const { app, store } = makeApp();
    const mbid = await firstId(
      app,
      'http://localhost/ws/2/release-group?query=music%20has%20the%20right&fmt=json',
    );

    const lookup = await app(new Request(`http://localhost/ws/2/release-group/${mbid}?fmt=json`));
    expect(lookup.status).toBe(200);
    const body = (await lookup.json()) as {
      title: string;
      releases: Array<{ id: string }>;
    };
    expect(body.title.toLowerCase()).toContain('music has');
    expect(body.releases.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);

  it('browses release groups by an artist', async () => {
    const { app, store } = makeApp();
    const artistMbid = await firstId(app, 'http://localhost/ws/2/artist?query=boards&fmt=json');

    const response = await app(
      new Request(`http://localhost/ws/2/release-group?artist=${artistMbid}&fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      'release-groups': Array<{ title: string }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body['release-groups'][0]?.title).toBeTruthy();
    store.close();
  }, 60_000);

  it('returns a lookup in XML', async () => {
    const { app, store } = makeApp();
    const mbid = await firstId(
      app,
      'http://localhost/ws/2/release-group?query=music%20has%20the%20right&fmt=json',
    );

    const response = await app(new Request(`http://localhost/ws/2/release-group/${mbid}`));
    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<release-group id="');
    expect(text).toContain('<first-release-date>');
    store.close();
  }, 60_000);
});
