import { describe, expect, it } from 'bun:test';
import { rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { isValidMbid, MbidStore, toMbid, uuidV5 } from '@/core/mbid';

describe('toMbid', () => {
  it('produces valid UUIDv5 MBIDs', () => {
    const mbid = toMbid('recording', 'dQw4w9WgXcQ');

    expect(isValidMbid(mbid)).toBe(true);
    expect(mbid[14]).toBe('5');
    expect(mbid[19]).toMatch(/[89ab]/);
  });

  it('is deterministic for the same entity and source id', () => {
    expect(toMbid('artist', 'UC123')).toBe(toMbid('artist', 'UC123'));
  });

  it('differs across entities and source ids', () => {
    expect(toMbid('artist', 'UC123')).not.toBe(toMbid('recording', 'UC123'));
    expect(toMbid('artist', 'UC123')).not.toBe(toMbid('artist', 'UC124'));
  });
});

describe('uuidV5', () => {
  it('rejects a malformed namespace', () => {
    expect(() => uuidV5('not-a-uuid', 'name')).toThrow(RangeError);
  });
});

describe('MbidStore', () => {
  it('round-trips an entity through register and lookup', () => {
    const store = new MbidStore(':memory:');
    try {
      const mbid = store.register('release', 'MPREb_abc123');
      const key = store.lookup(mbid);

      expect(key).toEqual({ entity: 'release', sourceId: 'MPREb_abc123' });
    } finally {
      store.close();
    }
  });

  it('returns null for an unknown mbid', () => {
    const store = new MbidStore(':memory:');
    try {
      expect(store.lookup('00000000-0000-4000-8000-000000000000')).toBeNull();
    } finally {
      store.close();
    }
  });

  it('returns null for a malformed mbid', () => {
    const store = new MbidStore(':memory:');
    try {
      expect(store.lookup('garbage')).toBeNull();
    } finally {
      store.close();
    }
  });

  it('keeps mappings across instances backed by the same file', () => {
    const path = `${tmpdir()}/ytmbrainz-mbid-store-test-${process.pid}.db`;
    const first = new MbidStore(path);
    const mbid = first.register('url', 'https://youtu.be/dQw4w9WgXcQ');
    first.close();

    try {
      const second = new MbidStore(path);
      expect(second.lookup(mbid)).toEqual({
        entity: 'url',
        sourceId: 'https://youtu.be/dQw4w9WgXcQ',
      });
      second.close();
    } finally {
      rmSync(`${path}-wal`, { force: true });
      rmSync(`${path}-shm`, { force: true });
      rmSync(path, { force: true });
    }
  });
});
