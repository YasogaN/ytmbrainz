import { Database } from 'bun:sqlite';
import { createHash } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export type EntityType =
  | 'artist'
  | 'recording'
  | 'release'
  | 'release-group'
  | 'url'
  | 'track'
  | 'medium'
  | 'image';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ROOT_NAMESPACE = '8f9c2f2d-b08c-4a0e-9e3a-2f4c6a8b9d0e';

export function isValidMbid(value: string): boolean {
  return UUID_PATTERN.test(value);
}

export function parseUuid(uuid: string): Uint8Array {
  if (!isValidMbid(uuid)) {
    throw new RangeError(`Invalid UUID: ${uuid}`);
  }
  const hex = uuid.replaceAll('-', '');
  const bytes = new Uint8Array(16);
  for (let i = 0; i < 16; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

export function uuidV5(namespace: string, name: string): string {
  const hash = createHash('sha1');
  hash.update(parseUuid(namespace));
  hash.update(name, 'utf8');
  const bytes = new Uint8Array(hash.digest().subarray(0, 16));
  bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x50;
  bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const ENTITY_NAMESPACES: Record<EntityType, string> = {
  artist: uuidV5(ROOT_NAMESPACE, 'ytmbrainz.artist'),
  recording: uuidV5(ROOT_NAMESPACE, 'ytmbrainz.recording'),
  release: uuidV5(ROOT_NAMESPACE, 'ytmbrainz.release'),
  'release-group': uuidV5(ROOT_NAMESPACE, 'ytmbrainz.release-group'),
  url: uuidV5(ROOT_NAMESPACE, 'ytmbrainz.url'),
  track: uuidV5(ROOT_NAMESPACE, 'ytmbrainz.track'),
  medium: uuidV5(ROOT_NAMESPACE, 'ytmbrainz.medium'),
  image: uuidV5(ROOT_NAMESPACE, 'ytmbrainz.image'),
};

export function toMbid(entity: EntityType, sourceId: string): string {
  return uuidV5(ENTITY_NAMESPACES[entity], sourceId);
}

export interface EntityKey {
  entity: EntityType;
  sourceId: string;
}

/**
 * Persistent, bidirectional MBID <-> YouTube ID mapping.
 *
 * MBIDs are deterministic (UUID v5), but not invertible, so the store records
 * every mapping we hand out. It is persisted to disk so lookups keep working
 * across restarts.
 */
export class MbidStore {
  private readonly db: Database;

  constructor(path: string) {
    if (path !== ':memory:') {
      mkdirSync(dirname(path), { recursive: true });
    }
    this.db = new Database(path);
    this.db.run(`
      CREATE TABLE IF NOT EXISTS idmap (
        mbid TEXT PRIMARY KEY,
        entity TEXT NOT NULL,
        source_id TEXT NOT NULL
      )
    `);
    this.db.run('CREATE INDEX IF NOT EXISTS idmap_source ON idmap (entity, source_id)');
  }

  register(entity: EntityType, sourceId: string): string {
    const mbid = toMbid(entity, sourceId);
    this.db.run('INSERT OR IGNORE INTO idmap (mbid, entity, source_id) VALUES (?, ?, ?)', [
      mbid,
      entity,
      sourceId,
    ]);
    return mbid;
  }

  lookup(mbid: string): EntityKey | null {
    const row = this.db.query('SELECT entity, source_id FROM idmap WHERE mbid = ?').get(mbid) as {
      entity: EntityType;
      source_id: string;
    } | null;
    if (row === null) {
      return null;
    }
    return { entity: row.entity, sourceId: row.source_id };
  }

  close(): void {
    this.db.close();
  }
}
