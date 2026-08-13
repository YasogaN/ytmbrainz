import { describe, expect, it, mock } from 'bun:test';
import type { YouTubeSource } from '@/adapters/source';
import { CachingSource, TtlCache } from '@/server/cache';

const source = (calls: number[]) => {
  const inner = {
    searchSongs: mock(async (query: string) => {
      calls.push(1);
      return [
        { id: query, title: 'Song', artists: [], album: null, durationSeconds: 1, year: null },
      ];
    }),
    searchAlbums: mock(async () => []),
    searchArtists: mock(async () => []),
    getAlbum: mock(async () => null),
    getArtist: mock(async () => null),
    getSong: mock(async () => null),
  };
  return inner as unknown as YouTubeSource;
};

describe('TtlCache', () => {
  it('caches results within the ttl', async () => {
    const calls: number[] = [];
    const cache = new TtlCache(60_000);
    const wrapped = new CachingSource(source(calls), cache);

    await wrapped.searchSongs('roygbiv');
    await wrapped.searchSongs('roygbiv');

    expect(calls).toHaveLength(1);
  });

  it('coalesces concurrent requests into one call', async () => {
    const calls: number[] = [];
    const cache = new TtlCache(60_000);
    const wrapped = new CachingSource(source(calls), cache);

    await Promise.all([
      wrapped.searchSongs('roygbiv'),
      wrapped.searchSongs('roygbiv'),
      wrapped.searchSongs('roygbiv'),
    ]);

    expect(calls).toHaveLength(1);
  });

  it('refetches after the ttl expires', async () => {
    const calls: number[] = [];
    const cache = new TtlCache(0);
    const wrapped = new CachingSource(source(calls), cache);

    await wrapped.searchSongs('roygbiv');
    await wrapped.searchSongs('roygbiv');

    expect(calls).toHaveLength(2);
  });

  it('does not cache failures', async () => {
    const calls: number[] = [];
    const cache = new TtlCache(60_000);
    const inner = source(calls);
    inner.searchSongs = mock(async () => {
      calls.push(1);
      throw new Error('boom');
    });
    const wrapped = new CachingSource(inner, cache);

    await expect(wrapped.searchSongs('x')).rejects.toThrow('boom');
    await expect(wrapped.searchSongs('x')).rejects.toThrow('boom');

    expect(calls).toHaveLength(2);
  });

  it('clears all entries', async () => {
    const calls: number[] = [];
    const cache = new TtlCache(60_000);
    const wrapped = new CachingSource(source(calls), cache);

    await wrapped.searchSongs('roygbiv');
    cache.clear();
    await wrapped.searchSongs('roygbiv');

    expect(calls).toHaveLength(2);
  });

  it('forwards every source method through the cache', async () => {
    const calls: number[] = [];
    const cache = new TtlCache(60_000);
    const inner = source(calls);
    const wrapped = new CachingSource(inner, cache);

    await wrapped.searchAlbums('x');
    await wrapped.searchArtists('x');
    await wrapped.getAlbum('x');
    await wrapped.getArtist('x');
    await wrapped.getSong('x');

    expect(inner.searchAlbums).toHaveBeenCalledWith('x');
    expect(inner.searchArtists).toHaveBeenCalledWith('x');
    expect(inner.getAlbum).toHaveBeenCalledWith('x');
    expect(inner.getArtist).toHaveBeenCalledWith('x');
    expect(inner.getSong).toHaveBeenCalledWith('x');
  });
});
