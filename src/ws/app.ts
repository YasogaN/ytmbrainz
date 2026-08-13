import type { YouTubeSource } from '@/adapters/source';
import type { Entity } from '@/core/entities';
import { isValidMbid, type MbidStore } from '@/core/mbid';
import { lookupToJson, searchToJson } from '@/serializers/json';
import { listToXml, lookupToXml } from '@/serializers/xml';
import {
  badRequest,
  errorToResponse,
  notFound,
  notImplemented,
  serviceUnavailable,
  WsError,
} from '@/ws/errors';
import { type ResponseFormat, resolveFormat } from '@/ws/format';
import { parseLimit, parseOffset } from '@/ws/params';
import { parsePath, type WsEntityType } from '@/ws/router';

export interface HandlerContext {
  source: YouTubeSource;
  store: MbidStore;
  format: ResponseFormat;
}

export interface EntityService {
  search(context: HandlerContext, searchParams: URLSearchParams): Promise<Entity[]>;
  lookup(
    context: HandlerContext,
    mbid: string,
    searchParams: URLSearchParams,
  ): Promise<Entity | null>;
}

export interface AppOptions {
  source: YouTubeSource;
  store: MbidStore;
  services?: Partial<Record<WsEntityType, EntityService>>;
}

interface RequestContext extends HandlerContext {
  services: Partial<Record<WsEntityType, EntityService>>;
}

const JSON_LIST_KEYS: Record<WsEntityType, string> = {
  artist: 'artists',
  recording: 'recordings',
  release: 'releases',
  'release-group': 'release-groups',
  url: 'urls',
};

const XML_LIST_NAMES: Record<WsEntityType, string> = {
  artist: 'artist-list',
  recording: 'recording-list',
  release: 'release-list',
  'release-group': 'release-group-list',
  url: 'url-list',
};

function respondEntity(context: RequestContext, entity: Entity): Response {
  const created = new Date().toISOString();
  const body =
    context.format === 'json'
      ? JSON.stringify(lookupToJson(created, entity))
      : lookupToXml(created, entity);
  return new Response(body, {
    headers: {
      'content-type':
        context.format === 'json'
          ? 'application/json; charset=utf-8'
          : 'application/xml; charset=utf-8',
    },
  });
}

export function createApp(options: AppOptions): (request: Request) => Promise<Response> {
  const { source, store, services = {} } = options;
  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    const format = resolveFormat(url.searchParams.get('fmt'), request.headers.get('accept'));
    const context: RequestContext = { source, store, format, services };
    try {
      return await handle(request, url, context);
    } catch (error) {
      if (error instanceof WsError) {
        return errorToResponse(error, format);
      }
      console.error(error);
      return errorToResponse(serviceUnavailable(), format);
    }
  };
}

async function handle(request: Request, url: URL, context: RequestContext): Promise<Response> {
  if (request.method !== 'GET') {
    return errorToResponse(new WsError(405, 'Method Not Allowed'), context.format);
  }
  const route = parsePath(url.pathname);
  if (route === null) {
    return errorToResponse(notFound('Unknown path.'), context.format);
  }
  const service = context.services[route.entity];
  if (service === undefined) {
    return errorToResponse(notImplemented(), context.format);
  }
  const searchParams = url.searchParams;
  if (route.mbid !== null) {
    if (!isValidMbid(route.mbid)) {
      return errorToResponse(badRequest('Invalid mbid.'), context.format);
    }
    const entity = await service.lookup(context, route.mbid, searchParams);
    if (entity === null) {
      return errorToResponse(
        notFound(`Could not find the ${route.entity} with MBID ${route.mbid}.`),
        context.format,
      );
    }
    return respondEntity(context, entity);
  }
  if (route.entity === 'url' && searchParams.get('resource') !== null) {
    const resource = searchParams.get('resource') ?? '';
    const entity = await service.lookup(context, resource, searchParams);
    if (entity === null) {
      return errorToResponse(notFound('Could not find the url.'), context.format);
    }
    return respondEntity(context, entity);
  }
  const page = {
    limit: parseLimit(searchParams.get('limit')),
    offset: parseOffset(searchParams.get('offset')),
  };
  const all = await service.search(context, searchParams);
  const items = all.slice(page.offset, page.offset + page.limit);
  return respondList(context, route.entity, items, all.length, page.offset);
}

function respondList(
  context: RequestContext,
  entity: WsEntityType,
  items: Entity[],
  count: number,
  offset: number,
): Response {
  const created = new Date().toISOString();
  const body =
    context.format === 'json'
      ? JSON.stringify(searchToJson(created, JSON_LIST_KEYS[entity], items, offset, count))
      : listToXml(created, XML_LIST_NAMES[entity], items, offset, count);
  return new Response(body, {
    headers: {
      'content-type':
        context.format === 'json'
          ? 'application/json; charset=utf-8'
          : 'application/xml; charset=utf-8',
    },
  });
}
