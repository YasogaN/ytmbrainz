import { InnerTubeSource } from '@/adapters/innertube';
import { loadConfig } from '@/core/config';
import { MbidStore } from '@/core/mbid';
import { createApp } from '@/ws/app';
import { artistService } from '@/ws/services/artist';
import { recordingService } from '@/ws/services/recording';
import { releaseService } from '@/ws/services/release';
import { releaseGroupService } from '@/ws/services/releaseGroup';
import { urlService } from '@/ws/services/url';

const config = loadConfig();

const source = new InnerTubeSource();
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

const server = Bun.serve({
  hostname: config.host,
  port: config.port,
  fetch: app,
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
