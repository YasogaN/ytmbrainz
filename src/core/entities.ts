/**
 * Internal, normalized entity model.
 *
 * Fields are always present and null where a value is unknown, mirroring how
 * MusicBrainz emits empty values. Serials (kebab-case JSON keys, XML element
 * order) are the serializer's concern, not this model's.
 */

export interface ArtistCredit {
  name: string;
  sortName: string;
  artistId: string;
  joinPhrase: string;
}

export interface Artist {
  id: string;
  name: string;
  sortName: string;
  type: string | null;
  country: string | null;
  disambiguation: string | null;
  ended: boolean;
  score: number | null;
}

export interface ReleaseRef {
  id: string;
  title: string;
  date: string | null;
}

export interface Recording {
  id: string;
  title: string;
  video: boolean;
  length: number | null;
  firstReleaseDate: string | null;
  disambiguation: string | null;
  artistCredits: ArtistCredit[];
  releases: ReleaseRef[];
  score: number | null;
}

export interface Track {
  id: string;
  number: string;
  title: string;
  length: number | null;
  artistCredits: ArtistCredit[];
}

export interface Medium {
  position: number;
  format: string;
  trackCount: number;
  tracks: Track[];
}

export interface ReleaseGroupRef {
  id: string;
  primaryType: string | null;
  secondaryTypes: string[];
  title: string;
}

export interface Release {
  id: string;
  title: string;
  status: string | null;
  date: string | null;
  country: string | null;
  barcode: string | null;
  asin: string | null;
  artistCredits: ArtistCredit[];
  media: Medium[];
  releaseGroup: ReleaseGroupRef | null;
  score: number | null;
}

export interface ReleaseGroup {
  id: string;
  title: string;
  primaryType: string | null;
  secondaryTypes: string[];
  firstReleaseDate: string | null;
  disambiguation: string | null;
  artistCredits: ArtistCredit[];
  releases: ReleaseRef[];
  score: number | null;
}

export interface Url {
  id: string;
  resource: string;
  score: number | null;
}

export type Entity = Artist | Recording | Release | ReleaseGroup | Url;
