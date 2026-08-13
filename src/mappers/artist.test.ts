import { describe, expect, it } from 'bun:test';
import type { YtArtistPage } from '@/adapters/types';
import { MbidStore, toMbid } from '@/core/mbid';
import { mapArtist, mapArtistPage, registerArtist } from '@/mappers/artist';

const page: YtArtistPage = {
  id: 'UC-artist',
  name: 'Boards of Canada',
  albums: [
    {
      id: 'MPREb_1',
      name: 'Music Has the Right to Children',
      artists: [],
      year: '1998',
    },
  ],
  singles: [
    {
      id: 'MPREb_2',
      name: 'A Beautiful Place Out in the Country',
      artists: [],
      year: '2000',
    },
  ],
  topTracks: [
    {
      id: 'video-1',
      title: 'Roygbiv',
      artists: [],
      album: null,
      durationSeconds: 148,
      year: '1998',
    },
  ],
};

describe('mapArtist', () => {
  it('maps a search result to an artist', () => {
    const artist = mapArtist({ id: 'UC-artist', name: 'Boards of Canada' }, 80);

    expect(artist.id).toBe(toMbid('artist', 'UC-artist'));
    expect(artist.sortName).toBe('Boards of Canada');
    expect(artist.score).toBe(80);
    expect(artist.ended).toBe(false);
  });
});

describe('mapArtistPage', () => {
  it('maps a page without subqueries', () => {
    const artist = mapArtistPage(page);

    expect(artist.name).toBe('Boards of Canada');
    expect(artist.recordings).toBeUndefined();
    expect(artist.releases).toBeUndefined();
    expect(artist.releaseGroups).toBeUndefined();
  });

  it('includes requested subqueries', () => {
    const artist = mapArtistPage(page, {
      includeRecordings: true,
      includeReleases: true,
      includeReleaseGroups: true,
    });

    expect(artist.recordings).toHaveLength(1);
    expect(artist.recordings?.[0]?.title).toBe('Roygbiv');
    expect(artist.releases).toEqual([
      {
        id: toMbid('release', 'MPREb_1'),
        title: 'Music Has the Right to Children',
        date: '1998',
      },
      {
        id: toMbid('release', 'MPREb_2'),
        title: 'A Beautiful Place Out in the Country',
        date: '2000',
      },
    ]);
    expect(artist.releaseGroups).toHaveLength(2);
    expect(artist.releaseGroups?.[0]?.id).toBe(toMbid('release-group', 'MPREb_1'));
  });
});

describe('registerArtist', () => {
  it('registers the channel id', () => {
    const store = new MbidStore(':memory:');
    try {
      registerArtist(store, { id: 'UC-artist', name: 'Boards of Canada' });

      expect(store.lookup(toMbid('artist', 'UC-artist'))).toEqual({
        entity: 'artist',
        sourceId: 'UC-artist',
      });
    } finally {
      store.close();
    }
  });
});
