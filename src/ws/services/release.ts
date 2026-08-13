import type { Entity } from '@/core/entities';
import { mapRelease, mapReleaseRef, registerRelease } from '@/mappers/release';
import { parseQuery } from '@/query/parser';
import { translateRelease } from '@/query/translate';
import type { EntityService, HandlerContext } from '@/ws/app';
import { badRequest } from '@/ws/errors';
import { RELEASE_INC, validateInc } from '@/ws/inc';
import { fetchLimit, parseInc, parseLimit, parseOffset } from '@/ws/params';
import { resolveLinked } from '@/ws/services/linked';

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
    const albums = await context.source.searchAlbums(
      translated.searchText,
      fetchLimit(parseLimit(searchParams.get('limit')), parseOffset(searchParams.get('offset'))),
    );
    const releases: Entity[] = [];
    for (const [index, album] of albums.entries()) {
      registerRelease(context.store, album);
      releases.push(mapReleaseRef(album, Math.max(100 - index, 0)));
    }
    return releases.filter(translated.filter);
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
      const albums = [...artist.albums, ...artist.singles];
      const releases: Entity[] = [];
      for (const album of albums) {
        registerRelease(context.store, album);
        releases.push(mapReleaseRef(album));
      }
      return releases;
    }
    const releaseGroupMbid = searchParams.get('release-group');
    if (releaseGroupMbid !== null) {
      const albumId = resolveLinked(context.store, releaseGroupMbid, 'release-group');
      if (albumId === null) {
        return [];
      }
      const album = await context.source.getAlbum(albumId);
      return album === null ? [] : [mapRelease(album)];
    }
    throw badRequest('Missing browse parameter.');
  },

  async lookup(
    context: HandlerContext,
    mbid: string,
    searchParams: URLSearchParams,
  ): Promise<Entity | null> {
    const inc = parseInc(searchParams);
    validateInc(inc, RELEASE_INC);
    const key = context.store.lookup(mbid);
    if (key === null || key.entity !== 'release') {
      return null;
    }
    const album = await context.source.getAlbum(key.sourceId);
    return album === null
      ? null
      : mapRelease(album, { includeRecordings: inc.includes('recordings') });
  },
};
