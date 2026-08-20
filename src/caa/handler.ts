import type { YouTubeSource } from '@/adapters/source';
import type { YtAlbum } from '@/adapters/types';
import { imageIdOf, selectArtwork } from '@/caa/artwork';
import { type CaaRoute, parseCoverArtPath } from '@/caa/router';
import { isValidMbid, type MbidStore, toMbid } from '@/core/mbid';

export interface CoverArtContext {
  source: YouTubeSource;
  store: MbidStore;
}

interface ResolvedAlbum {
  album: YtAlbum;
  sourceId: string;
}

const ALLOW = 'GET, HEAD, OPTIONS';

function plain(method: string, status: number, message: string): Response {
  return new Response(method === 'HEAD' ? null : message, {
    status,
    headers: { 'content-type': 'text/plain; charset=utf-8' },
  });
}

function redirect(location: string): Response {
  return new Response(null, { status: 307, headers: { location } });
}

function methodResponse(method: string, route: CaaRoute): Response | null {
  if (method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: { allow: ALLOW } });
  }
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response(null, { status: 405, headers: { allow: ALLOW } });
  }
  if (!isValidMbid(route.mbid)) {
    return plain(method, 400, 'Invalid mbid.');
  }
  return null;
}

async function resolveAlbum(
  context: CoverArtContext,
  route: CaaRoute,
  method: string,
): Promise<ResolvedAlbum | Response> {
  const key = context.store.lookup(route.mbid);
  if (key === null || key.entity !== route.entity) {
    return plain(method, 404, 'Not found.');
  }
  const album = await context.source.getAlbum(key.sourceId);
  if (album === null) {
    return plain(method, 404, 'Not found.');
  }
  return { album, sourceId: key.sourceId };
}

function indexBody(
  origin: string,
  route: { entity: 'release' | 'release-group'; mbid: string },
  albumId: string,
  imageId: string,
): string {
  const releaseMbid = route.entity === 'release' ? route.mbid : toMbid('release', albumId);
  const base = `${origin}/release/${releaseMbid}/${imageId}`;
  return JSON.stringify({
    images: [
      {
        types: ['Front'],
        front: true,
        back: false,
        comment: '',
        approved: true,
        id: imageId,
        image: `${base}.jpg`,
        thumbnails: {
          '250': `${base}-250.jpg`,
          '500': `${base}-500.jpg`,
          '1200': `${base}-1200.jpg`,
          small: `${base}-250.jpg`,
          large: `${base}-500.jpg`,
        },
      },
    ],
    release: `${origin}/release/${releaseMbid}`,
  });
}

function artworkResponse(
  method: string,
  origin: string,
  route: CaaRoute,
  resolved: ResolvedAlbum,
): Response {
  const albumId = resolved.album.id ?? resolved.sourceId;
  if (route.variant === 'index') {
    if (resolved.album.artwork.length === 0) {
      return plain(method, 404, 'Not found.');
    }
    const body = indexBody(origin, route, albumId, imageIdOf(albumId));
    return new Response(method === 'HEAD' ? null : body, {
      status: 200,
      headers: { 'content-type': 'application/json; charset=utf-8' },
    });
  }
  if (route.variant === 'image' && route.id !== imageIdOf(albumId)) {
    return plain(method, 404, 'Not found.');
  }
  const target = selectArtwork(resolved.album.artwork, route.size);
  if (target === null) {
    return plain(method, 404, 'Not found.');
  }
  return redirect(target);
}

/**
 * Serves Cover Art Archive compatible responses for the `/release/{mbid}` and
 * `/release-group/{mbid}` path families, backed by YouTube Music album art.
 * Returns null when the path is not a CAA request.
 */
export async function handleCoverArt(
  request: Request,
  url: URL,
  context: CoverArtContext,
): Promise<Response | null> {
  const route = parseCoverArtPath(url.pathname);
  if (route === null) {
    return null;
  }
  const method = request.method;
  const early = methodResponse(method, route);
  if (early !== null) {
    return early;
  }
  if (route.variant === 'back') {
    return plain(method, 404, 'Not found.');
  }
  const resolved = await resolveAlbum(context, route, method);
  if (resolved instanceof Response) {
    return resolved;
  }
  return artworkResponse(method, url.origin, route, resolved);
}
