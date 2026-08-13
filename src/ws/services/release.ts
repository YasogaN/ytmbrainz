import type { Entity } from '@/core/entities';
import { mapRelease, mapReleaseRef, registerRelease } from '@/mappers/release';
import { parseQuery } from '@/query/parser';
import { translateRelease } from '@/query/translate';
import type { EntityService, HandlerContext } from '@/ws/app';
import { badRequest } from '@/ws/errors';
import { RELEASE_INC, validateInc } from '@/ws/inc';
import { parseInc } from '@/ws/params';

export const releaseService: EntityService = {
  async search(context: HandlerContext, searchParams: URLSearchParams): Promise<Entity[]> {
    const query = searchParams.get('query');
    if (query === null) {
      throw badRequest('The query parameter is required.');
    }
    const translated = translateRelease(parseQuery(query));
    if (translated.searchText === '') {
      return [];
    }
    const albums = await context.source.searchAlbums(translated.searchText);
    const releases: Entity[] = [];
    for (const [index, album] of albums.entries()) {
      registerRelease(context.store, album);
      releases.push(mapReleaseRef(album, Math.max(100 - index, 0)));
    }
    return releases.filter(translated.filter);
  },

  async lookup(
    context: HandlerContext,
    mbid: string,
    searchParams: URLSearchParams,
  ): Promise<Entity | null> {
    validateInc(parseInc(searchParams), RELEASE_INC);
    const key = context.store.lookup(mbid);
    if (key === null || key.entity !== 'release') {
      return null;
    }
    const album = await context.source.getAlbum(key.sourceId);
    return album === null ? null : mapRelease(album);
  },
};
