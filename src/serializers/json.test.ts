import { describe, expect, it } from 'bun:test';
import type { Artist, Recording, Release, ReleaseGroup, Url } from '@/core/entities';
import { entityToJson, lookupToJson, searchToJson } from '@/serializers/json';

const recording: Recording = {
  entity: 'recording',
  id: 'rec-mbid',
  title: 'Roygbiv',
  video: false,
  length: 148000,
  firstReleaseDate: '1998',
  disambiguation: null,
  artistCredits: [
    {
      name: 'Boards of Canada',
      sortName: 'Boards of Canada',
      artistId: 'artist-mbid',
      joinPhrase: ' & ',
    },
  ],
  releases: [{ id: 'rel-mbid', title: 'Music Has the Right to Children', date: '1998' }],
  score: 100,
};

const artist: Artist = {
  entity: 'artist',
  id: 'artist-mbid',
  name: 'Boards of Canada',
  sortName: 'Boards of Canada',
  type: null,
  country: null,
  disambiguation: null,
  ended: false,
  score: null,
};

const release: Release = {
  entity: 'release',
  id: 'rel-mbid',
  title: 'Music Has the Right to Children',
  status: null,
  date: '1998',
  country: null,
  barcode: null,
  asin: null,
  artistCredits: [
    {
      name: 'Boards of Canada',
      sortName: 'Boards of Canada',
      artistId: 'artist-mbid',
      joinPhrase: '',
    },
  ],
  media: [
    {
      id: 'med-mbid',
      position: 1,
      format: 'Digital Media',
      trackCount: 1,
      tracks: [
        { id: 'track-mbid', number: '1', title: 'Roygbiv', length: 148000 },
        { id: 'track-mbid-2', number: '2', title: 'Turquoise Hexagon Sun', length: 125000 },
      ],
    },
  ],
  releaseGroup: {
    id: 'rg-mbid',
    primaryType: 'Album',
    secondaryTypes: [],
    title: 'Music Has the Right to Children',
  },
  score: null,
};

const releaseGroup: ReleaseGroup = {
  entity: 'release-group',
  id: 'rg-mbid',
  title: 'Music Has the Right to Children',
  primaryType: 'Album',
  secondaryTypes: ['Compilation'],
  firstReleaseDate: '1998',
  disambiguation: null,
  artistCredits: [
    {
      name: 'Boards of Canada',
      sortName: 'Boards of Canada',
      artistId: 'artist-mbid',
      joinPhrase: '',
    },
  ],
  releases: [{ id: 'rel-mbid', title: 'Music Has the Right to Children', date: '1998' }],
  score: 60,
};

const url: Url = {
  entity: 'url',
  id: 'url-mbid',
  resource: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  score: null,
};

describe('entityToJson', () => {
  it('serializes a recording', () => {
    expect(entityToJson(recording)).toEqual({
      id: 'rec-mbid',
      score: 100,
      title: 'Roygbiv',
      length: 148000,
      'artist-credit': [
        {
          name: 'Boards of Canada',
          artist: { id: 'artist-mbid', name: 'Boards of Canada', 'sort-name': 'Boards of Canada' },
          joinphrase: ' & ',
        },
      ],
      'first-release-date': '1998',
      releases: [{ id: 'rel-mbid', title: 'Music Has the Right to Children', date: '1998' }],
    });
  });

  it('omits unknown fields from a recording', () => {
    const sparse: Recording = {
      entity: 'recording',
      id: 'rec-mbid',
      title: 'Untitled',
      video: false,
      length: null,
      firstReleaseDate: null,
      disambiguation: null,
      artistCredits: [],
      releases: [],
      score: null,
    };

    expect(entityToJson(sparse)).toEqual({
      id: 'rec-mbid',
      title: 'Untitled',
      'artist-credit': [],
    });
  });

  it('marks video recordings', () => {
    expect(entityToJson({ ...recording, video: true }).video).toBe(true);
  });

  it('serializes an artist', () => {
    expect(entityToJson(artist)).toEqual({
      id: 'artist-mbid',
      name: 'Boards of Canada',
      'sort-name': 'Boards of Canada',
      'life-span': { ended: false },
    });
  });

  it('serializes a release with media and release group', () => {
    expect(entityToJson(release)).toEqual({
      id: 'rel-mbid',
      title: 'Music Has the Right to Children',
      date: '1998',
      'release-events': [{ date: '1998', area: null }],
      'artist-credit': [
        {
          name: 'Boards of Canada',
          artist: { id: 'artist-mbid', name: 'Boards of Canada', 'sort-name': 'Boards of Canada' },
        },
      ],
      media: [
        {
          id: 'med-mbid',
          position: 1,
          format: 'Digital Media',
          track: [
            { id: 'track-mbid', number: '1', title: 'Roygbiv', length: 148000 },
            { id: 'track-mbid-2', number: '2', title: 'Turquoise Hexagon Sun', length: 125000 },
          ],
          'track-count': 1,
          'track-offset': 0,
        },
      ],
      'release-group': {
        id: 'rg-mbid',
        'primary-type': 'Album',
        'secondary-types': [],
        title: 'Music Has the Right to Children',
      },
    });
  });

  it('serializes a release group', () => {
    expect(entityToJson(releaseGroup)).toEqual({
      id: 'rg-mbid',
      score: 60,
      title: 'Music Has the Right to Children',
      'primary-type': 'Album',
      'secondary-types': ['Compilation'],
      'first-release-date': '1998',
      'artist-credit': [
        {
          name: 'Boards of Canada',
          artist: { id: 'artist-mbid', name: 'Boards of Canada', 'sort-name': 'Boards of Canada' },
        },
      ],
      releases: [{ id: 'rel-mbid', title: 'Music Has the Right to Children', date: '1998' }],
    });
  });

  it('serializes a url', () => {
    expect(entityToJson(url)).toEqual({
      id: 'url-mbid',
      resource: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    });
  });
});

describe('searchToJson and lookupToJson', () => {
  it('wraps search results with count and offset', () => {
    expect(searchToJson('2026-08-13T20:00:00.000Z', 'recordings', [recording], 0)).toEqual({
      created: '2026-08-13T20:00:00.000Z',
      count: 1,
      offset: 0,
      recordings: [entityToJson(recording)],
    });
  });

  it('accepts a total count distinct from the returned items', () => {
    expect(
      searchToJson('2026-08-13T20:00:00.000Z', 'recordings', [recording], 10, 120),
    ).toMatchObject({ count: 120, offset: 10 });
  });

  it('wraps a lookup without a list key', () => {
    expect(lookupToJson('2026-08-13T20:00:00.000Z', artist)).toEqual({
      created: '2026-08-13T20:00:00.000Z',
      ...entityToJson(artist),
    });
  });
});
