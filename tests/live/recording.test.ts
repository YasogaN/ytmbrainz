import { describe, expect, it } from 'bun:test';
import { InnerTubeSource } from '@/adapters/innertube';
import { MbidStore } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { recordingService } from '@/ws/services/recording';

const runLive = Boolean(process.env.RUN_LIVE);

const makeApp = () => {
  const source = new InnerTubeSource();
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { recording: recordingService } });
  return { app, store };
};

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
});
