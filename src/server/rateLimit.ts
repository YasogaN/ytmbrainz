import type { YouTubeSource } from '@/adapters/source';
import type { YtAlbum, YtAlbumRef, YtArtist, YtArtistPage, YtTrack } from '@/adapters/types';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Serializes calls to the underlying source so no two requests hit YouTube
 * closer than `minIntervalMs` apart.
 */
export class RateLimitedSource implements YouTubeSource {
  private nextAllowed = 0;

  constructor(
    private readonly source: YouTubeSource,
    private readonly minIntervalMs: number,
  ) {}

  private async call<T>(load: () => Promise<T>): Promise<T> {
    const wait = Math.max(0, this.nextAllowed - Date.now());
    if (wait > 0) {
      await sleep(wait);
    }
    this.nextAllowed = Date.now() + this.minIntervalMs;
    return load();
  }

  searchSongs(query: string, limit?: number): Promise<YtTrack[]> {
    return this.call(() => this.source.searchSongs(query, limit));
  }

  searchAlbums(query: string, limit?: number): Promise<YtAlbumRef[]> {
    return this.call(() => this.source.searchAlbums(query, limit));
  }

  searchArtists(query: string, limit?: number): Promise<YtArtist[]> {
    return this.call(() => this.source.searchArtists(query, limit));
  }

  getAlbum(id: string): Promise<YtAlbum | null> {
    return this.call(() => this.source.getAlbum(id));
  }

  getArtist(id: string): Promise<YtArtistPage | null> {
    return this.call(() => this.source.getArtist(id));
  }

  getSong(id: string): Promise<YtTrack | null> {
    return this.call(() => this.source.getSong(id));
  }
}
