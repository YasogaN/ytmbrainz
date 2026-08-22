import { InnerTubeSource } from '@/adapters/innertube';
import type { YouTubeSource } from '@/adapters/source';
import { MbidStore } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { artistService } from '@/ws/services/artist';
import { recordingService } from '@/ws/services/recording';
import { releaseService } from '@/ws/services/release';
import { releaseGroupService } from '@/ws/services/releaseGroup';
import { urlService } from '@/ws/services/url';

/**
 * One InnerTube session shared by all live tests in a file. Creating a fresh
 * session per test floods YouTube with new anonymous visitor identities from
 * the same IP, which is a BotGuard trigger. A single reused session keeps the
 * request profile human-shaped while still exercising the real adapter.
 */
export const sharedSource = new InnerTubeSource();

export const makeApp = (source: YouTubeSource = sharedSource) => {
  const store = new MbidStore(':memory:');
  const app = createApp({
    source,
    store,
    services: {
      artist: artistService,
      recording: recordingService,
      release: releaseService,
      'release-group': releaseGroupService,
      url: urlService,
    },
  });
  return { app, store };
};

export const firstId = async (
  app: (request: Request) => Promise<Response>,
  url: string,
): Promise<string> => {
  const response = await app(new Request(url));
  const body = (await response.json()) as Record<string, unknown>;
  const listKey = Object.keys(body).find(
    key => key !== 'created' && key !== 'count' && key !== 'offset',
  );
  const list = body[listKey ?? ''] as Array<{ id?: string }> | undefined;
  const id = list?.[0]?.id;
  if (id === undefined) {
    throw new Error(`No first id for ${url}`);
  }
  return id;
};
