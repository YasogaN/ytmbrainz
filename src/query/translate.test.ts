import { describe, expect, it } from 'bun:test';
import type { Recording } from '@/core/entities';
import { parseQuery } from '@/query/parser';
import {
  translateArtist,
  translateRecording,
  translateRelease,
  translateReleaseGroup,
} from '@/query/translate';

const recording: Recording = {
  entity: 'recording',
  id: 'rec-1',
  title: 'Roygbiv',
  video: false,
  length: 148000,
  firstReleaseDate: '1998',
  disambiguation: null,
  artistCredits: [
    {
      name: 'Boards of Canada',
      sortName: 'Boards of Canada',
      artistId: 'artist-1',
      joinPhrase: '',
    },
  ],
  releases: [{ id: 'rel-1', title: 'Music Has the Right to Children', date: '1998' }],
  score: null,
};

describe('translateRecording', () => {
  it('builds search text from text fields', () => {
    const query = parseQuery('recording:"Roygbiv" AND artist:"Boards of Canada"');
    const translated = translateRecording(query);

    expect(translated.searchText).toBe('Roygbiv Boards of Canada');
  });

  it('builds search text from default-field terms', () => {
    const translated = translateRecording(parseQuery('roygbiv boards'));

    expect(translated.searchText).toBe('roygbiv boards');
  });

  it('filters by duration range', () => {
    const translated = translateRecording(parseQuery('dur:[120000 TO 200000]'));

    expect(translated.searchText).toBe('');
    expect(translated.filter(recording)).toBe(true);
    expect(translated.filter({ ...recording, length: 90000 })).toBe(false);
    expect(translated.filter({ ...recording, length: null })).toBe(false);
  });

  it('filters by exact duration', () => {
    const translated = translateRecording(parseQuery('dur:148000'));

    expect(translated.filter(recording)).toBe(true);
    expect(translated.filter({ ...recording, length: 148001 })).toBe(false);
  });

  it('filters by open-ended duration range', () => {
    const from = translateRecording(parseQuery('dur:[148000 TO *]'));
    expect(from.filter({ ...recording, length: 148000 })).toBe(true);
    expect(from.filter({ ...recording, length: 1000 })).toBe(false);

    const to = translateRecording(parseQuery('dur:[* TO 148000]'));
    expect(to.filter(recording)).toBe(true);
    expect(to.filter({ ...recording, length: 200000 })).toBe(false);
  });

  it('ignores an unbounded duration range', () => {
    const translated = translateRecording(parseQuery('dur:[abc TO def]'));

    expect(translated.filter(recording)).toBe(true);
    expect(translated.filter({ ...recording, length: null })).toBe(false);
  });

  it('filters by artist mbid', () => {
    const translated = translateRecording(parseQuery('arid:artist-1'));

    expect(translated.filter(recording)).toBe(true);
    expect(translated.filter({ ...recording, artistCredits: [] })).toBe(false);
  });

  it('filters by release mbid', () => {
    const translated = translateRecording(parseQuery('reid:rel-1'));

    expect(translated.filter(recording)).toBe(true);
    expect(translated.filter({ ...recording, releases: [] })).toBe(false);
  });

  it('ignores an invalid duration value', () => {
    const translated = translateRecording(parseQuery('dur:abc'));

    expect(translated.filter(recording)).toBe(true);
  });

  it('matches either side of an OR filter query', () => {
    const translated = translateRecording(parseQuery('arid:artist-1 OR arid:artist-2'));

    expect(translated.filter(recording)).toBe(true);
    expect(
      translated.filter({
        ...recording,
        artistCredits: [
          { name: 'Autechre', sortName: 'Autechre', artistId: 'artist-2', joinPhrase: '' },
        ],
      }),
    ).toBe(true);
    expect(translated.filter({ ...recording, artistCredits: [] })).toBe(false);
  });

  it('matches either side of an OR text query', () => {
    const translated = translateRecording(
      parseQuery('recording:"Roygbiv" OR recording:"Autechre"'),
    );

    expect(translated.searchText).toBe('Roygbiv Autechre');
    expect(translated.filter(recording)).toBe(true);
    expect(translated.filter({ ...recording, title: 'Autechre' })).toBe(true);
    expect(translated.filter({ ...recording, title: 'Neither' })).toBe(false);
  });

  it('excludes negated filter terms', () => {
    const translated = translateRecording(parseQuery('-arid:artist-2'));

    expect(translated.filter(recording)).toBe(true);
    expect(
      translated.filter({
        ...recording,
        artistCredits: [
          { name: 'Autechre', sortName: 'Autechre', artistId: 'artist-2', joinPhrase: '' },
        ],
      }),
    ).toBe(false);
  });

  it('filters by video flag', () => {
    const wantVideo = translateRecording(parseQuery('video:true'));
    expect(wantVideo.filter(recording)).toBe(false);
    expect(wantVideo.filter({ ...recording, video: true })).toBe(true);
  });

  it('excludes negated text terms', () => {
    const translated = translateRecording(parseQuery('recording:"Roygbiv" -artist:"Autechre"'));

    expect(translated.filter(recording)).toBe(true);
    expect(
      translated.filter({
        ...recording,
        artistCredits: [
          { name: 'Autechre', sortName: 'Autechre', artistId: 'artist-2', joinPhrase: '' },
        ],
      }),
    ).toBe(false);
  });

  it('ignores unsupported filter fields', () => {
    const translated = translateRecording(parseQuery('isrc:US-ABC'));

    expect(translated.filter(recording)).toBe(true);
  });
});

