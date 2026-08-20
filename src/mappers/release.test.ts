import { describe, expect, it } from 'bun:test';
import type { YtAlbum, YtAlbumRef } from '@/adapters/types';
import { MbidStore, toMbid } from '@/core/mbid';
import { mapRelease, mapReleaseRef, registerRelease } from '@/mappers/release';

const albumRef: YtAlbumRef = {
  id: 'MPREb_1',
  name: 'Music Has the Right to Children',
  artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
  year: '1998',
};

const album: YtAlbum = {
  ...albumRef,
  description: null,
  artwork: [],
  tracks: [
    {
      id: 'video-1',
      title: 'Roygbiv',
      artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
      album: null,
      durationSeconds: 148,
      year: '1998',
    },
    {
      id: 'video-2',
      title: 'Turquoise Hexagon Sun',
      artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
      album: null,
      durationSeconds: 240,
      year: '1998',
    },
  ],
};

describe('mapReleaseRef', () => {
  it('maps an album reference to a release without media', () => {
    const release = mapReleaseRef(albumRef, 90);

    expect(release.id).toBe(toMbid('release', 'MPREb_1'));
    expect(release.media).toEqual([]);
    expect(release.releaseGroup?.primaryType).toBe('Album');
    expect(release.score).toBe(90);
  });
});

describe('mapRelease', () => {
  it('maps an album to a release with media', () => {
    const release = mapRelease(album);

    expect(release.media[0]?.position).toBe(1);
    expect(release.media[0]?.trackCount).toBe(2);
    expect(release.media[0]?.tracks[1]).toMatchObject({
      number: '2',
      title: 'Turquoise Hexagon Sun',
      length: 240000,
    });
    expect(release.recordings).toBeUndefined();
  });

  it('includes recordings when requested', () => {
    const release = mapRelease(album, { includeRecordings: true });

    expect(release.recordings).toHaveLength(2);
    expect(release.recordings?.[0]).toMatchObject({
      title: 'Roygbiv',
      length: 148000,
      id: toMbid('recording', 'video-1'),
    });
  });
});

describe('registerRelease', () => {
  it('registers the release and its artists', () => {
    const store = new MbidStore(':memory:');
    try {
      registerRelease(store, albumRef);

      expect(store.lookup(toMbid('release', 'MPREb_1'))).toEqual({
        entity: 'release',
        sourceId: 'MPREb_1',
      });
      expect(store.lookup(toMbid('artist', 'UC-artist'))).toEqual({
        entity: 'artist',
        sourceId: 'UC-artist',
      });
    } finally {
      store.close();
    }
  });
});
