import type { YtAlbum, YtAlbumRef } from '@/adapters/types';
import type { ReleaseGroup } from '@/core/entities';
import { type MbidStore, toMbid } from '@/core/mbid';
import { toArtistCredits } from '@/mappers/credit';
import { inferPrimaryType } from '@/mappers/type';

function releaseRef(album: { id: string | null; name: string; year: string | null }) {
  return album.id === null
    ? []
    : [{ id: toMbid('release', album.id), title: album.name, date: album.year }];
}

export function mapReleaseGroupRef(album: YtAlbumRef, score: number | null = null): ReleaseGroup {
  return {
    entity: 'release-group',
    id: toMbid('release-group', album.id ?? ''),
    title: album.name,
    primaryType: 'Album',
    secondaryTypes: [],
    firstReleaseDate: album.year,
    disambiguation: null,
    artistCredits: toArtistCredits(album.artists),
    releases: releaseRef(album),
    score,
  };
}

export function mapReleaseGroup(album: YtAlbum): ReleaseGroup {
  return {
    entity: 'release-group',
    id: toMbid('release-group', album.id ?? ''),
    title: album.name,
    primaryType: inferPrimaryType(album.tracks.length),
    secondaryTypes: [],
    firstReleaseDate: album.year,
    disambiguation: null,
    artistCredits: toArtistCredits(album.artists),
    releases: releaseRef(album),
    score: null,
  };
}

export function registerReleaseGroup(
  store: MbidStore,
  album: { id: string | null; artists: { id: string | null; name: string }[] },
): void {
  if (album.id !== null) {
    store.register('release-group', album.id);
    store.register('release', album.id);
  }
  for (const artist of album.artists) {
    if (artist.id !== null) {
      store.register('artist', artist.id);
    }
  }
}
