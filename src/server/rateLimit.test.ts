import { describe, expect, it, mock } from 'bun:test';
import type { YouTubeSource } from '@/adapters/source';
import { RateLimitedSource } from '@/server/rateLimit';

const source = (calls: number[]) => {
  const inner = {
    searchSongs: mock(async () => {
      calls.push(Date.now());
      return [];
    }),
    searchAlbums: mock(async () => []),
    searchArtists: mock(async () => []),
    getAlbum: mock(async () => null),
    getArtist: mock(async () => null),
    getSong: mock(async () => null),
  };
  return inner as unknown as YouTubeSource;
};

describe('RateLimitedSource', () => {
  it('spaces out calls by the minimum interval', async () => {
    const calls: number[] = [];
    const wrapped = new RateLimitedSource(source(calls), 100);

    await wrapped.searchSongs('a');
    await wrapped.searchSongs('b');

    expect(calls).toHaveLength(2);
    expect((calls[1] ?? 0) - (calls[0] ?? 0)).toBeGreaterThanOrEqual(100);
  });

  it('allows calls without delay when the interval has passed', async () => {
    const calls: number[] = [];
    const wrapped = new RateLimitedSource(source(calls), 0);

    await wrapped.searchSongs('a');
    await wrapped.searchSongs('b');

    expect((calls[1] ?? 0) - (calls[0] ?? 0)).toBeLessThan(50);
  });

  it('limits every source method', async () => {
    const calls: number[] = [];
    const inner = source(calls);
    inner.getSong = mock(async () => {
      calls.push(Date.now());
      return null;
    });
    const wrapped = new RateLimitedSource(inner, 100);

    await wrapped.getSong('a');
    await wrapped.getSong('b');

    expect((calls[1] ?? 0) - (calls[0] ?? 0)).toBeGreaterThanOrEqual(100);
  });

  it('forwards every source method', async () => {
    const inner = source([]);
    const wrapped = new RateLimitedSource(inner, 0);

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
