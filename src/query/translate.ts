import type { Artist, Entity, Recording, Release, ReleaseGroup } from '@/core/entities';
import type { QueryClause } from '@/query/parser';

export interface TranslatedSearch {
  searchText: string;
  filter: (entity: Entity) => boolean;
}

interface EntitySearchConfig {
  textFields: readonly (string | null)[];
  textOf: (entity: Entity) => string;
  filterFor: (field: string, clause: QueryClause) => ((entity: Entity) => boolean) | null;
}

function parseOrNull(raw: string): number | null {
  if (raw === '' || raw === '*') {
    return null;
  }
  const value = Number.parseInt(raw, 10);
  return Number.isNaN(value) ? null : value;
}

function parseDurationRange(value: string): { min: number | null; max: number | null } | null {
  const bounds = value.split(/\s+TO\s+/i);
  if (bounds.length === 2) {
    return { min: parseOrNull(bounds[0] ?? ''), max: parseOrNull(bounds[1] ?? '') };
  }
  const exact = parseOrNull(value);
  return exact === null ? null : { min: exact, max: exact };
}

function durationFilter(value: string): ((length: number | null) => boolean) | null {
  const range = parseDurationRange(value);
  if (range === null) {
    return null;
  }
  return length => {
    if (length === null) {
      return false;
    }
    if (range.min !== null && length < range.min) {
      return false;
    }
    if (range.max !== null && length > range.max) {
      return false;
    }
    return true;
  };
}

function applyFilters(
  includes: Array<(entity: Entity) => boolean>,
  excludes: Array<(entity: Entity) => boolean>,
): (entity: Entity) => boolean {
  return entity => {
    for (const predicate of includes) {
      if (!predicate(entity)) {
        return false;
      }
    }
    for (const predicate of excludes) {
      if (!predicate(entity)) {
        return false;
      }
    }
    return true;
  };
}

function buildSearch(clauses: QueryClause[], config: EntitySearchConfig): TranslatedSearch {
  const terms: string[] = [];
  const includes: Array<(entity: Entity) => boolean> = [];
  const excludes: Array<(entity: Entity) => boolean> = [];
  for (const clause of clauses) {
    if (config.textFields.includes(clause.field)) {
      if (clause.negated) {
        const matcher = (text: string) => text.toLowerCase().includes(clause.value.toLowerCase());
        excludes.push(entity => !matcher(config.textOf(entity)));
      } else {
        terms.push(clause.value);
      }
      continue;
    }
    const predicate = clause.field === null ? null : config.filterFor(clause.field, clause);
    if (predicate === null) {
      continue;
    }
    if (clause.negated) {
      excludes.push(entity => !predicate(entity));
    } else {
      includes.push(predicate);
    }
  }
  return {
    searchText: terms.join(' '),
    filter: applyFilters(includes, excludes),
  };
}

const RECORDING_TEXT_FIELDS = [null, 'recording', 'artist', 'artistname', 'release', 'track'];

function recordingFilterFor(
  field: string,
  clause: QueryClause,
): ((entity: Entity) => boolean) | null {
  switch (field) {
    case 'dur': {
      const predicate = durationFilter(clause.value);
      return predicate === null ? null : entity => predicate((entity as Recording).length);
    }
    case 'arid':
      return entity =>
        (entity as Recording).artistCredits.some(credit => credit.artistId === clause.value);
    case 'reid':
      return entity => (entity as Recording).releases.some(release => release.id === clause.value);
    case 'video': {
      const wanted = clause.value.toLowerCase() === 'true';
      return entity => (entity as Recording).video === wanted;
    }
    default:
      return null;
  }
}

export function translateRecording(clauses: QueryClause[]): TranslatedSearch {
  return buildSearch(clauses, {
    textFields: RECORDING_TEXT_FIELDS,
    textOf: entity => {
      const recording = entity as Recording;
      return `${recording.title} ${recording.artistCredits.map(credit => credit.name).join(' ')}`;
    },
    filterFor: recordingFilterFor,
  });
}

