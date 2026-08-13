import { loadConfig } from '@/core/config';

const config = loadConfig();

console.log(`ytmbrainz listening on ${config.host}:${config.port}`);
