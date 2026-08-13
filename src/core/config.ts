export type Env = Record<string, string | undefined>;

export interface Config {
  host: string;
  port: number;
  cacheTtlSeconds: number;
  ytMinIntervalMs: number;
  databasePath: string;
}

const DEFAULTS: Config = {
  host: '127.0.0.1',
  port: 3000,
  cacheTtlSeconds: 3600,
  ytMinIntervalMs: 1000,
  databasePath: './data/ytmbrainz.db',
};

function parsePort(raw: string): number {
  const port = Number.parseInt(raw, 10);
  if (Number.isNaN(port) || port < 1 || port > 65535) {
    throw new RangeError(`Invalid port: ${raw}`);
  }
  return port;
}

function parsePositiveInt(raw: string | undefined, fallback: number): number {
  if (raw === undefined) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value) || value < 0) {
    throw new RangeError(`Invalid value: ${raw}`);
  }
  return value;
}

export function loadConfig(env: Env = process.env): Config {
  return {
    host: env.YTMB_HOST ?? DEFAULTS.host,
    port: parsePort(env.YTMB_PORT ?? String(DEFAULTS.port)),
    cacheTtlSeconds: parsePositiveInt(env.YTMB_CACHE_TTL, DEFAULTS.cacheTtlSeconds),
    ytMinIntervalMs: parsePositiveInt(env.YTMB_YT_RATE_LIMIT_MS, DEFAULTS.ytMinIntervalMs),
    databasePath: env.YTMB_DB_PATH ?? DEFAULTS.databasePath,
  };
}