const ARTIST_TEXT_FIELDS = [null, 'artist', 'alias', 'sortname'];

function artistFilterFor(field: string, clause: QueryClause): ((entity: Entity) => boolean) | null {
  switch (field) {
    case 'arid':
      return entity => (entity as Artist).id === clause.value;
    case 'ended':
      return entity => (entity as Artist).ended === (clause.value.toLowerCase() === 'true');
    default:
      return null;
  }
}

export function translateArtist(clauses: QueryClause[]): TranslatedSearch {
  return buildSearch(clauses, {
    textFields: ARTIST_TEXT_FIELDS,
    textOf: entity => (entity as Artist).name,
    filterFor: artistFilterFor,
  });
}

const RELEASE_TEXT_FIELDS = [null, 'release', 'releaseaccent', 'artist', 'artistname'];

function releaseFilterFor(
  field: string,
  clause: QueryClause,
): ((entity: Entity) => boolean) | null {
  switch (field) {
    case 'reid':
      return entity => (entity as Release).id === clause.value;
    case 'arid':
      return entity =>
        (entity as Release).artistCredits.some(credit => credit.artistId === clause.value);
    case 'rgid':
      return entity => (entity as Release).releaseGroup?.id === clause.value;
    case 'primarytype':
      return entity =>
        (entity as Release).releaseGroup?.primaryType?.toLowerCase() === clause.value.toLowerCase();
    case 'secondarytype':
      return entity =>
        (entity as Release).releaseGroup?.secondaryTypes.some(
          type => type.toLowerCase() === clause.value.toLowerCase(),
        ) ?? false;
    case 'date':
      return entity => (entity as Release).date?.startsWith(clause.value) ?? false;
    case 'format':
      return entity => (entity as Release).media.some(medium => medium.format === clause.value);
    default:
      return null;
  }
}

export function translateRelease(clauses: QueryClause[]): TranslatedSearch {
  return buildSearch(clauses, {
    textFields: RELEASE_TEXT_FIELDS,
    textOf: entity => {
      const release = entity as Release;
      return `${release.title} ${release.artistCredits.map(credit => credit.name).join(' ')}`;
    },
    filterFor: releaseFilterFor,
  });
}

const RELEASE_GROUP_TEXT_FIELDS = [
  null,
  'releasegroup',
  'releasegroupaccent',
  'artist',
  'artistname',
];

function releaseGroupFilterFor(
  field: string,
  clause: QueryClause,
): ((entity: Entity) => boolean) | null {
  switch (field) {
    case 'rgid':
      return entity => (entity as ReleaseGroup).id === clause.value;
    case 'arid':
      return entity =>
        (entity as ReleaseGroup).artistCredits.some(credit => credit.artistId === clause.value);
    case 'reid':
      return entity =>
        (entity as ReleaseGroup).releases.some(release => release.id === clause.value);
    case 'type':
    case 'primarytype':
      return entity =>
        (entity as ReleaseGroup).primaryType?.toLowerCase() === clause.value.toLowerCase();
    case 'secondarytype':
      return entity =>
        (entity as ReleaseGroup).secondaryTypes.some(
          type => type.toLowerCase() === clause.value.toLowerCase(),
        );
    case 'firstreleasedate':
      return entity => (entity as ReleaseGroup).firstReleaseDate?.startsWith(clause.value) ?? false;
    default:
      return null;
  }
}

export function translateReleaseGroup(clauses: QueryClause[]): TranslatedSearch {
  return buildSearch(clauses, {
    textFields: RELEASE_GROUP_TEXT_FIELDS,
    textOf: entity => {
      const group = entity as ReleaseGroup;
      return `${group.title} ${group.artistCredits.map(credit => credit.name).join(' ')}`;
    },
    filterFor: releaseGroupFilterFor,
  });
}
