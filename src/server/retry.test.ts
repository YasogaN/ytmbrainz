import { describe, expect, it, mock } from 'bun:test';
import { UpstreamError } from '@/adapters/errors';
import type { YouTubeSource } from '@/adapters/source';
import { RetryingSource } from '@/server/retry';

const options = { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 100 };

const source = (calls: number[], run: () => unknown) => {
  const inner = {
    searchSongs: mock(async () => {
      calls.push(1);
      return run();
    }),
    searchAlbums: mock(async () => []),
    searchArtists: mock(async () => []),
    getAlbum: mock(async () => null),
    getArtist: mock(async () => null),
    getSong: mock(async () => null),
  };
  return inner as unknown as YouTubeSource;
};

describe('RetryingSource', () => {
  it('retries transient failures and succeeds', async () => {
    const calls: number[] = [];
    let failures = 2;
    const wrapped = new RetryingSource(
      source(calls, () => {
        if (failures > 0) {
          failures -= 1;
          throw new UpstreamError('fetch failed', true);
        }
        return [];
      }),
      options,
    );

    await expect(wrapped.searchSongs('x')).resolves.toEqual([]);
    expect(calls).toHaveLength(3);
  });

  it('gives up after exhausting retries', async () => {
    const calls: number[] = [];
    const wrapped = new RetryingSource(
      source(calls, () => {
        throw new UpstreamError('fetch failed', true);
      }),
      options,
    );

    await expect(wrapped.searchSongs('x')).rejects.toThrow();
    expect(calls).toHaveLength(3);
  });

  it('does not retry non-retryable failures', async () => {
    const calls: number[] = [];
    const wrapped = new RetryingSource(
      source(calls, () => {
        throw new UpstreamError('not a bot', false);
      }),
      options,
    );

    await expect(wrapped.searchSongs('x')).rejects.toThrow();
    expect(calls).toHaveLength(1);
  });

  it('classifies raw errors and retries transient ones', async () => {
    const calls: number[] = [];
    let failures = 1;
    const wrapped = new RetryingSource(
      source(calls, () => {
        if (failures > 0) {
          failures -= 1;
          throw new TypeError('fetch failed');
        }
        return [];
      }),
      options,
    );

    await expect(wrapped.searchSongs('x')).resolves.toEqual([]);
    expect(calls).toHaveLength(2);
  });

  it('retries lookups too', async () => {
    const calls: number[] = [];
    let failures = 1;
    const inner = source(calls, () => null);
    inner.getSong = mock(async () => {
      calls.push(1);
      if (failures > 0) {
        failures -= 1;
        throw new UpstreamError('fetch failed', true);
      }
      return null;
    });
    const wrapped = new RetryingSource(inner, options);

    await expect(wrapped.getSong('x')).resolves.toBeNull();
    expect(calls).toHaveLength(2);
  });

  it('forwards every source method', async () => {
    const inner = source([], () => []);
    const wrapped = new RetryingSource(inner, options);

    await wrapped.searchSongs('x');
    await wrapped.searchAlbums('x');
    await wrapped.searchArtists('x');
    await wrapped.getAlbum('x');
    await wrapped.getArtist('x');
    await wrapped.getSong('x');

    expect(inner.searchAlbums).toHaveBeenCalledWith('x', undefined);
    expect(inner.searchArtists).toHaveBeenCalledWith('x', undefined);
    expect(inner.getAlbum).toHaveBeenCalledWith('x');
    expect(inner.getArtist).toHaveBeenCalledWith('x');
  });
});
