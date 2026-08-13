export function inferPrimaryType(trackCount: number | null): string {
  if (trackCount === null) {
    return 'Album';
  }
  if (trackCount <= 3) {
    return 'Single';
  }
  if (trackCount <= 6) {
    return 'EP';
  }
  return 'Album';
}
