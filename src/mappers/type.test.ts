import { describe, expect, it } from 'bun:test';
import { inferPrimaryType } from '@/mappers/type';

describe('inferPrimaryType', () => {
  it('defaults to Album when the track count is unknown', () => {
    expect(inferPrimaryType(null)).toBe('Album');
  });

  it('classifies singles, EPs, and albums by track count', () => {
    expect(inferPrimaryType(1)).toBe('Single');
    expect(inferPrimaryType(3)).toBe('Single');
    expect(inferPrimaryType(4)).toBe('EP');
    expect(inferPrimaryType(6)).toBe('EP');
    expect(inferPrimaryType(7)).toBe('Album');
    expect(inferPrimaryType(20)).toBe('Album');
  });
});
