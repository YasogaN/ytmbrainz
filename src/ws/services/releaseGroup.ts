import type { Entity } from '@/core/entities';
import { mapReleaseGroup, mapReleaseGroupRef, registerReleaseGroup } from '@/mappers/releaseGroup';
import { parseQuery } from '@/query/parser';
import { translateReleaseGroup } from '@/query/translate';
import type { EntityService, HandlerContext } from '@/ws/app';
import { badRequest } from '@/ws/errors';
import { RELEASE_GROUP_INC, validateInc } from '@/ws/inc';
import { parseInc } from '@/ws/params';

export const releaseGroupService: EntityService = {
  async search(context: HandlerContext, searchParams: URLSearchParams): Promise<Entity[]> {
    const query = searchParams.get('query');
    if (query === null) {
      throw badRequest('The query parameter is required.');
    }
    const translated = translateReleaseGroup(parseQuery(query));
    if (translated.searchText === '') {
      return [];
    }
    const albums = await context.source.searchAlbums(translated.searchText);
    const groups: Entity[] = [];
    for (const [index, album] of albums.entries()) {
      registerReleaseGroup(context.store, album);
      groups.push(mapReleaseGroupRef(album, Math.max(100 - index, 0)));
    }
    return groups.filter(translated.filter);
  },

  async lookup(
    context: HandlerContext,
    mbid: string,
    searchParams: URLSearchParams,
  ): Promise<Entity | null> {
    validateInc(parseInc(searchParams), RELEASE_GROUP_INC);
    const key = context.store.lookup(mbid);
    if (key === null || key.entity !== 'release-group') {
      return null;
    }
    const album = await context.source.getAlbum(key.sourceId);
    return album === null ? null : mapReleaseGroup(album);
  },
};
