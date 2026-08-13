import { classifyUpstreamError, UpstreamError } from '@/adapters/errors';
import type { YouTubeSource } from '@/adapters/source';
import type { YtAlbum, YtAlbumRef, YtArtist, YtArtistPage, YtTrack } from '@/adapters/types';

export interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isRetryable(error: unknown): boolean {
  if (error instanceof UpstreamError) {
    return error.retryable;
  }
  return classifyUpstreamError(error) === 'upstream';
}

function delayMs(attempt: number, options: RetryOptions): number {
  return Math.min(options.baseDelayMs * 2 ** attempt, options.maxDelayMs);
}

/**
 * Retries upstream calls with exponential backoff. Only transient failures
 * (network errors, 429, 5xx) are retried; bot walls and missing entities are
 * passed through immediately.
 */
export class RetryingSource implements YouTubeSource {
  constructor(
    private readonly source: YouTubeSource,
    private readonly options: RetryOptions,
  ) {}

  private async withRetry<T>(load: () => Promise<T>): Promise<T> {
    let attempt = 0;
    for (;;) {
      try {
        return await load();
      } catch (error) {
        if (!isRetryable(error) || attempt >= this.options.maxRetries) {
          throw error;
        }
        await sleep(delayMs(attempt, this.options));
        attempt += 1;
      }
    }
  }

  searchSongs(query: string, limit?: number): Promise<YtTrack[]> {
    return this.withRetry(() => this.source.searchSongs(query, limit));
  }

  searchAlbums(query: string, limit?: number): Promise<YtAlbumRef[]> {
    return this.withRetry(() => this.source.searchAlbums(query, limit));
  }

  searchArtists(query: string, limit?: number): Promise<YtArtist[]> {
    return this.withRetry(() => this.source.searchArtists(query, limit));
  }

  getAlbum(id: string): Promise<YtAlbum | null> {
    return this.withRetry(() => this.source.getAlbum(id));
  }

  getArtist(id: string): Promise<YtArtistPage | null> {
    return this.withRetry(() => this.source.getArtist(id));
  }

  getSong(id: string): Promise<YtTrack | null> {
    return this.withRetry(() => this.source.getSong(id));
  }
}
