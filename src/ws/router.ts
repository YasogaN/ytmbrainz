export type WsEntityType = 'artist' | 'recording' | 'release' | 'release-group' | 'url';

const ENTITY_TYPES: readonly WsEntityType[] = [
  'artist',
  'recording',
  'release',
  'release-group',
  'url',
];

export interface Route {
  entity: WsEntityType;
  mbid: string | null;
}

export function parsePath(pathname: string): Route | null {
  const segments = pathname.split('/').filter(segment => segment !== '');
  if (segments.length < 3 || segments[0] !== 'ws' || segments[1] !== '2') {
    return null;
  }
  const entity = segments[2] as string;
  if (!(ENTITY_TYPES as readonly string[]).includes(entity)) {
    return null;
  }
  if (segments.length > 4) {
    return null;
  }
  return { entity: entity as WsEntityType, mbid: segments[3] ?? null };
}
