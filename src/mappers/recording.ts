import type { YtArtist, YtTrack } from '@/adapters/types';
import type { ArtistCredit, Recording } from '@/core/entities';
import { type MbidStore, toMbid } from '@/core/mbid';

export function toArtistCredits(artists: YtArtist[]): ArtistCredit[] {
  const withIds = artists.filter(
    (artist): artist is YtArtist & { id: string } => artist.id !== null,
  );
  return withIds.map((artist, index, list) => ({
    name: artist.name,
    sortName: artist.name,
    artistId: toMbid('artist', artist.id),
    joinPhrase: index === list.length - 1 ? '' : index === list.length - 2 ? ' & ' : ', ',
  }));
}

export function mapRecording(track: YtTrack, score: number | null = null): Recording {
  return {
    entity: 'recording',
    id: toMbid('recording', track.id ?? ''),
    title: track.title,
    video: false,
    length: track.durationSeconds === null ? null : track.durationSeconds * 1000,
    firstReleaseDate: track.year,
    disambiguation: null,
    artistCredits: toArtistCredits(track.artists),
    releases:
      track.album === null || track.album.id === null
        ? []
        : [
            {
              id: toMbid('release', track.album.id),
              title: track.album.name,
              date: track.album.year,
            },
          ],
    score,
  };
}

export function registerRecording(store: MbidStore, track: YtTrack): void {
  if (track.id !== null) {
    store.register('recording', track.id);
  }
  for (const artist of track.artists) {
    if (artist.id !== null) {
      store.register('artist', artist.id);
    }
  }
  if (track.album?.id !== null && track.album?.id !== undefined) {
    store.register('release', track.album.id);
  }
}
