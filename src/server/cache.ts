import type { YouTubeSource } from '@/adapters/source';
import type { YtAlbum, YtAlbumRef, YtArtist, YtArtistPage, YtTrack } from '@/adapters/types';

export class TtlCache {
  private readonly entries = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

  constructor(private readonly ttlMs: number) {}

  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const existing = this.entries.get(key);
    if (existing !== undefined && existing.expiresAt > Date.now()) {
      return existing.promise as Promise<T>;
    }
    const promise = load();
    this.entries.set(key, { expiresAt: Date.now() + this.ttlMs, promise });
    promise.catch(() => {
      this.entries.delete(key);
    });
    return promise;
  }

  clear(): void {
    this.entries.clear();
  }
}

/**
 * Caches and coalesces source calls: identical concurrent requests share a
 * single in-flight promise, and results are reused within the TTL.
 */
export class CachingSource implements YouTubeSource {
  constructor(
    private readonly source: YouTubeSource,
    private readonly cache: TtlCache,
  ) {}

  searchSongs(query: string): Promise<YtTrack[]> {
    return this.cache.get(`searchSongs:${query}`, () => this.source.searchSongs(query));
  }

  searchAlbums(query: string): Promise<YtAlbumRef[]> {
    return this.cache.get(`searchAlbums:${query}`, () => this.source.searchAlbums(query));
  }

  searchArtists(query: string): Promise<YtArtist[]> {
    return this.cache.get(`searchArtists:${query}`, () => this.source.searchArtists(query));
  }

  getAlbum(id: string): Promise<YtAlbum | null> {
    return this.cache.get(`getAlbum:${id}`, () => this.source.getAlbum(id));
  }

  getArtist(id: string): Promise<YtArtistPage | null> {
    return this.cache.get(`getArtist:${id}`, () => this.source.getArtist(id));
  }

  getSong(id: string): Promise<YtTrack | null> {
    return this.cache.get(`getSong:${id}`, () => this.source.getSong(id));
  }
}
