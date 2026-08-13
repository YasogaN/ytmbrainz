import { badRequest } from '@/ws/errors';

const COMMON = [
  'aliases',
  'annotation',
  'tags',
  'ratings',
  'genres',
  'user-tags',
  'user-ratings',
  'user-genres',
];

const RELS = [
  'area-rels',
  'artist-rels',
  'event-rels',
  'genre-rels',
  'instrument-rels',
  'label-rels',
  'place-rels',
  'recording-rels',
  'release-rels',
  'release-group-rels',
  'series-rels',
  'url-rels',
  'work-rels',
  'recording-level-rels',
  'release-group-level-rels',
  'work-level-rels',
];

const set = (...values: string[]) => new Set(values);

export const RECORDING_INC = set(
  'artist-credits',
  'releases',
  'release-groups',
  'isrcs',
  ...COMMON,
  ...RELS,
);

export const ARTIST_INC = set(
  'recordings',
  'releases',
  'release-groups',
  'works',
  ...COMMON,
  ...RELS,
);

export const RELEASE_INC = set(
  'artist-credits',
  'collections',
  'labels',
  'recordings',
  'release-groups',
  'media',
  'discids',
  'isrcs',
  'various-artists',
  ...COMMON,
  ...RELS,
);

export const RELEASE_GROUP_INC = set('artist-credits', 'releases', ...COMMON, ...RELS);

export const URL_INC = set(...RELS, ...COMMON);

export function validateInc(incValues: string[], allowed: ReadonlySet<string>): void {
  for (const inc of incValues) {
    if (!allowed.has(inc)) {
      throw badRequest(`Invalid inc parameter: ${inc}.`);
    }
  }
}
