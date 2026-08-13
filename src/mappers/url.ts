import type { Entity, Url } from '@/core/entities';
import { type MbidStore, toMbid } from '@/core/mbid';

export type ResourceTarget =
  | { entity: 'recording'; sourceId: string }
  | { entity: 'artist'; sourceId: string }
  | { entity: 'release'; sourceId: string };

const URL_PATTERN = /https?:\/\/[^\s"']+/;

export function parseResource(resource: string): ResourceTarget | null {
  let url: URL;
  try {
    url = new URL(resource);
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '').replace(/^music\./, '');
  if (host === 'youtu.be') {
    const videoId = url.pathname.replace(/^\//, '');
    return videoId === '' ? null : { entity: 'recording', sourceId: videoId };
  }
  if (host !== 'youtube.com') {
    return null;
  }
  const parts = url.pathname.split('/').filter(part => part !== '');
  const first = parts[0];
  const second = parts[1];
  if (first === 'watch') {
    const videoId = url.searchParams.get('v');
    return videoId === null ? null : { entity: 'recording', sourceId: videoId };
  }
  if (first === 'channel' && second !== undefined && second.startsWith('UC')) {
    return { entity: 'artist', sourceId: second };
  }
  if (first === 'album' && second !== undefined && second.startsWith('MPREb_')) {
    return { entity: 'release', sourceId: second };
  }
  return null;
}

export function extractUrl(query: string): string | null {
  return URL_PATTERN.exec(query)?.[0] ?? null;
}

export function mapUrl(resource: string, target: Entity): Url {
  return {
    entity: 'url',
    id: toMbid('url', resource),
    resource,
    relations: [
      {
        type: target.entity,
        target: target.id,
        direction: 'backward',
        entity: target,
      },
    ],
    score: null,
  };
}

export function registerUrl(store: MbidStore, resource: string): void {
  store.register('url', resource);
}
