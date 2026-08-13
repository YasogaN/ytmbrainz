import { describe, expect, it } from 'bun:test';
import { InnerTubeSource } from '@/adapters/innertube';
import { MbidStore } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { urlService } from '@/ws/services/url';

const runLive = Boolean(process.env.RUN_LIVE);

const makeApp = () => {
  const source = new InnerTubeSource();
  const store = new MbidStore(':memory:');
  const app = createApp({ source, store, services: { url: urlService } });
  return { app, store };
};

describe.skipIf(!runLive)('url route (live)', () => {
  it('maps a watch URL to a recording', async () => {
    const { app, store } = makeApp();
    const response = await app(
      new Request(
        'http://localhost/ws/2/url?resource=https%3A%2F%2Fwww.youtube.com%2Fwatch%3Fv%3DdQw4w9WgXcQ&fmt=json',
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      resource: string;
      relations: Array<{ type: string; recording: { title: string; length: number | null } }>;
    };
    expect(body.relations[0]?.type).toBe('recording');
    expect(body.relations[0]?.recording.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);
});
