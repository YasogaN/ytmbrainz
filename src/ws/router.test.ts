import { describe, expect, it } from 'bun:test';
import { parsePath } from '@/ws/router';

describe('parsePath', () => {
  it('parses a search path', () => {
    expect(parsePath('/ws/2/recording')).toEqual({ entity: 'recording', mbid: null });
  });

  it('parses a lookup path', () => {
    expect(parsePath('/ws/2/recording/abc-123')).toEqual({
      entity: 'recording',
      mbid: 'abc-123',
    });
  });

  it('parses release-group paths', () => {
    expect(parsePath('/ws/2/release-group')).toEqual({ entity: 'release-group', mbid: null });
  });

  it('handles trailing slashes', () => {
    expect(parsePath('/ws/2/recording/')).toEqual({ entity: 'recording', mbid: null });
  });

  it('rejects unknown entities', () => {
    expect(parsePath('/ws/2/label')).toBeNull();
    expect(parsePath('/ws/2/area')).toBeNull();
  });

  it('rejects non-webservice paths', () => {
    expect(parsePath('/')).toBeNull();
    expect(parsePath('/ws/1/recording')).toBeNull();
    expect(parsePath('/ws/2/recording/a/b')).toBeNull();
  });
});
