import type { YtAlbumRef, YtArtist, YtArtistPage } from '@/adapters/types';
import type { Artist, ReleaseGroupRef, ReleaseRef } from '@/core/entities';
import { type MbidStore, toMbid } from '@/core/mbid';
import { mapRecording } from '@/mappers/recording';

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

export interface ArtistPageOptions {
  includeRecordings?: boolean;
  includeReleases?: boolean;
  includeReleaseGroups?: boolean;
}

function releaseRefsOf(albums: YtAlbumRef[]): ReleaseRef[] {
  return albums
    .filter((album): album is YtAlbumRef & { id: string } => album.id !== null)
    .map(album => ({
      id: toMbid('release', album.id),
      title: album.name,
      date: album.year,
    }));
}

function releaseGroupsOf(albums: YtAlbumRef[]): ReleaseGroupRef[] {
  return albums
    .filter((album): album is YtAlbumRef & { id: string } => album.id !== null)
    .map(album => ({
      id: toMbid('release-group', album.id),
      primaryType: 'Album',
      secondaryTypes: [],
      title: album.name,
    }));
}

export function mapArtistPage(page: YtArtistPage, options: ArtistPageOptions = {}): Artist {
  const albums = [...page.albums, ...page.singles];
  return {
    ...mapArtist(page),
    ...(options.includeRecordings === true && {
      recordings: page.topTracks.map(mapRecording),
    }),
    ...(options.includeReleases === true && {
      releases: releaseRefsOf(albums),
    }),
    ...(options.includeReleaseGroups === true && {
      releaseGroups: releaseGroupsOf(albums),
    }),
  };
}

export function registerArtist(store: MbidStore, artist: ArtistSource): void {
  if (artist.id !== null) {
    store.register('artist', artist.id);
  }
}
