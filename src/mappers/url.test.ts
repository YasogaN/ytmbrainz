import { describe, expect, it } from 'bun:test';
import type { Recording } from '@/core/entities';
import { MbidStore, toMbid } from '@/core/mbid';
import { extractUrl, mapUrl, parseResource, registerUrl } from '@/mappers/url';

const recording: Recording = {
  entity: 'recording',
  id: toMbid('recording', 'video-1'),
  title: 'Roygbiv',
  video: false,
  length: 148000,
  firstReleaseDate: '1998',
  disambiguation: null,
  artistCredits: [],
  releases: [],
  score: null,
};

describe('parseResource', () => {
  it('parses watch URLs', () => {
    expect(parseResource('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toEqual({
      entity: 'recording',
      sourceId: 'dQw4w9WgXcQ',
    });
  });

  it('parses youtu.be short links', () => {
    expect(parseResource('https://youtu.be/dQw4w9WgXcQ')).toEqual({
      entity: 'recording',
      sourceId: 'dQw4w9WgXcQ',
    });
  });

  it('parses channel URLs', () => {
    expect(parseResource('https://music.youtube.com/channel/UC-artist')).toEqual({
      entity: 'artist',
      sourceId: 'UC-artist',
    });
  });

  it('parses album URLs', () => {
    expect(parseResource('https://music.youtube.com/album/MPREb_1')).toEqual({
      entity: 'release',
      sourceId: 'MPREb_1',
    });
  });

  it('rejects unmapped and malformed URLs', () => {
    expect(parseResource('https://www.youtube.com/playlist/PL-123')).toBeNull();
    expect(parseResource('https://www.youtube.com/@handle')).toBeNull();
    expect(parseResource('not a url')).toBeNull();
    expect(parseResource('https://example.com/thing')).toBeNull();
    expect(parseResource('https://www.youtube.com/watch')).toBeNull();
    expect(parseResource('https://youtu.be/')).toBeNull();
  });
});

describe('extractUrl', () => {
  it('extracts the first URL from a query', () => {
    expect(extractUrl('url:"https://youtu.be/dQw4w9WgXcQ"')).toBe('https://youtu.be/dQw4w9WgXcQ');
  });

  it('returns null without a URL', () => {
    expect(extractUrl('boards of canada')).toBeNull();
  });
});

describe('mapUrl and registerUrl', () => {
  it('builds a url entity with a relation to its target', () => {
    const resource = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
    const url = mapUrl(resource, recording);

    expect(url).toEqual({
      entity: 'url',
      id: toMbid('url', resource),
      resource,
      relations: [
        {
          type: 'recording',
          target: recording.id,
          direction: 'backward',
          entity: recording,
        },
      ],
      score: null,
    });
  });

  it('registers the resource in the store', () => {
    const store = new MbidStore(':memory:');
    try {
      registerUrl(store, 'https://youtu.be/dQw4w9WgXcQ');

      expect(store.lookup(toMbid('url', 'https://youtu.be/dQw4w9WgXcQ'))).toEqual({
        entity: 'url',
        sourceId: 'https://youtu.be/dQw4w9WgXcQ',
      });
    } finally {
      store.close();
    }
  });
});
