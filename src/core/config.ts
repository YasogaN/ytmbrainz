export type Env = Record<string, string | undefined>;

export interface Config {
  host: string;
  port: number;
  cacheTtlSeconds: number;
  ytMinIntervalMs: number;
  ytMaxRetries: number;
  ytBackoffMs: number;
  httpRateLimit: number;
  visitorData: string | null;
  cookie: string | null;
  poToken: string | null;
  databasePath: string;
}

const DEFAULTS: Config = {
  host: '127.0.0.1',
  port: 3000,
  cacheTtlSeconds: 3600,
  ytMinIntervalMs: 1000,
  ytMaxRetries: 2,
  ytBackoffMs: 250,
  httpRateLimit: 10,
  visitorData: null,
  cookie: null,
  poToken: null,
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

function parseOptional(raw: string | undefined, fallback: string | null): string | null {
  if (raw === undefined) {
    return fallback;
  }
  return raw === '' ? null : raw;
}

export function loadConfig(env: Env = process.env): Config {
  return {
    host: env.YTMB_HOST ?? DEFAULTS.host,
    port: parsePort(env.YTMB_PORT ?? String(DEFAULTS.port)),
    cacheTtlSeconds: parsePositiveInt(env.YTMB_CACHE_TTL, DEFAULTS.cacheTtlSeconds),
    ytMinIntervalMs: parsePositiveInt(env.YTMB_YT_RATE_LIMIT_MS, DEFAULTS.ytMinIntervalMs),
    ytMaxRetries: parsePositiveInt(env.YTMB_YT_RETRIES, DEFAULTS.ytMaxRetries),
    ytBackoffMs: parsePositiveInt(env.YTMB_YT_BACKOFF_MS, DEFAULTS.ytBackoffMs),
    httpRateLimit: parsePositiveInt(env.YTMB_HTTP_RATE_LIMIT, DEFAULTS.httpRateLimit),
    visitorData: parseOptional(env.YTMB_VISITOR_DATA, DEFAULTS.visitorData),
    cookie: parseOptional(env.YTMB_COOKIE, DEFAULTS.cookie),
    poToken: parseOptional(env.YTMB_PO_TOKEN, DEFAULTS.poToken),
    databasePath: env.YTMB_DB_PATH ?? DEFAULTS.databasePath,
  };
}
