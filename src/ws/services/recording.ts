import type { Entity } from '@/core/entities';
import { mapRecording, registerRecording } from '@/mappers/recording';
import { parseQuery } from '@/query/parser';
import { translateRecording } from '@/query/translate';
import type { EntityService, HandlerContext } from '@/ws/app';
import { badRequest } from '@/ws/errors';
import { RECORDING_INC, validateInc } from '@/ws/inc';
import { parseInc } from '@/ws/params';
import { resolveLinked } from '@/ws/services/linked';

export const recordingService: EntityService = {
  async search(context: HandlerContext, searchParams: URLSearchParams): Promise<Entity[]> {
    const query = searchParams.get('query');
    if (query === null) {
      throw badRequest('The query parameter is required.');
    }
    const translated = translateRecording(parseQuery(query));
    if (translated.searchText === '') {
      return [];
    }
    const tracks = await context.source.searchSongs(translated.searchText);
    const recordings: Entity[] = [];
    for (const [index, track] of tracks.entries()) {
      registerRecording(context.store, track);
      recordings.push(mapRecording(track, Math.max(100 - index, 0)));
    }
    return recordings.filter(translated.filter);
  },

  async browse(context: HandlerContext, searchParams: URLSearchParams): Promise<Entity[]> {
    const artistMbid = searchParams.get('artist');
    if (artistMbid !== null) {
      const channelId = resolveLinked(context.store, artistMbid, 'artist');
      if (channelId === null) {
        return [];
      }
      const artist = await context.source.getArtist(channelId);
      if (artist === null) {
        return [];
      }
      const recordings: Entity[] = [];
      for (const track of artist.topTracks) {
        registerRecording(context.store, track);
        recordings.push(mapRecording(track));
      }
      return recordings;
    }
    const releaseMbid = searchParams.get('release');
    if (releaseMbid !== null) {
      const albumId = resolveLinked(context.store, releaseMbid, 'release');
      if (albumId === null) {
        return [];
      }
      const album = await context.source.getAlbum(albumId);
      if (album === null) {
        return [];
      }
      const recordings: Entity[] = [];
      for (const track of album.tracks) {
        registerRecording(context.store, track);
        recordings.push(mapRecording(track));
      }
      return recordings;
    }
    throw badRequest('Missing browse parameter.');
  },

  async lookup(
    context: HandlerContext,
    mbid: string,
    searchParams: URLSearchParams,
  ): Promise<Entity | null> {
    validateInc(parseInc(searchParams), RECORDING_INC);
    const key = context.store.lookup(mbid);
    if (key === null || key.entity !== 'recording') {
      return null;
    }
    const track = await context.source.getSong(key.sourceId);
    return track === null ? null : mapRecording(track);
  },
};
