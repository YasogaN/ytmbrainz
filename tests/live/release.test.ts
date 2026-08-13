import { describe, expect, it } from 'bun:test';
import { InnerTubeSource } from '@/adapters/innertube';
import { MbidStore } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { releaseService } from '@/ws/services/release';

const runLive = Boolean(process.env.RUN_LIVE);

const makeApp = () => {
  const source = new InnerTubeSource();
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { release: releaseService } });
  return { app, store };
};

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

  it('resolves an album by the MBID it served', async () => {
    const { app, store } = makeApp();
    const search = await app(
      new Request('http://localhost/ws/2/release?query=music%20has%20the%20right&fmt=json'),
    );
    const body = (await search.json()) as { releases: Array<{ id: string }> };
    const mbid = body.releases[0]?.id;
    expect(mbid).toBeTruthy();

    const lookup = await app(new Request(`http://localhost/ws/2/release/${mbid}?fmt=json`));
    expect(lookup.status).toBe(200);
    const lookupBody = (await lookup.json()) as {
      title: string;
      media: Array<{ 'track-count': number }>;
    };
    expect(lookupBody.title.toLowerCase()).toContain('music has');
    expect(lookupBody.media[0]?.['track-count']).toBeGreaterThan(0);
    store.close();
  }, 60_000);
});
