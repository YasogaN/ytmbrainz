import { beforeEach, describe, expect, it, mock } from 'bun:test';

interface Run {
  text: string;
  endpoint?: { payload?: { browseId?: string } };
}

interface MusicShim {
  search: ReturnType<typeof mock>;
  getAlbum: ReturnType<typeof mock>;
  getArtist: ReturnType<typeof mock>;
  getInfo: ReturnType<typeof mock>;
}

let music: MusicShim;
let createOptions: Record<string, unknown> | undefined;

beforeEach(() => {
  music = {
    search: mock(),
    getAlbum: mock(),
    getArtist: mock(),
    getInfo: mock(),
  };
  createOptions = undefined;
});

mock.module('youtubei.js', () => ({
  Innertube: {
    create: async (options: Record<string, unknown>) => {
      createOptions = options;
      return { music };
    },
  },
  ClientType: { MUSIC: 'WEB_REMIX' },
}));

import { InnerTubeSource } from '@/adapters/innertube';

const text = (value: string, runs: Run[] = []) => ({ toString: () => value, runs });

const songItem = (overrides: Record<string, unknown> = {}) => ({
  id: 'video-1',
  title: 'Roygbiv',
  item_type: 'song',
  duration: { seconds: 148 },
  artists: [{ name: 'Boards of Canada', channel_id: 'UC-artist' }],
  album: { id: 'MPREb_1', name: 'Music Has the Right to Children' },
  year: '1998',
  ...overrides,
});

