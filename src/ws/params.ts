import { WsError } from '@/ws/errors';

export const DEFAULT_LIMIT = 25;
export const MAX_LIMIT = 100;
export const MAX_FETCH = 200;

export function fetchLimit(limit: number, offset: number): number {
  return Math.min(offset + limit, MAX_FETCH);
}

export interface PageParams {
  limit: number;
  offset: number;
}

function parseBounded(
  raw: string | null,
  fallback: number,
  clamp: (value: number) => number,
  label: string,
): number {
  if (raw === null) {
    return fallback;
  }
  const value = Number.parseInt(raw, 10);
  if (Number.isNaN(value)) {
    throw new WsError(400, `Invalid ${label}: ${raw}`);
  }
  return clamp(value);
}

export function parseLimit(raw: string | null): number {
  return parseBounded(
    raw,
    DEFAULT_LIMIT,
    value => Math.min(MAX_LIMIT, Math.max(1, value)),
    'limit',
  );
}

export function parseOffset(raw: string | null): number {
  return parseBounded(raw, 0, value => Math.max(0, value), 'offset');
}

export function parsePageParams(searchParams: URLSearchParams): PageParams {
  return {
    limit: parseLimit(searchParams.get('limit')),
    offset: parseOffset(searchParams.get('offset')),
  };
}

export function parseInc(searchParams: URLSearchParams): string[] {
  const inc = searchParams.get('inc');
  if (inc === null || inc === '') {
    return [];
  }
  return inc.split(/[\s+]+/).filter(part => part !== '');
}
