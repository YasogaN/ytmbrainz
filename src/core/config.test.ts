import { describe, expect, it } from 'bun:test';
import { loadConfig } from '@/core/config';

describe('loadConfig', () => {
  it('returns defaults when no env overrides are set', () => {
    const config = loadConfig({});

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(3000);
    expect(config.cacheTtlSeconds).toBe(3600);
    expect(config.ytMinIntervalMs).toBe(1000);
    expect(config.ytMaxRetries).toBe(2);
    expect(config.ytBackoffMs).toBe(250);
    expect(config.httpRateLimit).toBe(10);
    expect(config.visitorData).toBeNull();
    expect(config.cookie).toBeNull();
    expect(config.poToken).toBeNull();
    expect(config.databasePath).toBe('./data/ytmbrainz.db');
  });

  it('reads every supported override from the environment', () => {
    const config = loadConfig({
      YTMB_HOST: '0.0.0.0',
      YTMB_PORT: '8080',
      YTMB_CACHE_TTL: '60',
      YTMB_YT_RATE_LIMIT_MS: '500',
      YTMB_YT_RETRIES: '3',
      YTMB_YT_BACKOFF_MS: '100',
      YTMB_HTTP_RATE_LIMIT: '0',
      YTMB_VISITOR_DATA: 'visitor123',
      YTMB_COOKIE: 'SID=abc',
      YTMB_PO_TOKEN: 'potok',
      YTMB_DB_PATH: '/tmp/ytmb.db',
    });

    expect(config.host).toBe('0.0.0.0');
    expect(config.port).toBe(8080);
    expect(config.cacheTtlSeconds).toBe(60);
    expect(config.ytMinIntervalMs).toBe(500);
    expect(config.ytMaxRetries).toBe(3);
    expect(config.ytBackoffMs).toBe(100);
    expect(config.httpRateLimit).toBe(0);
    expect(config.visitorData).toBe('visitor123');
    expect(config.cookie).toBe('SID=abc');
    expect(config.poToken).toBe('potok');
    expect(config.databasePath).toBe('/tmp/ytmb.db');
  });

  it('treats empty secrets as unset', () => {
    const config = loadConfig({
      YTMB_VISITOR_DATA: '',
      YTMB_COOKIE: '',
      YTMB_PO_TOKEN: '',
    });

    expect(config.visitorData).toBeNull();
    expect(config.cookie).toBeNull();
    expect(config.poToken).toBeNull();
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
