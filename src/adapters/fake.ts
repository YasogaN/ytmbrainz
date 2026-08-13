import type { YouTubeSource } from '@/adapters/source';
import type { YtAlbum, YtAlbumRef, YtArtist, YtArtistPage, YtTrack } from '@/adapters/types';

function tokens(...parts: Array<string | null | undefined>): string[] {
  const words: string[] = [];
  for (const part of parts) {
    if (part === null || part === undefined) {
      continue;
    }
    for (const word of part.toLowerCase().split(/\s+/)) {
      if (word.length > 0) {
        words.push(word);
      }
    }
  }
  return words;
}

function matches(query: string, ...parts: Array<string | null | undefined>): boolean {
  const needle = tokens(query);
  const haystack = tokens(...parts);
  for (const term of needle) {
    let found = false;
    for (const part of haystack) {
      if (part.includes(term)) {
        found = true;
        break;
      }
    }
    if (!found) {
      return false;
    }
  }
  return true;
}

/**
 * In-memory source backed by seeded fixtures. Used by tests so route handlers
 * can be exercised without any network access.
 */
export class FakeSource implements YouTubeSource {
  private readonly tracks: Map<string, YtTrack>;
  private readonly albums: Map<string, YtAlbum>;
  private readonly albumRefs: Map<string, YtAlbumRef>;
  private readonly artists: Map<string, YtArtistPage>;

  constructor() {
    this.tracks = new Map();
    this.albums = new Map();
    this.albumRefs = new Map();
    this.artists = new Map();
  }

  seedTrack(track: YtTrack): this {
    this.tracks.set(track.id ?? crypto.randomUUID(), track);
    return this;
  }

  seedAlbum(album: YtAlbum): this {
    this.albums.set(album.id ?? crypto.randomUUID(), album);
    const ref: YtAlbumRef = {
      id: album.id,
      name: album.name,
      artists: album.artists,
      year: album.year,
    };
    this.albumRefs.set(album.id ?? '', ref);
    return this;
  }

  seedArtist(artist: YtArtistPage): this {
    this.artists.set(artist.id ?? crypto.randomUUID(), artist);
    return this;
  }

  async searchSongs(query: string): Promise<YtTrack[]> {
    const results: YtTrack[] = [];
    for (const track of this.tracks.values()) {
      const parts = [track.title, ...track.artists.map(artist => artist.name)];
      if (matches(query, ...parts)) {
        results.push(track);
      }
    }
    return results;
  }

  async searchAlbums(query: string): Promise<YtAlbumRef[]> {
    const results: YtAlbumRef[] = [];
    for (const album of this.albumRefs.values()) {
      const parts = [album.name, ...album.artists.map(artist => artist.name)];
      if (matches(query, ...parts)) {
        results.push(album);
      }
    }
    return results;
  }

  async searchArtists(query: string): Promise<YtArtist[]> {
    const results: YtArtist[] = [];
    for (const artist of this.artists.values()) {
      if (matches(query, artist.name)) {
        results.push({ id: artist.id, name: artist.name });
      }
    }
    return results;
  }

  async getAlbum(id: string): Promise<YtAlbum | null> {
    return this.albums.get(id) ?? null;
  }

  async getArtist(id: string): Promise<YtArtistPage | null> {
    return this.artists.get(id) ?? null;
  }

  async getSong(id: string): Promise<YtTrack | null> {
    return this.tracks.get(id) ?? null;
  }
}