describe('InnerTubeSource', () => {
  it('passes session options through to session creation', () => {
    new InnerTubeSource({
      cookie: 'SID=abc',
      visitorData: 'visitor123',
      poToken: 'potok',
    });

    expect(createOptions).toMatchObject({
      client_type: 'WEB_REMIX',
      cookie: 'SID=abc',
      visitor_data: 'visitor123',
      po_token: 'potok',
    });
  });

  it('maps song search results', async () => {
    music.search.mockReturnValue({ songs: { contents: [songItem()] } });
    const source = new InnerTubeSource();

    const songs = await source.searchSongs('roygbiv');

    expect(music.search).toHaveBeenCalledWith('roygbiv', { type: 'song' });
    expect(songs).toEqual([
      {
        id: 'video-1',
        title: 'Roygbiv',
        artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
        album: {
          id: 'MPREb_1',
          name: 'Music Has the Right to Children',
          artists: [],
          year: null,
        },
        durationSeconds: 148,
        year: '1998',
      },
    ]);
  });

  it('returns an empty list when the songs shelf is missing', async () => {
    music.search.mockReturnValue({});
    const source = new InnerTubeSource();

    expect(await source.searchSongs('nothing')).toEqual([]);
  });

  it('fetches continuation pages up to the requested limit', async () => {
    music.search.mockReturnValue({
      songs: { contents: [songItem({ id: 'v1' }), songItem({ id: 'v2' })] },
      has_continuation: true,
      getContinuation: async () => ({
        contents: { contents: [songItem({ id: 'v3' }), songItem({ id: 'v4' })] },
        has_continuation: false,
      }),
    });
    const source = new InnerTubeSource();

    const three = await source.searchSongs('x', 3);
    expect(three.map(song => song.id)).toEqual(['v1', 'v2', 'v3']);

    const all = await source.searchSongs('x', 5);
    expect(all.map(song => song.id)).toEqual(['v1', 'v2', 'v3', 'v4']);
  });

  it('drops non-song and incomplete items from song results', async () => {
    music.search.mockReturnValue({
      songs: {
        contents: [
          songItem({ item_type: 'album', id: 'MPREb_x' }),
          songItem({ id: undefined }),
          songItem({ title: undefined }),
        ],
      },
    });
    const source = new InnerTubeSource();

    expect(await source.searchSongs('x')).toEqual([]);
  });

  it('maps album search results', async () => {
    music.search.mockReturnValue({
      albums: {
        contents: [
          {
            id: 'MPREb_2',
            title: 'Music Has the Right to Children',
            item_type: 'album',
            year: '1998',
            artists: [{ name: 'Boards of Canada', channel_id: 'UC-artist' }],
          },
        ],
      },
    });
    const source = new InnerTubeSource();

    const albums = await source.searchAlbums('music has the right');

    expect(music.search).toHaveBeenCalledWith('music has the right', { type: 'album' });
    expect(albums).toEqual([
      {
        id: 'MPREb_2',
        name: 'Music Has the Right to Children',
        artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
        year: '1998',
      },
    ]);
  });

  it('returns an empty list when the albums shelf is missing', async () => {
    music.search.mockReturnValue({});
    const source = new InnerTubeSource();

    expect(await source.searchAlbums('nothing')).toEqual([]);
  });

  it('maps artist search results', async () => {
    music.search.mockReturnValue({
      artists: { contents: [{ id: 'UC-artist', name: 'Boards of Canada', item_type: 'artist' }] },
    });
    const source = new InnerTubeSource();

    const artists = await source.searchArtists('boards');

    expect(music.search).toHaveBeenCalledWith('boards', { type: 'artist' });
    expect(artists).toEqual([{ id: 'UC-artist', name: 'Boards of Canada' }]);
  });

  it('returns an empty list when the artists shelf is missing', async () => {
    music.search.mockReturnValue({});
    const source = new InnerTubeSource();

    expect(await source.searchArtists('nothing')).toEqual([]);
  });

  it('returns null when getAlbum reports a missing entity', async () => {
    music.getAlbum.mockRejectedValue(new Error('Video unavailable'));
    const source = new InnerTubeSource();

    expect(await source.getAlbum('MPREb_missing')).toBeNull();
  });

  it('surfaces an upstream failure from getAlbum', async () => {
    music.getAlbum.mockRejectedValue(new Error('network down'));
    const source = new InnerTubeSource();

    await expect(source.getAlbum('MPREb_missing')).rejects.toThrow();
  });

  it('maps an album with a detail header', async () => {
    music.getAlbum.mockReturnValue({
      header: {
        type: 'MusicDetailHeader',
        title: text('Music Has the Right to Children'),
        subtitle: text('Boards of Canada • 1998 • 10 songs', [
          { text: 'Boards of Canada', endpoint: { payload: { browseId: 'UC-artist' } } },
        ]),
        year: '1998',
        author: { name: 'Boards of Canada', channel_id: 'UC-artist' },
        description: text('An album'),
      },
      contents: [songItem()],
    });
    const source = new InnerTubeSource();

    const album = await source.getAlbum('MPREb_1');

    expect(album).toEqual({
      id: 'MPREb_1',
      name: 'Music Has the Right to Children',
      artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
      year: '1998',
      description: 'An album',
      tracks: [
        {
          id: 'video-1',
          title: 'Roygbiv',
          artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
          album: {
            id: 'MPREb_1',
            name: 'Music Has the Right to Children',
            artists: [],
            year: null,
          },
          durationSeconds: 148,
          year: '1998',
        },
      ],
    });
  });

  it('maps an album with a responsive header using subtitle runs', async () => {
    music.getAlbum.mockReturnValue({
      header: {
        type: 'MusicResponsiveHeader',
        title: text('Some Album'),
        subtitle: text('Some Artist • 2021 • Album', [
          { text: 'Some Artist', endpoint: { payload: { browseId: 'UC-some' } } },
          { text: '2021' },
        ]),
      },
      contents: [],
    });
    const source = new InnerTubeSource();

    const album = await source.getAlbum('MPREb_3');

    expect(album).toEqual({
      id: 'MPREb_3',
      name: 'Some Album',
      artists: [{ id: 'UC-some', name: 'Some Artist' }],
      year: '2021',
      description: null,
      tracks: [],
    });
  });

  it('returns null when getArtist reports a missing entity', async () => {
    music.getArtist.mockRejectedValue(new Error('Video unavailable'));
    const source = new InnerTubeSource();

    expect(await source.getArtist('UC-missing')).toBeNull();
  });

  it('surfaces an upstream failure from getArtist', async () => {
    music.getArtist.mockRejectedValue(new Error('network down'));
    const source = new InnerTubeSource();

    await expect(source.getArtist('UC-missing')).rejects.toThrow();
  });

  it('maps an artist page with albums, singles, and top songs', async () => {
    music.getArtist.mockReturnValue({
      header: { title: text('Boards of Canada') },
      sections: [
        {
          type: 'MusicShelf',
          title: text('Top songs'),
          contents: [songItem()],
        },
        {
          type: 'MusicCarouselShelf',
          header: { title: text('Albums') },
          contents: [
            {
              id: 'MPREb_1',
              title: 'Music Has the Right to Children',
              item_type: 'album',
              year: '1998',
              author: { name: 'Boards of Canada', channel_id: 'UC-artist' },
            },
          ],
        },
        {
          type: 'MusicCarouselShelf',
          header: { title: text('Singles') },
          contents: [
            {
              id: 'MPREb_4',
              title: 'A Beautiful Place Out in the Country',
              item_type: 'album',
              author: { name: 'Boards of Canada', channel_id: 'UC-artist' },
            },
          ],
        },
        {
          type: 'MusicCarouselShelf',
          header: { title: text('Videos') },
          contents: [{ id: 'video-v', title: 'Some Video', item_type: 'video' }],
        },
      ],
    });
    const source = new InnerTubeSource();

    const artist = await source.getArtist('UC-artist');

    expect(artist).toEqual({
      id: 'UC-artist',
      name: 'Boards of Canada',
      albums: [
        {
          id: 'MPREb_1',
          name: 'Music Has the Right to Children',
          artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
          year: '1998',
        },
      ],
      singles: [
        {
          id: 'MPREb_4',
          name: 'A Beautiful Place Out in the Country',
          artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
          year: null,
        },
      ],
      topTracks: [
        {
          id: 'video-1',
          title: 'Roygbiv',
          artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
          album: {
            id: 'MPREb_1',
            name: 'Music Has the Right to Children',
            artists: [],
            year: null,
          },
          durationSeconds: 148,
          year: '1998',
        },
      ],
    });
  });

  it('maps song info and returns null when getInfo throws', async () => {
    music.getInfo.mockReturnValue({
      basic_info: {
        id: 'video-1',
        title: 'Roygbiv',
        author: 'Boards of Canada',
        channel_id: 'UC-artist',
        duration: 148,
      },
    });
    const source = new InnerTubeSource();

    expect(await source.getSong('video-1')).toEqual({
      id: 'video-1',
      title: 'Roygbiv',
      artists: [{ id: 'UC-artist', name: 'Boards of Canada' }],
      album: null,
      durationSeconds: 148,
      year: null,
    });

    music.getInfo.mockRejectedValue(new Error('Video unavailable'));
    expect(await source.getSong('video-gone')).toBeNull();

    music.getInfo.mockRejectedValue(new Error('network down'));
    await expect(source.getSong('video-down')).rejects.toThrow();
  });

  it('uses the requested id when basic info lacks one', async () => {
    music.getInfo.mockReturnValue({ basic_info: { title: 'Roygbiv', duration: 148 } });
    const source = new InnerTubeSource();

    const song = await source.getSong('video-1');

    expect(song?.id).toBe('video-1');
  });
});
