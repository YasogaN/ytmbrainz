export type CaaEntityType = 'release' | 'release-group';

export type CaaSize = 250 | 500 | 1200;

export type CaaRoute =
  | { entity: CaaEntityType; mbid: string; variant: 'index' }
  | { entity: CaaEntityType; mbid: string; variant: 'front'; size: CaaSize | null }
  | { entity: CaaEntityType; mbid: string; variant: 'back'; size: CaaSize | null }
  | { entity: CaaEntityType; mbid: string; variant: 'image'; id: string; size: CaaSize | null };

const SIZE_SUFFIX = /-(250|500|1200)$/;
const JPG_SUFFIX = /\.jpg$/i;

function parseEntity(segment: string | undefined): CaaEntityType | null {
  return segment === 'release' || segment === 'release-group' ? segment : null;
}

function parseSize(raw: string): CaaSize | null {
  return raw === '250' || raw === '500' || raw === '1200'
    ? (Number.parseInt(raw, 10) as CaaSize)
    : null;
}

function parseImageSpec(spec: string): { id: string; size: CaaSize | null } | null {
  const withoutExtension = spec.replace(JPG_SUFFIX, '');
  const sized = SIZE_SUFFIX.exec(withoutExtension);
  if (sized !== null) {
    const id = withoutExtension.slice(0, sized.index);
    return id === '' ? null : { id, size: parseSize(sized[1] ?? '') };
  }
  return withoutExtension === '' ? null : { id: withoutExtension, size: null };
}

/**
 * Parses a Cover Art Archive style path into a route, or returns null when the
 * path does not look like a CAA request at all.
 */
export function parseCoverArtPath(pathname: string): CaaRoute | null {
  const segments = pathname.split('/').filter(segment => segment !== '');
  if (segments.length < 2 || segments.length > 3) {
    return null;
  }
  const entity = parseEntity(segments[0]);
  const mbid = segments[1];
  if (entity === null || mbid === undefined) {
    return null;
  }
  const spec = segments[2];
  if (spec === undefined) {
    return { entity, mbid, variant: 'index' };
  }
  if (spec === 'front') {
    return { entity, mbid, variant: 'front', size: null };
  }
  if (spec === 'back') {
    return { entity, mbid, variant: 'back', size: null };
  }
  const sizedFront = /^front-(250|500|1200)$/.exec(spec);
  if (sizedFront !== null) {
    return { entity, mbid, variant: 'front', size: parseSize(sizedFront[1] ?? '') };
  }
  const sizedBack = /^back-(250|500|1200)$/.exec(spec);
  if (sizedBack !== null) {
    return { entity, mbid, variant: 'back', size: parseSize(sizedBack[1] ?? '') };
  }
  if (spec.startsWith('front-') || spec.startsWith('back-')) {
    return null;
  }
  const image = parseImageSpec(spec);
  return image === null ? null : { entity, mbid, variant: 'image', ...image };
}
