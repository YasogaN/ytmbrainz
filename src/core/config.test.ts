import { describe, expect, it } from 'bun:test';
import { loadConfig } from '@/core/config';

describe('loadConfig', () => {
  it('returns defaults when no env overrides are set', () => {
    const config = loadConfig({});

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3000);
    expect(config.cacheTtlSeconds).toBe(3600);
    expect(config.ytMinIntervalMs).toBe(1000);
    expect(config.databasePath).toBe('./data/ytmbrainz.db');
  });

  it('reads every supported override from the environment', () => {
    const config = loadConfig({
      YTMB_HOST: '0.0.0.0',
      YTMB_PORT: '8080',
      YTMB_CACHE_TTL: '60',
      YTMB_YT_RATE_LIMIT_MS: '500',
      YTMB_DB_PATH: '/tmp/ytmb.db',
    });

    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8080);
    expect(config.cacheTtlSeconds).toBe(60);
    expect(config.ytMinIntervalMs).toBe(500);
    expect(config.databasePath).toBe('/tmp/ytmb.db');
  });

  it('accepts a zero cache TTL', () => {
    expect(loadConfig({ YTMB_CACHE_TTL: '0' }).cacheTtlSeconds).toBe(0);
  });

  it('rejects an out-of-range port', () => {
    expect(() => loadConfig({ YTMB_PORT: '70000' })).toThrow(RangeError);
  });

  it('rejects a non-numeric port', () => {
    expect(() => loadConfig({ YTMB_PORT: 'abc' })).toThrow(RangeError);
  });

  it('rejects a non-numeric cache TTL', () => {
    expect(() => loadConfig({ YTMB_CACHE_TTL: 'soon' })).toThrow(RangeError);
  });
});
