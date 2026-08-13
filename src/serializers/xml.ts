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

type Attrs = Record<string, string | number | null>;

const MMD_NS = 'http://musicbrainz.org/ns/mmd-2.0#';
const EXT_NS = 'http://musicbrainz.org/ns/ext#-2.0';

function esc(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}

function attrs(map: Attrs): string {
  return Object.entries(map)
    .filter(([, value]) => value !== null)
    .map(([key, value]) => ` ${key}="${esc(String(value))}"`)
    .join('');
}

function textEl(name: string, value: string): string {
  return `<${name}>${esc(value)}</${name}>`;
}

function el(name: string, attributes: Attrs, children: string): string {
  const prefix = `<${name}${attrs(attributes)}`;
  if (children === '') {
    return `${prefix}/>`;
  }
  return `${prefix}>${children}</${name}>`;
}

function artistElement(artist: { id: string; name: string; sortName: string }): string {
  const children = textEl('name', artist.name) + textEl('sort-name', artist.sortName);
  return el('artist', { id: artist.id }, children);
}

function artistCreditXml(credits: ArtistCredit[]): string {
  const children = credits
    .map(credit => {
      const nameCredit =
        textEl('name', credit.name) +
        artistElement({
          id: credit.artistId,
          name: credit.name,
          sortName: credit.sortName,
        });
      return el(
        'name-credit',
        { joinphrase: credit.joinPhrase === '' ? null : credit.joinPhrase },
        nameCredit,
      );
    })
    .join('');
  return el('artist-credit', {}, children);
}

function releaseRefXml(release: ReleaseRef): string {
  const children =
    textEl('title', release.title) + (release.date === null ? '' : textEl('date', release.date));
  return el('release', { id: release.id }, children);
}

function releaseListXml(releases: ReleaseRef[]): string {
  return el('release-list', { count: releases.length }, releases.map(releaseRefXml).join(''));
}

function trackXml(track: Track): string {
  const children = textEl('number', track.number) + textEl('title', track.title);
  const withLength =
    track.length === null ? children : children + textEl('length', String(track.length));
  return el('track', { id: track.id }, withLength);
}

function mediumXml(medium: Medium): string {
  const children =
    textEl('position', String(medium.position)) +
    textEl('format', medium.format) +
    el('track-list', { count: medium.trackCount, offset: 0 }, medium.tracks.map(trackXml).join(''));
  return el('medium', { id: medium.id }, children);
}

function mediumListXml(media: Medium[]): string {
  const trackCount = media.reduce((sum, medium) => sum + medium.trackCount, 0);
  const children = textEl('track-count', String(trackCount)) + media.map(mediumXml).join('');
  return el('medium-list', { count: media.length }, children);
}

function releaseGroupRefXml(group: ReleaseGroupRef): string {
  const children = textEl('title', group.title);
  const withTypes =
    children +
    (group.primaryType === null ? '' : textEl('primary-type', group.primaryType)) +
    (group.secondaryTypes.length === 0
      ? ''
      : el(
          'secondary-type-list',
          {},
          group.secondaryTypes.map(type => textEl('secondary-type', type)).join(''),
        ));
  return el('release-group', { id: group.id }, withTypes);
}

function artistXml(artist: Artist): string {
  const children =
    textEl('name', artist.name) +
    textEl('sort-name', artist.sortName) +
    (artist.country === null ? '' : textEl('country', artist.country)) +
    (artist.disambiguation === null ? '' : textEl('disambiguation', artist.disambiguation)) +
    el('life-span', {}, textEl('ended', artist.ended ? 'true' : 'false'));
  return el('artist', { id: artist.id, type: artist.type, 'ns2:score': artist.score }, children);
}

function recordingXml(recording: Recording): string {
  const children =
    textEl('title', recording.title) +
    (recording.length === null ? '' : textEl('length', String(recording.length))) +
    (recording.disambiguation === null ? '' : textEl('disambiguation', recording.disambiguation)) +
    (recording.video ? textEl('video', 'true') : '') +
    artistCreditXml(recording.artistCredits) +
    (recording.firstReleaseDate === null
      ? ''
      : textEl('first-release-date', recording.firstReleaseDate)) +
    (recording.releases.length === 0 ? '' : releaseListXml(recording.releases));
  return el('recording', { id: recording.id, 'ns2:score': recording.score }, children);
}

function releaseXml(release: Release): string {
  const children =
    textEl('title', release.title) +
    (release.status === null ? '' : textEl('status', release.status)) +
    artistCreditXml(release.artistCredits) +
    (release.releaseGroup === null ? '' : releaseGroupRefXml(release.releaseGroup)) +
    (release.date === null ? '' : textEl('date', release.date)) +
    (release.country === null ? '' : textEl('country', release.country)) +
    (release.date === null
      ? ''
      : el(
          'release-event-list',
          { count: 1 },
          el('release-event', {}, textEl('date', release.date)),
        )) +
    (release.barcode === null ? '' : textEl('barcode', release.barcode)) +
    mediumListXml(release.media);
  return el('release', { id: release.id, 'ns2:score': release.score }, children);
}

function releaseGroupXml(group: ReleaseGroup): string {
  const children =
    textEl('title', group.title) +
    (group.disambiguation === null ? '' : textEl('disambiguation', group.disambiguation)) +
    (group.firstReleaseDate === null ? '' : textEl('first-release-date', group.firstReleaseDate)) +
    (group.primaryType === null ? '' : textEl('primary-type', group.primaryType)) +
    (group.secondaryTypes.length === 0
      ? ''
      : el(
          'secondary-type-list',
          {},
          group.secondaryTypes.map(type => textEl('secondary-type', type)).join(''),
        )) +
    artistCreditXml(group.artistCredits) +
    (group.releases.length === 0 ? '' : releaseListXml(group.releases));
  return el('release-group', { id: group.id, 'ns2:score': group.score }, children);
}

function urlXml(url: Url): string {
  return el('url', { id: url.id, 'ns2:score': url.score }, textEl('resource', url.resource));
}

function entityToXml(entity: Entity): string {
  switch (entity.entity) {
    case 'artist':
      return artistXml(entity);
    case 'recording':
      return recordingXml(entity);
    case 'release':
      return releaseXml(entity);
    case 'release-group':
      return releaseGroupXml(entity);
    case 'url':
      return urlXml(entity);
  }
}

function metadataXml(created: string, inner: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><metadata created="${esc(created)}" xmlns="${MMD_NS}" xmlns:ns2="${EXT_NS}">${inner}</metadata>`;
}

export function listToXml(
  created: string,
  listName: string,
  items: Entity[],
  offset: number,
  count = items.length,
): string {
  const inner = items.map(entityToXml).join('');
  return metadataXml(created, el(listName, { count, offset }, inner));
}

export function lookupToXml(created: string, entity: Entity): string {
  return metadataXml(created, entityToXml(entity));
}