describe('translateArtist', () => {
  const artist = {
    entity: 'artist' as const,
    id: 'artist-1',
    name: 'Boards of Canada',
    sortName: 'Boards of Canada',
    type: null,
    country: null,
    disambiguation: null,
    ended: false,
    score: null,
  };

  it('builds search text from the artist name', () => {
    expect(translateArtist(parseQuery('artist:"Boards of Canada"')).searchText).toBe(
      'Boards of Canada',
    );
  });

  it('filters by arid', () => {
    const translated = translateArtist(parseQuery('arid:artist-1'));
    expect(translated.filter(artist)).toBe(true);
    expect(translated.filter({ ...artist, id: 'other' })).toBe(false);
  });

  it('filters by ended', () => {
    const translated = translateArtist(parseQuery('ended:true'));
    expect(translated.filter(artist)).toBe(false);
    expect(translated.filter({ ...artist, ended: true })).toBe(true);
  });

  it('excludes negated text terms', () => {
    const translated = translateArtist(parseQuery('-artist:"Autechre"'));

    expect(translated.filter(artist)).toBe(true);
    expect(translated.filter({ ...artist, name: 'Autechre' })).toBe(false);
  });
});

describe('translateRelease', () => {
  const medium = { id: 'med-1', position: 1, format: 'Digital Media', trackCount: 1, tracks: [] };

  const release = {
    entity: 'release' as const,
    id: 'rel-1',
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
        artistId: 'artist-1',
        joinPhrase: '',
      },
    ],
    media: [medium],
    releaseGroup: {
      id: 'rg-1',
      primaryType: 'Album',
      secondaryTypes: ['Compilation'],
      title: 'Music Has the Right to Children',
    },
    score: null,
  };

  it('builds search text from release and artist', () => {
    expect(translateRelease(parseQuery('release:"Music Has the Right"')).searchText).toBe(
      'Music Has the Right',
    );
  });

  it('filters by primary type', () => {
    const translated = translateRelease(parseQuery('primarytype:album'));
    expect(translated.filter(release)).toBe(true);
    expect(
      translated.filter({
        ...release,
        releaseGroup: { ...release.releaseGroup, primaryType: 'Single' },
      }),
    ).toBe(false);
  });

  it('filters by secondary type', () => {
    const translated = translateRelease(parseQuery('secondarytype:compilation'));
    expect(translated.filter(release)).toBe(true);
    expect(
      translated.filter({
        ...release,
        releaseGroup: { ...release.releaseGroup, secondaryTypes: [] },
      }),
    ).toBe(false);
  });

  it('filters by date prefix', () => {
    const translated = translateRelease(parseQuery('date:1998'));
    expect(translated.filter(release)).toBe(true);
    expect(translated.filter({ ...release, date: '2001' })).toBe(false);
  });

  it('filters by format', () => {
    const translated = translateRelease(parseQuery('format:"Digital Media"'));
    expect(translated.filter(release)).toBe(true);
    expect(translated.filter({ ...release, media: [{ ...medium, format: 'CD' }] })).toBe(false);
  });

  it('filters by release, artist, and release-group mbids', () => {
    expect(translateRelease(parseQuery('reid:rel-1')).filter(release)).toBe(true);
    expect(translateRelease(parseQuery('reid:nope')).filter(release)).toBe(false);

    expect(translateRelease(parseQuery('arid:artist-1')).filter(release)).toBe(true);
    expect(translateRelease(parseQuery('arid:nope')).filter(release)).toBe(false);

    expect(translateRelease(parseQuery('rgid:rg-1')).filter(release)).toBe(true);
    expect(translateRelease(parseQuery('rgid:nope')).filter(release)).toBe(false);
  });

  it('excludes negated text terms for releases', () => {
    const translated = translateRelease(
      parseQuery('release:"Music Has the Right" -artist:"Autechre"'),
    );

    expect(translated.filter(release)).toBe(true);
    expect(
      translated.filter({
        ...release,
        artistCredits: [
          { name: 'Autechre', sortName: 'Autechre', artistId: 'artist-2', joinPhrase: '' },
        ],
      }),
    ).toBe(false);
  });
});

