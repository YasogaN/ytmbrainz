import { describe, expect, it } from 'bun:test';
import type { Artist, Recording, Release, ReleaseGroup, Url } from '@/core/entities';
import { listToXml, lookupToXml } from '@/serializers/xml';

const created = '2026-08-13T20:00:00.000Z';

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
  type: 'Group',
  country: null,
  disambiguation: null,
  ended: false,
  score: null,
};

const release: Release = {
  entity: 'release',
  id: 'rel-mbid',
  title: 'Music Has the Right to Children',
  status: 'Official',
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
      trackCount: 2,
      tracks: [
        { id: 'track-mbid', number: '1', title: 'Roygbiv', length: 148000 },
        { id: 'track-mbid-2', number: '2', title: 'Turquoise Hexagon Sun', length: null },
      ],
    },
  ],
  releaseGroup: {
    id: 'rg-mbid',
    primaryType: 'Album',
    secondaryTypes: ['Compilation'],
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

const metadata = (inner: string) =>
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><metadata created="${created}" xmlns="http://musicbrainz.org/ns/mmd-2.0#" xmlns:ns2="http://musicbrainz.org/ns/ext#-2.0">${inner}</metadata>`;

describe('lookupToXml', () => {
  it('serializes a recording', () => {
    expect(lookupToXml(created, recording)).toBe(
      metadata(
        '<recording id="rec-mbid" ns2:score="100"><title>Roygbiv</title><length>148000</length>' +
          '<artist-credit><name-credit joinphrase=" &amp; "><name>Boards of Canada</name>' +
          '<artist id="artist-mbid"><name>Boards of Canada</name><sort-name>Boards of Canada</sort-name></artist>' +
          '</name-credit></artist-credit><first-release-date>1998</first-release-date>' +
          '<release-list count="1"><release id="rel-mbid"><title>Music Has the Right to Children</title>' +
          '<date>1998</date></release></release-list></recording>',
      ),
    );
  });

  it('emits video and omits unknown fields', () => {
    const sparse: Recording = {
      ...recording,
      video: true,
      length: null,
      firstReleaseDate: null,
      disambiguation: null,
      artistCredits: [],
      releases: [],
      score: null,
    };

    expect(lookupToXml(created, sparse)).toBe(
      metadata(
        '<recording id="rec-mbid"><title>Roygbiv</title><video>true</video><artist-credit/></recording>',
      ),
    );
  });

  it('escapes text and attributes', () => {
    const weird: Recording = {
      ...recording,
      title: 'A & B <C>',
      disambiguation: 'he said "hi"',
      artistCredits: [
        {
          name: 'X & Y',
          sortName: 'Y, X',
          artistId: 'a',
          joinPhrase: ' + ',
        },
      ],
    };

    expect(lookupToXml(created, weird)).toContain('<title>A &amp; B &lt;C&gt;</title>');
    expect(lookupToXml(created, weird)).toContain(
      '<disambiguation>he said &quot;hi&quot;</disambiguation>',
    );
    expect(lookupToXml(created, weird)).toContain(
      '<name-credit joinphrase=" + "><name>X &amp; Y</name>',
    );
  });

  it('serializes an artist with type attribute', () => {
    expect(lookupToXml(created, artist)).toBe(
      metadata(
        '<artist id="artist-mbid" type="Group"><name>Boards of Canada</name>' +
          '<sort-name>Boards of Canada</sort-name>' +
          '<life-span><ended>false</ended></life-span></artist>',
      ),
    );
  });

  it('serializes a release with media', () => {
    expect(lookupToXml(created, release)).toBe(
      metadata(
        '<release id="rel-mbid"><title>Music Has the Right to Children</title><status>Official</status>' +
          '<artist-credit><name-credit><name>Boards of Canada</name>' +
          '<artist id="artist-mbid"><name>Boards of Canada</name><sort-name>Boards of Canada</sort-name></artist>' +
          '</name-credit></artist-credit>' +
          '<release-group id="rg-mbid"><title>Music Has the Right to Children</title><primary-type>Album</primary-type>' +
          '<secondary-type-list><secondary-type>Compilation</secondary-type></secondary-type-list></release-group>' +
          '<date>1998</date><release-event-list count="1"><release-event><date>1998</date></release-event></release-event-list>' +
          '<medium-list count="1"><track-count>2</track-count>' +
          '<medium id="med-mbid"><position>1</position><format>Digital Media</format>' +
          '<track-list count="2" offset="0"><track id="track-mbid"><number>1</number><title>Roygbiv</title><length>148000</length></track>' +
          '<track id="track-mbid-2"><number>2</number><title>Turquoise Hexagon Sun</title></track></track-list>' +
          '</medium></medium-list></release>',
      ),
    );
  });

  it('serializes a release group', () => {
    expect(lookupToXml(created, releaseGroup)).toBe(
      metadata(
        '<release-group id="rg-mbid" ns2:score="60"><title>Music Has the Right to Children</title>' +
          '<first-release-date>1998</first-release-date><primary-type>Album</primary-type>' +
          '<secondary-type-list><secondary-type>Compilation</secondary-type></secondary-type-list>' +
          '<artist-credit><name-credit><name>Boards of Canada</name>' +
          '<artist id="artist-mbid"><name>Boards of Canada</name><sort-name>Boards of Canada</sort-name></artist>' +
          '</name-credit></artist-credit>' +
          '<release-list count="1"><release id="rel-mbid"><title>Music Has the Right to Children</title>' +
          '<date>1998</date></release></release-list></release-group>',
      ),
    );
  });

  it('serializes a url', () => {
    expect(lookupToXml(created, url)).toBe(
      metadata(
        '<url id="url-mbid"><resource>https://www.youtube.com/watch?v=dQw4w9WgXcQ</resource></url>',
      ),
    );
  });
});

describe('listToXml', () => {
  it('wraps items in a list element with count and offset', () => {
    expect(listToXml(created, 'recording-list', [recording], 0)).toBe(
      metadata(
        '<recording-list count="1" offset="0"><recording id="rec-mbid" ns2:score="100">' +
          '<title>Roygbiv</title><length>148000</length>' +
          '<artist-credit><name-credit joinphrase=" &amp; "><name>Boards of Canada</name>' +
          '<artist id="artist-mbid"><name>Boards of Canada</name><sort-name>Boards of Canada</sort-name></artist>' +
          '</name-credit></artist-credit><first-release-date>1998</first-release-date>' +
          '<release-list count="1"><release id="rel-mbid"><title>Music Has the Right to Children</title>' +
          '<date>1998</date></release></release-list></recording></recording-list>',
      ),
    );
  });
});
