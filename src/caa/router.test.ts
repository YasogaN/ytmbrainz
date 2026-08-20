import { describe, expect, it } from 'bun:test';
import { parseCoverArtPath } from '@/caa/router';

const MBID = '9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c';

describe('parseCoverArtPath', () => {
  it('parses a release index path', () => {
    expect(parseCoverArtPath(`/release/${MBID}`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'index',
    });
  });

  it('parses a release-group index path with a trailing slash', () => {
    expect(parseCoverArtPath(`/release-group/${MBID}/`)).toEqual({
      entity: 'release-group',
      mbid: MBID,
      variant: 'index',
    });
  });

  it('parses front redirect paths', () => {
    expect(parseCoverArtPath(`/release/${MBID}/front`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'front',
      size: null,
    });
    expect(parseCoverArtPath(`/release-group/${MBID}/front-250`)).toEqual({
      entity: 'release-group',
      mbid: MBID,
      variant: 'front',
      size: 250,
    });
    expect(parseCoverArtPath(`/release/${MBID}/front-1200`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'front',
      size: 1200,
    });
  });

  it('parses back paths', () => {
    expect(parseCoverArtPath(`/release/${MBID}/back`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'back',
      size: null,
    });
    expect(parseCoverArtPath(`/release/${MBID}/back-500`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'back',
      size: 500,
    });
  });

  it('parses image paths with and without extensions and sizes', () => {
    expect(parseCoverArtPath(`/release/${MBID}/abc123`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'image',
      id: 'abc123',
      size: null,
    });
    expect(parseCoverArtPath(`/release/${MBID}/abc123.jpg`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'image',
      id: 'abc123',
      size: null,
    });
    expect(parseCoverArtPath(`/release/${MBID}/abc123-500.jpg`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'image',
      id: 'abc123',
      size: 500,
    });
  });

  it('parses image ids containing hyphens and jpg in the middle', () => {
    expect(parseCoverArtPath(`/release/${MBID}/aa-bb-1200x`)).toEqual({
      entity: 'release',
      mbid: MBID,
      variant: 'image',
      id: 'aa-bb-1200x',
      size: null,
    });
  });

  it('rejects unknown entities, bad sizes, and malformed paths', () => {
    expect(parseCoverArtPath('/artist/abc')).toBeNull();
    expect(parseCoverArtPath(`/release/${MBID}/front-700`)).toBeNull();
    expect(parseCoverArtPath(`/release/${MBID}/back-700`)).toBeNull();
    expect(parseCoverArtPath('/ws/2/release/abc')).toBeNull();
    expect(parseCoverArtPath('/release')).toBeNull();
    expect(parseCoverArtPath('/')).toBeNull();
    expect(parseCoverArtPath(`/release/${MBID}/extra/path`)).toBeNull();
    expect(parseCoverArtPath(`/release/${MBID}/-250`)).toBeNull();
    expect(parseCoverArtPath(`/release/${MBID}/`)).not.toBeNull();
  });
});
