import { describe, expect, it } from 'bun:test';
import type { YtImage } from '@/adapters/types';
import { imageIdOf, rewriteSize, selectArtwork } from '@/caa/artwork';

const image = (width: number, url = `https://img.example.com/x=w${width}-h${width}`): YtImage => ({
  url,
  width,
  height: width,
});

describe('imageIdOf', () => {
  it('derives a deterministic dashless id from the album id', () => {
    const id = imageIdOf('MPREb_1');

    expect(id).toBe(imageIdOf('MPREb_1'));
    expect(id).not.toBe(imageIdOf('MPREb_2'));
    expect(id).not.toContain('-');
  });
});

describe('rewriteSize', () => {
  it('rewrites the w/h segment of google-hosted urls', () => {
    expect(rewriteSize('https://img.example.com/x=w544-h544-l90-rj', 250)).toBe(
      'https://img.example.com/x=w250-h250-l90-rj',
    );
  });

  it('leaves urls without a size segment unchanged', () => {
    expect(rewriteSize('https://img.example.com/plain.jpg', 500)).toBe(
      'https://img.example.com/plain.jpg',
    );
  });
});

describe('selectArtwork', () => {
  it('returns null when there is no artwork', () => {
    expect(selectArtwork([], null)).toBeNull();
    expect(selectArtwork([], 250)).toBeNull();
  });

  it('picks the largest artwork when no size is requested', () => {
    const artwork = [image(120), image(544), image(1200)];

    expect(selectArtwork(artwork, null)).toBe('https://img.example.com/x=w1200-h1200');
  });

  it('picks the smallest artwork that covers the requested size', () => {
    const artwork = [image(120), image(544), image(1200)];

    expect(selectArtwork(artwork, 250)).toBe('https://img.example.com/x=w250-h250');
    expect(selectArtwork(artwork, 500)).toBe('https://img.example.com/x=w500-h500');
    expect(selectArtwork(artwork, 1200)).toBe('https://img.example.com/x=w1200-h1200');
  });

  it('falls back to the largest artwork when nothing is big enough', () => {
    const artwork = [image(120)];

    expect(selectArtwork(artwork, 500)).toBe('https://img.example.com/x=w500-h500');
  });
});
