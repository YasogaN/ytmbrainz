import type { YtImage } from '@/adapters/types';
import type { CaaSize } from '@/caa/router';
import { toMbid } from '@/core/mbid';

/**
 * Deterministic Cover Art Archive image id for an album. Dashes are stripped so
 * the id can never be confused with the `-250`/`-500`/`-1200` size suffixes.
 */
export function imageIdOf(albumId: string): string {
  return toMbid('image', albumId).replaceAll('-', '');
}

const SIZE_PARAM = /=w\d+-h\d+/;

/**
 * Rewrites the `=wN-hN` size segment of a Google-hosted thumbnail URL to the
 * requested size. URLs without such a segment are returned unchanged.
 */
export function rewriteSize(url: string, size: CaaSize): string {
  return SIZE_PARAM.test(url) ? url.replace(SIZE_PARAM, `=w${size}-h${size}`) : url;
}

/**
 * Picks the artwork URL for a requested size. `null` means "largest available".
 * Falls back to the largest thumbnail when nothing is large enough.
 */
export function selectArtwork(artwork: YtImage[], size: CaaSize | null): string | null {
  if (artwork.length === 0) {
    return null;
  }
  const largest = artwork[artwork.length - 1];
  if (size === null) {
    return largest?.url ?? null;
  }
  const match = artwork.find(image => image.width >= size) ?? largest;
  return rewriteSize(match?.url ?? '', size);
}
