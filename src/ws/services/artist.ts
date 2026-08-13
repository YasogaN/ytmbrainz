import type { Entity } from '@/core/entities';
import { mapArtist, registerArtist } from '@/mappers/artist';
import { parseQuery } from '@/query/parser';
import { translateArtist } from '@/query/translate';
import type { EntityService, HandlerContext } from '@/ws/app';
import { badRequest } from '@/ws/errors';
import { ARTIST_INC, validateInc } from '@/ws/inc';
import { fetchLimit, parseInc, parseLimit, parseOffset } from '@/ws/params';

export const artistService: EntityService = {
  async search(context: HandlerContext, searchParams: URLSearchParams): Promise<Entity[]> {
    const query = searchParams.get('query');
    if (query === null) {
      throw badRequest('The query parameter is required.');
    }
    const translated = translateArtist(parseQuery(query));
    if (translated.searchText === '') {
      return [];
    }
    const artists = await context.source.searchArtists(
      translated.searchText,
      fetchLimit(parseLimit(searchParams.get('limit')), parseOffset(searchParams.get('offset'))),
    );
    const entities: Entity[] = [];
    for (const [index, artist] of artists.entries()) {
      registerArtist(context.store, artist);
      entities.push(mapArtist(artist, Math.max(100 - index, 0)));
    }
    return entities.filter(translated.filter);
  },

  async lookup(
    context: HandlerContext,
    mbid: string,
    searchParams: URLSearchParams,
  ): Promise<Entity | null> {
    validateInc(parseInc(searchParams), ARTIST_INC);
    const key = context.store.lookup(mbid);
    if (key === null || key.entity !== 'artist') {
      return null;
    }
    const artist = await context.source.getArtist(key.sourceId);
    return artist === null ? null : mapArtist(artist);
  },
};
