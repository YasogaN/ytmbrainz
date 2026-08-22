import { BgUtilsTokenMinter } from '@/adapters/bgutils';
import { InnerTubeSource } from '@/adapters/innertube';
import type { YouTubeSource } from '@/adapters/source';
import { loadConfig } from '@/core/config';
import { MbidStore } from '@/core/mbid';
import { CachingSource, TtlCache } from '@/server/cache';
import { RateLimitedSource } from '@/server/rateLimit';
import { createApp } from '@/ws/app';
import { artistService } from '@/ws/services/artist';
import { recordingService } from '@/ws/services/recording';
import { releaseService } from '@/ws/services/release';
import { releaseGroupService } from '@/ws/services/releaseGroup';
import { urlService } from '@/ws/services/url';

const liveConfig = loadConfig();

/**
 * One InnerTube session shared by all live tests in a file. Creating a fresh
 * session per test floods YouTube with new anonymous visitor identities from
 * the same IP, which is a BotGuard trigger. A single reused session keeps the
 * request profile human-shaped while still exercising the real adapter.
 *
 * Like the production entry point, the session works out of the box:
 * YTMB_VISITOR_DATA, YTMB_COOKIE, and YTMB_PO_TOKEN remain optional overrides,
 * a BgUtils minter keeps the PO token fresh automatically, and all calls are
 * serialized through the same rate limiter so live tests respect the same
 * spacing as the deployed server. Run the suite with `--parallel=1` so files
 * do not interleave bursts.
 */
export const sharedSource: YouTubeSource = new RateLimitedSource(
  new InnerTubeSource({
    ...(liveConfig.visitorData !== null && { visitorData: liveConfig.visitorData }),
    ...(liveConfig.cookie !== null && { cookie: liveConfig.cookie }),
    ...(liveConfig.poToken !== null && { poToken: liveConfig.poToken }),
    ...(liveConfig.poToken === null && { minter: new BgUtilsTokenMinter() }),
    pageIntervalMs: liveConfig.ytMinIntervalMs,
  }),
  liveConfig.ytMinIntervalMs,
);

export const makeApp = (source: YouTubeSource = sharedSource) => {
  const store = new MbidStore(':memory:');
  const app = createApp({
    // Like production, cache upstream responses so repeated lookups inside a
    // test do not re-hit YouTube.
    source: new CachingSource(source, new TtlCache(3600_000)),
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
