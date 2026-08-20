import { describe, expect, it } from 'bun:test';
import { FakeSource } from '@/adapters/fake';

const boardsOfCanada = { id: 'UC-artist', name: 'Boards of Canada' };

const roygbiv = {
  id: 'video-1',
  title: 'Roygbiv',
  artists: [boardsOfCanada],
  album: { id: 'MPREb_1', name: 'Music Has the Right to Children', artists: [], year: '1998' },
  durationSeconds: 148,
  year: '1998',
};

const mhtrtc = {
  id: 'MPREb_1',
  name: 'Music Has the Right to Children',
  artists: [boardsOfCanada],
  year: '1998',
};

const mhtrtcAlbum = {
  ...mhtrtc,
  description: 'The debut album.',
  tracks: [roygbiv],
  artwork: [
    { url: 'https://lh3.googleusercontent.com/mhtrtc=w120-h120', width: 120, height: 120 },
    { url: 'https://lh3.googleusercontent.com/mhtrtc=w544-h544', width: 544, height: 544 },
    { url: 'https://lh3.googleusercontent.com/mhtrtc=w1200-h1200', width: 1200, height: 1200 },
  ],
};

const geogaddi = {
  id: 'MPREb_2',
  name: 'Geogaddi',
  artists: [boardsOfCanada],
  year: '2002',
  description: 'The second album.',
  tracks: [],
  artwork: [],
};

describe('FakeSource', () => {
  it('searches seeded tracks by title or artist', async () => {
    const source = new FakeSource().seedTrack(roygbiv).seedTrack({
      ...roygbiv,
      id: 'video-2',
      title: 'Aquarius',
      artists: [{ id: 'UC-other', name: 'Boards' }],
    });

    expect(await source.searchSongs('roygbiv')).toEqual([roygbiv]);
    expect(await source.searchSongs('boards')).toHaveLength(2);
    expect(await source.searchSongs('unknown')).toEqual([]);
  });

  it('searches seeded albums', async () => {
    const source = new FakeSource().seedAlbum(mhtrtcAlbum).seedAlbum(geogaddi);

    expect(await source.searchAlbums('Music Has the Right')).toEqual([mhtrtc]);
    expect(await source.searchAlbums('Boards of Canada')).toHaveLength(2);
    expect(await source.searchAlbums('nope')).toEqual([]);
  });

  it('searches seeded artists', async () => {
    const source = new FakeSource().seedArtist({
      id: 'UC-artist',
      name: 'Boards of Canada',
      albums: [mhtrtc],
      singles: [],
      topTracks: [roygbiv],
    });

    expect(await source.searchArtists('boards of canada')).toEqual([boardsOfCanada]);
    expect(await source.searchArtists('radiohead')).toEqual([]);
  });

  it('returns seeded albums, artists, and songs by id', async () => {
    const artist = {
      id: 'UC-artist',
      name: 'Boards of Canada',
      albums: [mhtrtc],
      singles: [],
      topTracks: [roygbiv],
    };
    const source = new FakeSource().seedTrack(roygbiv).seedAlbum(mhtrtcAlbum).seedArtist(artist);

    expect(await source.getAlbum('MPREb_1')).toEqual(mhtrtcAlbum);
    expect(await source.getAlbum('missing')).toBeNull();
    expect(await source.getArtist('UC-artist')).toEqual(artist);
    expect(await source.getArtist('missing')).toBeNull();
    expect(await source.getSong('video-1')).toEqual(roygbiv);
    expect(await source.getSong('missing')).toBeNull();
  });

  it('matches queries case-insensitively and on partial terms', async () => {
    const source = new FakeSource().seedTrack(roygbiv);

    expect(await source.searchSongs('ROYGBIV')).toHaveLength(1);
    expect(await source.searchSongs('roy')).toHaveLength(1);
  });

  it('handles null ids and empty queries', async () => {
    const source = new FakeSource()
      .seedTrack({ ...roygbiv, id: null })
      .seedAlbum({ ...mhtrtcAlbum, id: null })
      .seedArtist({ id: null, name: 'Anon', albums: [], singles: [], topTracks: [] });

    expect(await source.searchSongs('   ')).toHaveLength(1);
    expect(await source.searchAlbums(' ')).toHaveLength(1);
    expect(await source.searchArtists('')).toHaveLength(1);
    expect(await source.searchSongs('Boards of Canada')).toHaveLength(1);
  });
});
