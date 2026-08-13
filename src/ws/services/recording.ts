import type { Entity } from '@/core/entities';
import { mapRecording, registerRecording } from '@/mappers/recording';
import { parseQuery } from '@/query/parser';
import { translateRecording } from '@/query/translate';
import type { EntityService, HandlerContext } from '@/ws/app';
import { badRequest } from '@/ws/errors';
import { parseInc } from '@/ws/params';

const RECORDING_INC = new Set(['artist-credits', 'releases', 'release-groups', 'isrcs']);

function validateInc(searchParams: URLSearchParams): void {
  for (const inc of parseInc(searchParams)) {
    if (!RECORDING_INC.has(inc)) {
      throw badRequest(`Invalid inc parameter: ${inc}.`);
    }
  }
}

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

  async lookup(
    context: HandlerContext,
    mbid: string,
    searchParams: URLSearchParams,
  ): Promise<Entity | null> {
    validateInc(searchParams);
    const key = context.store.lookup(mbid);
    if (key === null || key.entity !== 'recording') {
      return null;
    }
    const track = await context.source.getSong(key.sourceId);
    return track === null ? null : mapRecording(track);
  },
};
