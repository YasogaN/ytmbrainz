import type { YtAlbum, YtAlbumRef, YtArtist } from '@/adapters/types';
import type { Medium, Release } from '@/core/entities';
import { type MbidStore, toMbid } from '@/core/mbid';
import { toArtistCredits } from '@/mappers/credit';
import { mapRecording } from '@/mappers/recording';
import { inferPrimaryType } from '@/mappers/type';

export function mapReleaseRef(album: YtAlbumRef, score: number | null = null): Release {
  return {
    entity: 'release',
    id: toMbid('release', album.id ?? ''),
    title: album.name,
    status: null,
    date: album.year,
    country: null,
    barcode: null,
    asin: null,
    artistCredits: toArtistCredits(album.artists),
    media: [],
    releaseGroup: {
      id: toMbid('release-group', album.id ?? ''),
      primaryType: 'Album',
      secondaryTypes: [],
      title: album.name,
    },
    score,
  };
}

export interface MapReleaseOptions {
  includeRecordings?: boolean;
}

export function mapRelease(album: YtAlbum, options: MapReleaseOptions = {}): Release {
  const media: Medium[] =
    album.tracks.length === 0
      ? []
      : [
          {
            id: toMbid('medium', `${album.id ?? ''}:1`),
            position: 1,
            format: 'Digital Media',
            trackCount: album.tracks.length,
            tracks: album.tracks.map((track, index) => ({
              id: toMbid('track', track.id ?? ''),
              number: String(index + 1),
              title: track.title,
              length: track.durationSeconds === null ? null : track.durationSeconds * 1000,
            })),
          },
        ];
  return {
    entity: 'release',
    id: toMbid('release', album.id ?? ''),
    title: album.name,
    status: null,
    date: album.year,
    country: null,
    barcode: null,
    asin: null,
    artistCredits: toArtistCredits(album.artists),
    media,
    releaseGroup: {
      id: toMbid('release-group', album.id ?? ''),
      primaryType: inferPrimaryType(album.tracks.length),
      secondaryTypes: [],
      title: album.name,
    },
    score: null,
    ...(options.includeRecordings === true && {
      recordings: album.tracks.map(mapRecording),
    }),
  };
}

export function registerRelease(
  store: MbidStore,
  album: { id: string | null; artists: YtArtist[] },
): void {
  if (album.id !== null) {
    store.register('release', album.id);
    store.register('release-group', album.id);
  }
  for (const artist of album.artists) {
    if (artist.id !== null) {
      store.register('artist', artist.id);
    }
  }
}
