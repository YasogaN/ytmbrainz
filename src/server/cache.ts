import type { YouTubeSource } from '@/adapters/source';
import type { YtAlbum, YtAlbumRef, YtArtist, YtArtistPage, YtTrack } from '@/adapters/types';

export class TtlCache {
  private readonly entries = new Map<string, { expiresAt: number; promise: Promise<unknown> }>();

  constructor(
    private readonly ttlMs: number,
    private readonly maxEntries = 1000,
  ) {}

  get size(): number {
    return this.entries.size;
  }

  get<T>(key: string, load: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const existing = this.entries.get(key);
    if (existing !== undefined && existing.expiresAt > now) {
      return existing.promise as Promise<T>;
    }
    if (this.entries.size >= this.maxEntries) {
      this.prune(now);
    }
    const promise = load();
    this.entries.set(key, { expiresAt: now + this.ttlMs, promise });
    promise.catch(() => {
      this.entries.delete(key);
    });
    return promise;
  }

  private prune(now: number): void {
    for (const [key, entry] of this.entries) {
      if (entry.expiresAt <= now) {
        this.entries.delete(key);
      }
    }
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

  searchSongs(query: string, limit?: number): Promise<YtTrack[]> {
    return this.cache.get(`searchSongs:${query}:${limit}`, () =>
      this.source.searchSongs(query, limit),
    );
  }

  searchAlbums(query: string, limit?: number): Promise<YtAlbumRef[]> {
    return this.cache.get(`searchAlbums:${query}:${limit}`, () =>
      this.source.searchAlbums(query, limit),
    );
  }

  searchArtists(query: string, limit?: number): Promise<YtArtist[]> {
    return this.cache.get(`searchArtists:${query}:${limit}`, () =>
      this.source.searchArtists(query, limit),
    );
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
