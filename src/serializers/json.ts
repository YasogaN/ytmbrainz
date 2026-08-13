import type {
  Artist,
  ArtistCredit,
  Entity,
  Medium,
  Recording,
  Release,
  ReleaseGroup,
  ReleaseGroupRef,
  ReleaseRef,
  Track,
  Url,
} from '@/core/entities';

type JsonObject = Record<string, unknown>;

function artistCreditJson(credits: ArtistCredit[]): JsonObject[] {
  return credits.map(credit => ({
    name: credit.name,
    artist: {
      id: credit.artistId,
      name: credit.name,
      'sort-name': credit.sortName,
    },
    ...(credit.joinPhrase !== '' && { joinphrase: credit.joinPhrase }),
  }));
}

function releaseRefJson(release: ReleaseRef): JsonObject {
  return {
    id: release.id,
    title: release.title,
    ...(release.date !== null && { date: release.date }),
  };
}

function trackJson(track: Track): JsonObject {
  return {
    id: track.id,
    number: track.number,
    title: track.title,
    ...(track.length !== null && { length: track.length }),
  };
}

function mediumJson(medium: Medium): JsonObject {
  return {
    id: medium.id,
    position: medium.position,
    format: medium.format,
    track: medium.tracks.map(trackJson),
    'track-count': medium.trackCount,
    'track-offset': 0,
  };
}

function releaseGroupRefJson(group: ReleaseGroupRef): JsonObject {
  return {
    id: group.id,
    ...(group.primaryType !== null && { 'primary-type': group.primaryType }),
    'secondary-types': group.secondaryTypes,
    title: group.title,
  };
}

function artistJson(artist: Artist): JsonObject {
  return {
    id: artist.id,
    ...(artist.score !== null && { score: artist.score }),
    name: artist.name,
    'sort-name': artist.sortName,
    ...(artist.type !== null && { type: artist.type }),
    ...(artist.country !== null && { country: artist.country }),
    ...(artist.disambiguation !== null && { disambiguation: artist.disambiguation }),
    'life-span': { ended: artist.ended },
  };
}

function recordingJson(recording: Recording): JsonObject {
  return {
    id: recording.id,
    ...(recording.score !== null && { score: recording.score }),
    title: recording.title,
    ...(recording.length !== null && { length: recording.length }),
    ...(recording.video && { video: true }),
    ...(recording.disambiguation !== null && { disambiguation: recording.disambiguation }),
    'artist-credit': artistCreditJson(recording.artistCredits),
    ...(recording.firstReleaseDate !== null && {
      'first-release-date': recording.firstReleaseDate,
    }),
    ...(recording.releases.length > 0 && {
      releases: recording.releases.map(releaseRefJson),
    }),
  };
}

function releaseJson(release: Release): JsonObject {
  return {
    id: release.id,
    ...(release.score !== null && { score: release.score }),
    title: release.title,
    ...(release.status !== null && { status: release.status }),
    ...(release.date !== null && { date: release.date }),
    ...(release.country !== null && { country: release.country }),
    ...(release.date !== null && { 'release-events': [{ date: release.date, area: null }] }),
    ...(release.barcode !== null && { barcode: release.barcode }),
    ...(release.asin !== null && { asin: release.asin }),
    'artist-credit': artistCreditJson(release.artistCredits),
    media: release.media.map(mediumJson),
    ...(release.releaseGroup !== null && {
      'release-group': releaseGroupRefJson(release.releaseGroup),
    }),
  };
}

function releaseGroupJson(group: ReleaseGroup): JsonObject {
  return {
    id: group.id,
    ...(group.score !== null && { score: group.score }),
    title: group.title,
    ...(group.primaryType !== null && { 'primary-type': group.primaryType }),
    'secondary-types': group.secondaryTypes,
    ...(group.firstReleaseDate !== null && { 'first-release-date': group.firstReleaseDate }),
    ...(group.disambiguation !== null && { disambiguation: group.disambiguation }),
    'artist-credit': artistCreditJson(group.artistCredits),
    ...(group.releases.length > 0 && { releases: group.releases.map(releaseRefJson) }),
  };
}

function urlJson(url: Url): JsonObject {
  return {
    id: url.id,
    ...(url.score !== null && { score: url.score }),
    resource: url.resource,
    ...(url.relations.length > 0 && {
      relations: url.relations.map(relation => ({
        type: relation.type,
        target: relation.target,
        direction: relation.direction,
        [relation.entity.entity]: entityToJson(relation.entity),
      })),
    }),
  };
}

export function entityToJson(entity: Entity): JsonObject {
  switch (entity.entity) {
    case 'artist':
      return artistJson(entity);
    case 'recording':
      return recordingJson(entity);
    case 'release':
      return releaseJson(entity);
    case 'release-group':
      return releaseGroupJson(entity);
    case 'url':
      return urlJson(entity);
  }
}

export function searchToJson(
  created: string,
  key: string,
  items: Entity[],
  offset: number,
  count = items.length,
): JsonObject {
  return { created, count, offset, [key]: items.map(entityToJson) };
}

export function lookupToJson(created: string, entity: Entity): JsonObject {
  return { created, ...entityToJson(entity) };
}
