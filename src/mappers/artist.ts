import type { YtArtist, YtArtistPage } from '@/adapters/types';
import type { Artist } from '@/core/entities';
import { type MbidStore, toMbid } from '@/core/mbid';

type ArtistSource = Pick<YtArtist, 'id' | 'name'> | Pick<YtArtistPage, 'id' | 'name'>;

export function mapArtist(artist: ArtistSource, score: number | null = null): Artist {
  return {
    entity: 'artist',
    id: toMbid('artist', artist.id ?? ''),
    name: artist.name,
    sortName: artist.name,
    type: null,
    country: null,
    disambiguation: null,
    ended: false,
    score,
  };
}

export function registerArtist(store: MbidStore, artist: ArtistSource): void {
  if (artist.id !== null) {
    store.register('artist', artist.id);
  }
}
