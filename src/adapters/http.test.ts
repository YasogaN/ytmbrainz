import { describe, expect, it } from 'bun:test';
import { browserFetch, createBrowserFetch } from '@/adapters/http';

describe('createBrowserFetch', () => {
  it('returns a working impit-backed fetch when the binding loads', async () => {
    const fetchFn = createBrowserFetch({
      createImpit: () => ({ fetch: async () => new Response('ok') }),
    });

    expect(typeof fetchFn).toBe('function');
    const response = await fetchFn('https://example.com');
    expect(response.ok).toBe(true);
  });

  it('falls back to native fetch when impit fails to construct', () => {
    const fetchFn = createBrowserFetch({
      createImpit: () => {
        throw new Error('native binding unavailable');
      },
    });

    expect(fetchFn).toBe(fetch);
  });
});

describe('browserFetch', () => {
  it('caches a single instance across calls', () => {
    const first = browserFetch();
    const second = browserFetch();

    expect(first).toBe(second);
    expect(typeof first).toBe('function');
  });
});
