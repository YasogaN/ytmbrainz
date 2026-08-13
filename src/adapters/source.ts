import type { YtAlbum, YtAlbumRef, YtArtist, YtArtistPage, YtTrack } from '@/adapters/types';

/**
 * The data-source boundary. Route handlers depend on this interface, never on
 * youtube.js directly, so they can be tested against a fake.
 */
export interface YouTubeSource {
  searchSongs(query: string, limit?: number): Promise<YtTrack[]>;
  searchAlbums(query: string, limit?: number): Promise<YtAlbumRef[]>;
  searchArtists(query: string, limit?: number): Promise<YtArtist[]>;
  getAlbum(id: string): Promise<YtAlbum | null>;
  getArtist(id: string): Promise<YtArtistPage | null>;
  getSong(id: string): Promise<YtTrack | null>;
}
