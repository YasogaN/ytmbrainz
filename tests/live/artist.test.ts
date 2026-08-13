import { describe, expect, it } from 'bun:test';
import { firstId, makeApp } from './helpers';

const runLive = Boolean(process.env.RUN_LIVE);

describe.skipIf(!runLive)('artist route (live)', () => {
  it('searches for an artist', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/artist?query=artist:"Boards of Canada"&fmt=json'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      artists: Array<{ id: string; name: string }>;
    };
    expect(body.count).toBeGreaterThan(0);
    expect(body.artists[0]?.name).toBe('Boards of Canada');
    store.close();
  }, 60_000);

  it('resolves an artist by the MBID it served', async () => {
    const { app, store } = makeApp();
    const mbid = await firstId(app, 'http://localhost/ws/2/artist?query=boards&fmt=json');

    const lookup = await app(new Request(`http://localhost/ws/2/artist/${mbid}?fmt=json`));
    expect(lookup.status).toBe(200);
    const body = (await lookup.json()) as { name: string };
    expect(body.name).toBe('Boards of Canada');
    store.close();
  }, 60_000);

  it('returns XML by default with a sort-name', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/artist?query=boards'));

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('<artist-list count="');
    expect(text).toContain('<sort-name>Boards of Canada</sort-name>');
    expect(text).toContain('<life-span><ended>false</ended></life-span>');
    store.close();
  }, 60_000);
});
