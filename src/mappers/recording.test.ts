import { describe, expect, it } from 'bun:test';
import type { YtTrack } from '@/adapters/types';
import { MbidStore, toMbid } from '@/core/mbid';
import { toArtistCredits } from '@/mappers/credit';
import { mapRecording, registerRecording } from '@/mappers/recording';

const track: YtTrack = {
  id: 'video-1',
  title: 'Roygbiv',
  artists: [
    { id: 'UC-a', name: 'Boards of Canada' },
    { id: 'UC-b', name: 'Another Artist' },
  ],
  album: { id: 'MPREb_1', name: 'Music Has the Right to Children', artists: [], year: '1998' },
  durationSeconds: 148,
  year: '1998',
};

describe('toArtistCredits', () => {
  it('maps artists to credits with join phrases', () => {
    const credits = toArtistCredits(track.artists);

    expect(credits).toEqual([
      {
        name: 'Boards of Canada',
        sortName: 'Boards of Canada',
        artistId: toMbid('artist', 'UC-a'),
        joinPhrase: ' & ',
      },
      {
        name: 'Another Artist',
        sortName: 'Another Artist',
        artistId: toMbid('artist', 'UC-b'),
        joinPhrase: '',
      },
    ]);
  });

  it('skips artists without ids', () => {
    expect(toArtistCredits([{ id: null, name: 'Anon' }])).toEqual([]);
  });
});

describe('mapRecording', () => {
  it('maps a track to a recording', () => {
    const recording = mapRecording(track, 100);

    expect(recording).toEqual({
      entity: 'recording',
      id: toMbid('recording', 'video-1'),
      title: 'Roygbiv',
      video: false,
      length: 148000,
      firstReleaseDate: '1998',
      disambiguation: null,
      artistCredits: toArtistCredits(track.artists),
      releases: [
        {
          id: toMbid('release', 'MPREb_1'),
          title: 'Music Has the Right to Children',
          date: '1998',
        },
      ],
      score: 100,
    });
  });

  it('handles a track without a duration or album', () => {
    const recording = mapRecording({ ...track, durationSeconds: null, album: null });

    expect(recording.length).toBeNull();
    expect(recording.releases).toEqual([]);
    expect(recording.score).toBeNull();
  });

  it('handles a track with a null id', () => {
    const recording = mapRecording({ ...track, id: null });

    expect(recording.id).toBe(toMbid('recording', ''));
  });
});

describe('registerRecording', () => {
  it('registers the recording, its artists, and its release', () => {
    const store = new MbidStore(':memory:');
    try {
      registerRecording(store, track);

      expect(store.lookup(toMbid('recording', 'video-1'))).toEqual({
        entity: 'recording',
        sourceId: 'video-1',
      });
      expect(store.lookup(toMbid('artist', 'UC-a'))).toEqual({
        entity: 'artist',
        sourceId: 'UC-a',
      });
      expect(store.lookup(toMbid('release', 'MPREb_1'))).toEqual({
        entity: 'release',
        sourceId: 'MPREb_1',
      });
    } finally {
      store.close();
    }
  });

  it('skips null ids', () => {
    const store = new MbidStore(':memory:');
    try {
      registerRecording(store, {
        ...track,
        id: null,
        album: null,
        artists: [{ id: null, name: 'X' }],
      });

      expect(store.lookup(toMbid('recording', ''))).toBeNull();
      expect(store.lookup(toMbid('artist', ''))).toBeNull();
    } finally {
      store.close();
    }
  });
});
