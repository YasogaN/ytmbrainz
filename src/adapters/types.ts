/**
 * Normalized YouTube Music shapes. The rest of the app only ever sees these
 * types, never youtube.js classes.
 */

export interface YtArtist {
  id: string | null;
  name: string;
}

export interface YtAlbumRef {
  id: string | null;
  name: string;
  artists: YtArtist[];
  year: string | null;
}

export interface YtTrack {
  id: string | null;
  title: string;
  artists: YtArtist[];
  album: YtAlbumRef | null;
  durationSeconds: number | null;
  year: string | null;
}

export interface YtImage {
  url: string;
  width: number;
  height: number;
}

export interface YtAlbum {
  id: string | null;
  name: string;
  artists: YtArtist[];
  year: string | null;
  description: string | null;
  tracks: YtTrack[];
  artwork: YtImage[];
}

export interface YtArtistPage {
  id: string | null;
  name: string;
  albums: YtAlbumRef[];
  singles: YtAlbumRef[];
  topTracks: YtTrack[];
}
