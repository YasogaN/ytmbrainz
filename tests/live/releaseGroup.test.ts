import { describe, expect, it } from 'bun:test';
import { InnerTubeSource } from '@/adapters/innertube';
import { MbidStore } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { releaseGroupService } from '@/ws/services/releaseGroup';

const runLive = Boolean(process.env.RUN_LIVE);

const makeApp = () => {
  const source = new InnerTubeSource();
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { 'release-group': releaseGroupService } });
  return { app, store };
};

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
    const search = await app(
      new Request('http://localhost/ws/2/release-group?query=music%20has&fmt=json'),
    );
    const body = (await search.json()) as { 'release-groups': Array<{ id: string }> };
    const mbid = body['release-groups'][0]?.id;
    expect(mbid).toBeTruthy();

    const lookup = await app(new Request(`http://localhost/ws/2/release-group/${mbid}?fmt=json`));
    expect(lookup.status).toBe(200);
    const lookupBody = (await lookup.json()) as {
      title: string;
      releases: Array<{ id: string }>;
    };
    expect(lookupBody.title.toLowerCase()).toContain('music has');
    expect(lookupBody.releases.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);
});
