import type { YtArtist } from '@/adapters/types';
import type { ArtistCredit } from '@/core/entities';
import { toMbid } from '@/core/mbid';

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
