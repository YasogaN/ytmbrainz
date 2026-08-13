import { describe, expect, it } from 'bun:test';
import {
  DEFAULT_LIMIT,
  MAX_LIMIT,
  parseInc,
  parseLimit,
  parseOffset,
  parsePageParams,
} from '@/ws/params';

const params = (query: string) => new URLSearchParams(query);

describe('parseLimit', () => {
  it('defaults to 25', () => {
    expect(parseLimit(null)).toBe(DEFAULT_LIMIT);
  });

  it('clamps to the max', () => {
    expect(parseLimit('999999')).toBe(MAX_LIMIT);
  });

  it('clamps to at least 1', () => {
    expect(parseLimit('0')).toBe(1);
    expect(parseLimit('-5')).toBe(1);
  });

  it('rejects non-numeric limits', () => {
    expect(() => parseLimit('abc')).toThrow();
  });
});

describe('parseOffset', () => {
  it('defaults to 0', () => {
    expect(parseOffset(null)).toBe(0);
  });

  it('clamps negative offsets to 0', () => {
    expect(parseOffset('-3')).toBe(0);
  });

  it('rejects non-numeric offsets', () => {
    expect(() => parseOffset('nope')).toThrow();
  });
});

describe('parsePageParams', () => {
  it('parses both', () => {
    expect(parsePageParams(params('limit=5&offset=10'))).toEqual({ limit: 5, offset: 10 });
  });

  it('defaults both', () => {
    expect(parsePageParams(params(''))).toEqual({ limit: DEFAULT_LIMIT, offset: 0 });
  });
});

describe('parseInc', () => {
  it('splits on plus signs', () => {
    expect(parseInc(params('inc=recordings+labels'))).toEqual(['recordings', 'labels']);
  });

  it('returns an empty list when absent or empty', () => {
    expect(parseInc(params(''))).toEqual([]);
    expect(parseInc(params('inc='))).toEqual([]);
  });
});
