import type { Entity, Url } from '@/core/entities';
import { isValidMbid } from '@/core/mbid';
import { mapArtist } from '@/mappers/artist';
import { mapRecording } from '@/mappers/recording';
import { mapRelease } from '@/mappers/release';
import { extractUrl, mapUrl, parseResource, type ResourceTarget, registerUrl } from '@/mappers/url';
import type { EntityService, HandlerContext } from '@/ws/app';
import { badRequest } from '@/ws/errors';
import { URL_INC, validateInc } from '@/ws/inc';
import { parseInc } from '@/ws/params';

async function fetchTarget(
  context: HandlerContext,
  target: ResourceTarget,
): Promise<Entity | null> {
  if (target.entity === 'recording') {
    const track = await context.source.getSong(target.sourceId);
    return track === null ? null : mapRecording(track);
  }
  if (target.entity === 'artist') {
    const artist = await context.source.getArtist(target.sourceId);
    return artist === null ? null : mapArtist(artist);
  }
  const album = await context.source.getAlbum(target.sourceId);
  return album === null ? null : mapRelease(album);
}

async function resolveUrl(context: HandlerContext, resource: string): Promise<Url | null> {
  const target = parseResource(resource);
  if (target === null) {
    return null;
  }
  const entity = await fetchTarget(context, target);
  if (entity === null) {
    return null;
  }
  registerUrl(context.store, resource);
  return mapUrl(resource, entity);
}

function resolveResource(context: HandlerContext, id: string): string | null {
  if (!isValidMbid(id)) {
    return id;
  }
  const key = context.store.lookup(id);
  return key !== null && key.entity === 'url' ? key.sourceId : null;
}

export const urlService: EntityService = {
  async search(context: HandlerContext, searchParams: URLSearchParams): Promise<Entity[]> {
    const query = searchParams.get('query');
    if (query === null) {
      throw badRequest('The query parameter is required.');
    }
    const resource = extractUrl(query);
    if (resource === null) {
      return [];
    }
    const url = await resolveUrl(context, resource);
    return url === null ? [] : [url];
  },

  async lookup(
    context: HandlerContext,
    id: string,
    searchParams: URLSearchParams,
  ): Promise<Entity | null> {
    validateInc(parseInc(searchParams), URL_INC);
    const resource = resolveResource(context, id);
    if (resource === null) {
      return null;
    }
    return resolveUrl(context, resource);
  },
};
