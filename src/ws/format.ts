export type ResponseFormat = 'xml' | 'json';

/**
 * Resolves the response format. `fmt=` in the query string takes precedence
 * over the Accept header, mirroring the MusicBrainz API.
 */
export function resolveFormat(fmt: string | null, acceptHeader: string | null): ResponseFormat {
  if (fmt === 'json' || fmt === 'xml') {
    return fmt;
  }
  if (acceptHeader?.includes('application/json')) {
    return 'json';
  }
  return 'xml';
}
