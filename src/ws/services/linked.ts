import { type EntityType, isValidMbid, type MbidStore } from '@/core/mbid';

export function resolveLinked(store: MbidStore, mbid: string, entity: EntityType): string | null {
  if (!isValidMbid(mbid)) {
    return null;
  }
  const key = store.lookup(mbid);
  return key !== null && key.entity === entity ? key.sourceId : null;
}
