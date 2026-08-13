import { describe, expect, it } from 'bun:test';
import { FakeSource } from '@/adapters/fake';
import type { YtTrack } from '@/adapters/types';
import { MbidStore, toMbid } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { recordingService } from '@/ws/services/recording';

const roygbiv: YtTrack = {
  id: 'video-1',
  title: 'Roygbiv',
  artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
  album: { id: 'MPREb_1', name: 'Music Has the Right to Children', artists: [], year: '1998' },
  durationSeconds: 148,
  year: '1998',
};

const aquarius: YtTrack = {
  id: 'video-2',
  title: 'Aquarius',
  artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
  album: { id: 'MPREb_1', name: 'Music Has the Right to Children', artists: [], year: '1998' },
  durationSeconds: 240,
  year: '1998',
};

const makeApp = () => {
  const source = new FakeSource().seedTrack(roygbiv).seedTrack(aquarius);
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { recording: recordingService } });
  return { app, store };
};

describe('recording search', () => {
  it('returns matching recordings as JSON', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/recording?query=roygbiv&fmt=json'),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      count: number;
      recordings: Array<{ id: string; title: string; length: number }>;
    };
    expect(body.count).toBe(1);
    expect(body.recordings[0]?.title).toBe('Roygbiv');
    expect(body.recordings[0]?.length).toBe(148000);
    expect(body.recordings[0]?.id).toBe(toMbid('recording', 'video-1'));
    store.close();
  });

  it('returns XML by default with the mmd namespace', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/recording?query=roygbiv'));

    expect(response.status).toBe(200);
    const text = await response.text();
    expect(text).toContain('xmlns="http://musicbrainz.org/ns/mmd-2.0#"');
    expect(text).toContain('<recording-list count="1" offset="0">');
    expect(text).toContain('<title>Roygbiv</title>');
    expect(text).toContain('<length>148000</length>');
    store.close();
  });

  it('parses fielded queries into the search text', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/recording?query=recording:"Roygbiv" AND artist:"Boards of Canada"&fmt=json',
      ),
    );

    const body = (await response.json()) as { count: number };
    expect(body.count).toBe(1);
    store.close();
  });

  it('filters by duration range', async () => {
    const { app, store } = makeApp();
    const within = await app(
      new Request(
        'http://localhost/ws/2/recording?query=recording:"Roygbiv" AND dur:[100000 TO 200000]&fmt=json',
      ),
    );
    expect(((await within.json()) as { count: number }).count).toBe(1);

    const outside = await app(
      new Request(
        'http://localhost/ws/2/recording?query=recording:"Roygbiv" AND dur:[0 TO 100000]&fmt=json',
      ),
    );
    expect(((await outside.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('returns an empty list for a filter-only query', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/recording?query=dur:[100000 TO 200000]&fmt=json'),
    );

    expect(((await response.json()) as { count: number }).count).toBe(0);
    store.close();
  });

  it('requires the query parameter', async () => {
    const { app, store } = makeApp();
    const response = await app(new Request('http://localhost/ws/2/recording?fmt=json'));

    expect(response.status).toBe(400);
    store.close();
  });
});

describe('recording lookup', () => {
  it('resolves an MBID served by a previous search', async () => {
    const { app, store } = makeApp();
    await app(new Request('http://localhost/ws/2/recording?query=roygbiv&fmt=json'));

    const mbid = toMbid('recording', 'video-1');
    const response = await app(new Request(`http://localhost/ws/2/recording/${mbid}?fmt=json`));

    expect(response.status).toBe(200);
    const body = (await response.json()) as { title: string; 'artist-credit': unknown[] };
    expect(body.title).toBe('Roygbiv');
    expect(body['artist-credit']).toHaveLength(1);
    store.close();
  });

  it('returns 404 for an unknown MBID', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request('http://localhost/ws/2/recording/00000000-0000-4000-8000-0000000000ff'),
    );

    expect(response.status).toBe(404);
    store.close();
  });

  it('returns 404 when the MBID maps to a different entity', async () => {
    const { app, store } = makeApp();
    store.register('artist', 'UC-artist');
    const artistMbid = toMbid('artist', 'UC-artist');

    const response = await app(new Request(`http://localhost/ws/2/recording/${artistMbid}`));

    expect(response.status).toBe(404);
    store.close();
  });

  it('rejects unsupported inc values', async () => {
    const { app, store } = makeApp();
    store.register('recording', 'video-1');
    const mbid = toMbid('recording', 'video-1');

    const response = await app(new Request(`http://localhost/ws/2/recording/${mbid}?inc=labels`));

    expect(response.status).toBe(400);
    store.close();
  });

  it('accepts supported inc values', async () => {
    const { app, store } = makeApp();
    store.register('recording', 'video-1');
    const mbid = toMbid('recording', 'video-1');

    const response = await app(
      new Request(`http://localhost/ws/2/recording/${mbid}?inc=releases+artist-credits&fmt=json`),
    );

    expect(response.status).toBe(200);
    store.close();
  });
});
