import type { YouTubeSource } from '@/adapters/source';
import type { YtAlbum, YtAlbumRef, YtArtist, YtArtistPage, YtTrack } from '@/adapters/types';

function tokens(...parts: Array<string | null | undefined>): string[] {
  return parts
    .filter((part): part is string => part !== null && part !== undefined)
    .join(' ')
    .toLowerCase()
    .split(/\s+/)
    .filter(token => token.length > 0);
}

function matches(query: string, ...parts: Array<string | null | undefined>): boolean {
  const needle = tokens(query);
  const haystack = tokens(...parts);
  return needle.every(term => haystack.some(part => part.includes(term)));
}

function artistsMatch(query: string, artists: YtArtist[]): boolean {
  return matches(query, ...artists.map(artist => artist.name));
}

/**
 * In-memory source backed by seeded fixtures. Used by tests so route handlers
 * can be exercised without any network access.
 */
export class FakeSource implements YouTubeSource {
  private readonly tracks = new Map<string, YtTrack>();
  private readonly albums = new Map<string, YtAlbum>();
  private readonly albumRefs = new Map<string, YtAlbumRef>();
  private readonly artists = new Map<string, YtArtistPage>();

  seedTrack(track: YtTrack): this {
    this.tracks.set(track.id ?? crypto.randomUUID(), track);
    return this;
  }

  seedAlbum(album: YtAlbum): this {
    this.albums.set(album.id ?? crypto.randomUUID(), album);
    this.albumRefs.set(album.id ?? '', album);
    return this;
  }

  seedArtist(artist: YtArtistPage): this {
    this.artists.set(artist.id ?? crypto.randomUUID(), artist);
    return this;
  }

  async searchSongs(query: string): Promise<YtTrack[]> {
    return [...this.tracks.values()].filter(
      track => matches(query, track.title) || artistsMatch(query, track.artists),
    );
  }

  async searchAlbums(query: string): Promise<YtAlbumRef[]> {
    return [...this.albumRefs.values()].filter(
      album => matches(query, album.name) || artistsMatch(query, album.artists),
    );
  }

  async searchArtists(query: string): Promise<YtArtist[]> {
    return [...this.artists.values()]
      .filter(artist => matches(query, artist.name))
      .map(artist => ({ id: artist.id, name: artist.name }));
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
