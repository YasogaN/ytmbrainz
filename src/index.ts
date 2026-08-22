import { BgUtilsTokenMinter } from '@/adapters/bgutils';
import { InnerTubeSource } from '@/adapters/innertube';
import { loadConfig } from '@/core/config';
import { MbidStore } from '@/core/mbid';
import { PoTokenGenerator } from '@/core/potoken';
import { CachingSource, TtlCache } from '@/server/cache';
import { HttpRateLimiter } from '@/server/httpRateLimit';
import { RateLimitedSource } from '@/server/rateLimit';
import { RetryingSource } from '@/server/retry';
import { createApp } from '@/ws/app';
import { errorToResponse, serviceUnavailable } from '@/ws/errors';
import { artistService } from '@/ws/services/artist';
import { recordingService } from '@/ws/services/recording';
import { releaseService } from '@/ws/services/release';
import { releaseGroupService } from '@/ws/services/releaseGroup';
import { urlService } from '@/ws/services/url';

const config = loadConfig();

/**
 * When a static YTMB_PO_TOKEN is not configured but a visitor data is, mint
 * and refresh PO tokens automatically so the server never goes stale. Tokens
 * are bound to the visitor data, so this only works with an explicit
 * YTMB_VISITOR_DATA.
 */
const poTokenProvider =
  config.poToken !== null || config.visitorData === null
    ? undefined
    : (() => {
        const generator = new PoTokenGenerator(config.visitorData, {
          minter: new BgUtilsTokenMinter(),
        });
        return () => generator.getToken();
      })();

const source = new CachingSource(
  new RetryingSource(
    new RateLimitedSource(
      new InnerTubeSource({
        ...(config.visitorData !== null && { visitorData: config.visitorData }),
        ...(config.cookie !== null && { cookie: config.cookie }),
        ...(config.poToken !== null && { poToken: config.poToken }),
        ...(poTokenProvider !== undefined && { poTokenProvider }),
        pageIntervalMs: config.ytMinIntervalMs,
      }),
      config.ytMinIntervalMs,
    ),
    {
      maxRetries: config.ytMaxRetries,
      baseDelayMs: config.ytBackoffMs,
      maxDelayMs: config.ytBackoffMs * 8,
    },
  ),
  new TtlCache(config.cacheTtlSeconds * 1000),
);
const store = new MbidStore(config.databasePath);
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

const limiter = new HttpRateLimiter(config.httpRateLimit, 1000);

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: (request, server) => {
    const url = new URL(request.url);
    if (
      url.pathname !== '/health' &&
      !limiter.allow(server.requestIP(request)?.address ?? 'unknown')
    ) {
      return errorToResponse(serviceUnavailable('Rate limit exceeded.'), 'json');
    }
    return app(request);
  },
});

console.log(`ytmbrainz listening on http://${config.host}:${server.port}`);

process.on('SIGINT', () => {
  store.close();
  server.stop();
});
process.on('SIGTERM', () => {
  store.close();
  server.stop();
});