describe('translateReleaseGroup', () => {
  const group = {
    entity: 'release-group' as const,
    id: 'rg-1',
    title: 'Music Has the Right to Children',
    primaryType: 'Album',
    secondaryTypes: ['Compilation'],
    firstReleaseDate: '1998',
    disambiguation: null,
    artistCredits: [
      {
        name: 'Boards of Canada',
        sortName: 'Boards of Canada',
        artistId: 'artist-1',
        joinPhrase: '',
      },
    ],
    releases: [{ id: 'rel-1', title: 'Music Has the Right to Children', date: '1998' }],
    score: null,
  };

  it('builds search text from releasegroup and artist', () => {
    expect(
      translateReleaseGroup(parseQuery('releasegroup:"Music Has the Right" AND artist:"Boards"'))
        .searchText,
    ).toBe('Music Has the Right Boards');
  });

  it('filters by type and secondary type', () => {
    const byType = translateReleaseGroup(parseQuery('type:album'));
    expect(byType.filter(group)).toBe(true);
    expect(byType.filter({ ...group, primaryType: 'EP' })).toBe(false);

    const bySecondary = translateReleaseGroup(parseQuery('secondarytype:compilation'));
    expect(bySecondary.filter(group)).toBe(true);
    expect(bySecondary.filter({ ...group, secondaryTypes: [] })).toBe(false);
  });

  it('filters by first release date', () => {
    const translated = translateReleaseGroup(parseQuery('firstreleasedate:1998'));
    expect(translated.filter(group)).toBe(true);
    expect(translated.filter({ ...group, firstReleaseDate: '2001' })).toBe(false);
  });

  it('filters by reid', () => {
    const translated = translateReleaseGroup(parseQuery('reid:rel-1'));
    expect(translated.filter(group)).toBe(true);
    expect(translated.filter({ ...group, releases: [] })).toBe(false);
  });

  it('filters by release-group and artist mbids', () => {
    expect(translateReleaseGroup(parseQuery('rgid:rg-1')).filter(group)).toBe(true);
    expect(translateReleaseGroup(parseQuery('rgid:nope')).filter(group)).toBe(false);

    expect(translateReleaseGroup(parseQuery('arid:artist-1')).filter(group)).toBe(true);
    expect(translateReleaseGroup(parseQuery('arid:nope')).filter(group)).toBe(false);
  });

  it('excludes negated text terms for release groups', () => {
    const translated = translateReleaseGroup(
      parseQuery('releasegroup:"Music Has the Right" -artist:"Autechre"'),
    );

    expect(translated.filter(group)).toBe(true);
    expect(
      translated.filter({
        ...group,
        artistCredits: [
          { name: 'Autechre', sortName: 'Autechre', artistId: 'artist-2', joinPhrase: '' },
        ],
      }),
    ).toBe(false);
  });
});
