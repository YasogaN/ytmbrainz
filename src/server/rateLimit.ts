import type { YouTubeSource } from '@/adapters/source';
import type { YtAlbum, YtAlbumRef, YtArtist, YtArtistPage, YtTrack } from '@/adapters/types';

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Serializes calls to the underlying source so no two requests hit YouTube
 * closer than `minIntervalMs` apart. Calls are chained through a single queue,
 * so concurrent bursts are spaced out instead of all firing at once.
 */
export class RateLimitedSource implements YouTubeSource {
  private lastStartedAt = 0;
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly source: YouTubeSource,
    private readonly minIntervalMs: number,
  ) {}

  private call<T>(load: () => Promise<T>): Promise<T> {
    const run = this.queue.then(async () => {
      const wait = Math.max(0, this.lastStartedAt + this.minIntervalMs - Date.now());
      if (wait > 0) {
        await sleep(wait);
      }
      this.lastStartedAt = Date.now();
      return load();
    });
    this.queue = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
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
