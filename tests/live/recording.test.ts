import { describe, expect, it } from 'bun:test';
import { firstId, makeApp } from './helpers';

const runLive = Boolean(process.env.RUN_LIVE);

describe.skipIf(!runLive)('recording route (live)', () => {
  it('searches songs with real durations', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/recording?query=recording:"Roygbiv" AND artist:"Boards of Canada"&fmt=json',
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      recordings: Array<{ id: string; title: string; length: number | null }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.recordings[0]?.title).toBeTruthy();
    expect(body.recordings[0]?.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);

  it('resolves a recording by the MBID it served', async () => {
    const { app, store } = makeApp();
    const search = await app(new Request('http://localhost/ws/2/recording?query=roygbiv&fmt=json'));
    const body = (await search.json()) as { recordings: Array<{ id: string }> };
    const mbid = body.recordings[0]?.id;
    expect(mbid).toBeTruthy();

    const lookup = await app(new Request(`http://localhost/ws/2/recording/${mbid}?fmt=json`));
    expect(lookup.status).toBe(200);
    const lookupBody = (await lookup.json()) as { title: string; length: number | null };
    expect(lookupBody.title).toBeTruthy();
    expect(lookupBody.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);

  it('filters by duration range', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/recording?query=recording:"Roygbiv" AND artist:"Boards of Canada" AND dur:[100000 TO 200000]&fmt=json',
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      recordings: Array<{ length: number | null }>;
    };
    expect(body.count).toBeGreaterThan(0);
    for (const recording of body.recordings) {
      expect(recording.length).toBeGreaterThanOrEqual(100000);
      expect(recording.length).toBeLessThanOrEqual(200000);
    }
    store.close();
  }, 60_000);

  it('returns XML by default', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/recording?query=roygbiv'));

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    const text = await response.text();
    expect(text).toContain('<recording-list count="');
    expect(text).toContain('<length>');
    store.close();
  }, 60_000);

  it('pages results with limit and offset', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/recording?query=roygbiv&limit=2&offset=1&fmt=json'),
    );

    const body = (await response.json()) as {
      count: number;
      offset: number;
      recordings: Array<{ id: string }>;
    };
    expect(body.offset).toBe(1);
    expect(body.recordings).toHaveLength(2);
    store.close();
  }, 60_000);

  it('browses recordings by an artist', async () => {
    const { app, store } = makeApp();
    const artistMbid = await firstId(app, 'http://localhost/ws/2/artist?query=boards&fmt=json');
    expect(artistMbid).toBeTruthy();

    const response = await app(
      new Request(`http://localhost/ws/2/recording?artist=${artistMbid}&fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      recordings: Array<{ title: string; length: number | null }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.recordings[0]?.title).toBeTruthy();
    store.close();
  }, 60_000);

  it('browses recordings on a release', async () => {
    const { app, store } = makeApp();
    const releaseMbid = await firstId(
      app,
      'http://localhost/ws/2/release?query=music%20has%20the%20right&fmt=json',
    );
    expect(releaseMbid).toBeTruthy();

    const response = await app(
      new Request(`http://localhost/ws/2/recording?release=${releaseMbid}&fmt=json`),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      recordings: Array<{ length: number | null }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.recordings[0]?.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);
});
