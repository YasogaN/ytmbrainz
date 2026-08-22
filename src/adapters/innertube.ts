import { type Clients, ClientType, Innertube, type YTMusic, type YTNodes } from 'youtubei.js';
import { toNotFoundOrThrow } from '@/adapters/errors';
import type { YouTubeSource } from '@/adapters/source';
import type {
  YtAlbum,
  YtAlbumRef,
  YtArtist,
  YtArtistPage,
  YtImage,
  YtTrack,
} from '@/adapters/types';

export interface InnerTubeOptions {
  cookie?: string;
  visitorData?: string;
  poToken?: string;
  /** Minimum gap between continuation page fetches (ms). 0 disables pacing. */
  pageIntervalMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

interface RunLike {
  text: string;
  endpoint?: { payload?: { browseId?: string } };
}

interface ArtistLike {
  name: string;
  channel_id?: string;
}

interface TrackItemLike {
  id?: string;
  title?: string;
  item_type?: string;
  duration?: { seconds?: number };
  artists?: ArtistLike[];
  album?: { id?: string; name: string };
  year?: string;
}

interface AlbumRefItemLike {
  id?: string;
  title?: string;
  year?: string;
  artists?: ArtistLike[];
  author?: ArtistLike;
}

const NON_TRACK_TYPES = new Set(['album', 'artist', 'playlist']);

function runArtists(runs: RunLike[] | undefined): YtArtist[] {
  return (runs ?? [])
    .filter(run => run.endpoint?.payload?.browseId?.startsWith('UC'))
    .map(run => ({ id: run.endpoint?.payload?.browseId ?? null, name: run.text }));
}

function runYear(runs: RunLike[] | undefined): string | null {
  return runs?.find(run => /^[12][0-9]{3}$/.test(run.text))?.text ?? null;
}

function toYtArtists(artists: ArtistLike[] | undefined): YtArtist[] {
  return (artists ?? []).map(artist => ({
    id: artist.channel_id ?? null,
    name: artist.name,
  }));
}

function trackFromItem(item: TrackItemLike): YtTrack | null {
  if (item.id === undefined || item.title === undefined) {
    return null;
  }
  if (item.item_type !== undefined && NON_TRACK_TYPES.has(item.item_type)) {
    return null;
  }
  return {
    id: item.id,
    title: item.title,
    artists: toYtArtists(item.artists),
    album:
      item.album === undefined
        ? null
        : { id: item.album.id ?? null, name: item.album.name, artists: [], year: null },
    durationSeconds: item.duration?.seconds ?? null,
    year: item.year ?? null,
  };
}

function albumRefFromItem(item: AlbumRefItemLike): YtAlbumRef | null {
  if (item.id === undefined || item.title === undefined) {
    return null;
  }
  return {
    id: item.id,
    name: item.title,
    artists: toYtArtists(item.artists ?? (item.author === undefined ? [] : [item.author])),
    year: item.year ?? null,
  };
}

function artistFromItem(item: { id?: string; name?: string }): YtArtist | null {
  if (item.id === undefined || item.name === undefined) {
    return null;
  }
  return { id: item.id, name: item.name };
}

function isDetailHeader(
  header: YTNodes.MusicDetailHeader | YTNodes.MusicResponsiveHeader | undefined,
): header is YTNodes.MusicDetailHeader {
  return header?.type === 'MusicDetailHeader';
}

function isMusicShelf(
  section: YTNodes.MusicShelf | YTNodes.MusicCarouselShelf,
): section is YTNodes.MusicShelf {
  return section.type === 'MusicShelf';
}

function albumHeaderInfo(
  header: YTNodes.MusicDetailHeader | YTNodes.MusicResponsiveHeader | undefined,
): { name: string; artists: YtArtist[]; year: string | null; description: string | null } {
  const name = header?.title?.toString() ?? '';
  if (isDetailHeader(header)) {
    return {
      name,
      artists:
        header.author === undefined
          ? []
          : [
              {
                id: header.author.channel_id ?? null,
                name: header.author.name,
              },
            ],
      year: header.year || runYear(header.subtitle.runs),
      description: header.description?.toString() ?? null,
    };
  }
  return {
    name,
    artists: runArtists(header?.subtitle.runs),
    year: runYear(header?.subtitle.runs),
    description: null,
  };
}

function artworkOf(
  album: YTMusic.Album,
  header: YTNodes.MusicDetailHeader | YTNodes.MusicResponsiveHeader | undefined,
): YtImage[] {
  const thumbnails = isDetailHeader(header)
    ? header.thumbnails
    : (header?.thumbnail?.contents ?? album.background?.contents ?? []);
  return thumbnails
    .map(thumbnail => ({ url: thumbnail.url, width: thumbnail.width, height: thumbnail.height }))
    .filter(image => image.url !== '')
    .sort((a, b) => a.width - b.width);
}

function topTracksFromShelf(shelf: YTNodes.MusicShelf): YtTrack[] {
  if (shelf.title.toString().toLowerCase() !== 'top songs') {
    return [];
  }
  return shelf.contents
    .map(item => trackFromItem(item as unknown as TrackItemLike))
    .filter((track): track is YtTrack => track !== null);
}

function albumRefsFromCarousel(carousel: YTNodes.MusicCarouselShelf): YtAlbumRef[] {
  return carousel.contents
    .map(item => albumRefFromItem(item as unknown as AlbumRefItemLike))
    .filter((ref): ref is YtAlbumRef => ref !== null);
}

type SearchPage = YTMusic.Search | Awaited<ReturnType<YTMusic.Search['getContinuation']>>;

const MAX_PAGES = 10;

/**
 * Fetches search results across continuation pages until `limit` items are
 * collected (or the results are exhausted). The first page is the initial
 * search response; subsequent pages come from its continuation token, each
 * spaced by `pageIntervalMs` so a paged search does not burst requests at
 * YouTube.
 */
async function collectPages(
  search: YTMusic.Search,
  itemsOf: (page: SearchPage) => readonly unknown[] | undefined,
  limit: number,
  pageIntervalMs: number,
): Promise<unknown[]> {
  const items: unknown[] = [];
  let page: SearchPage = search;
  for (let guard = 0; guard < MAX_PAGES; guard += 1) {
    const chunk = itemsOf(page);
    if (chunk !== undefined) {
      for (const item of chunk) {
        items.push(item);
        if (items.length >= limit) {
          return items;
        }
      }
    }
    if (!page.has_continuation) {
      return items;
    }
    if (pageIntervalMs > 0) {
      await sleep(pageIntervalMs);
    }
    page = await page.getContinuation();
  }
  return items;
}

function shelfItemsOf(page: SearchPage, kind: 'song' | 'album' | 'artist') {
  if (kind === 'song' && 'songs' in page) {
    return page.songs?.contents;
  }
  if (kind === 'album' && 'albums' in page) {
    return page.albums?.contents;
  }
  if (kind === 'artist' && 'artists' in page) {
    return page.artists?.contents;
  }
  const continuation = page as Awaited<ReturnType<YTMusic.Search['getContinuation']>>;
  return continuation.contents?.contents;
}

/**
 * Fetches normalized metadata from YouTube Music through youtube.js.
 */
export class InnerTubeSource implements YouTubeSource {
  private readonly session: Promise<Innertube>;
  private readonly pageIntervalMs: number;

  constructor(options: InnerTubeOptions = {}) {
    this.pageIntervalMs = options.pageIntervalMs ?? 0;
    this.session = Innertube.create({
      client_type: ClientType.MUSIC,
      retrieve_player: false,
      generate_session_locally: true,
      ...(options.cookie !== undefined && { cookie: options.cookie }),
      ...(options.visitorData !== undefined && { visitor_data: options.visitorData }),
      ...(options.poToken !== undefined && { po_token: options.poToken }),
    });
  }

  private async musicClient(): Promise<Clients.Music> {
    const yt = await this.session;
    return yt.music;
  }

  async searchSongs(query: string, limit?: number): Promise<YtTrack[]> {
    const music = await this.musicClient();
    const search = await music.search(query, { type: 'song' });
    const pages = await collectPages(
      search,
      page => shelfItemsOf(page, 'song'),
      limit ?? Number.POSITIVE_INFINITY,
      this.pageIntervalMs,
    );
    return pages
      .map(item => trackFromItem(item as TrackItemLike))
      .filter((track): track is YtTrack => track !== null);
  }

  async searchAlbums(query: string, limit?: number): Promise<YtAlbumRef[]> {
    const music = await this.musicClient();
    const search = await music.search(query, { type: 'album' });
    const pages = await collectPages(
      search,
      page => shelfItemsOf(page, 'album'),
      limit ?? Number.POSITIVE_INFINITY,
      this.pageIntervalMs,
    );
    return pages
      .map(item => albumRefFromItem(item as AlbumRefItemLike))
      .filter((album): album is YtAlbumRef => album !== null);
  }

  async searchArtists(query: string, limit?: number): Promise<YtArtist[]> {
    const music = await this.musicClient();
    const search = await music.search(query, { type: 'artist' });
    const pages = await collectPages(
      search,
      page => shelfItemsOf(page, 'artist'),
      limit ?? Number.POSITIVE_INFINITY,
      this.pageIntervalMs,
    );
    return pages
      .map(item => artistFromItem(item as { id?: string; name?: string }))
      .filter((artist): artist is YtArtist => artist !== null);
  }

  async getAlbum(id: string): Promise<YtAlbum | null> {
    const music = await this.musicClient();
    let album: YTMusic.Album;
    try {
      album = await music.getAlbum(id);
    } catch (error) {
      return toNotFoundOrThrow(error);
    }
    const info = albumHeaderInfo(album.header);
    const tracks = album.contents
      .map(item => trackFromItem(item as unknown as TrackItemLike))
      .filter((track): track is YtTrack => track !== null);
    return {
      id,
      name: info.name,
      artists: info.artists,
      year: info.year,
      description: info.description,
      tracks,
      artwork: artworkOf(album, album.header),
    };
  }

  async getArtist(id: string): Promise<YtArtistPage | null> {
    const music = await this.musicClient();
    let artist: YTMusic.Artist;
    try {
      artist = await music.getArtist(id);
    } catch (error) {
      return toNotFoundOrThrow(error);
    }
    const name = artist.header?.title?.toString() ?? '';
    const albums: YtAlbumRef[] = [];
    const singles: YtAlbumRef[] = [];
    const topTracks: YtTrack[] = [];
    for (const section of artist.sections) {
      if (isMusicShelf(section)) {
        topTracks.push(...topTracksFromShelf(section));
        continue;
      }
      const kind = section.header?.title?.toString().toLowerCase();
      const refs = albumRefsFromCarousel(section);
      if (kind === 'albums') {
        albums.push(...refs);
      } else if (kind === 'singles') {
        singles.push(...refs);
      }
    }
    return { id, name, albums, singles, topTracks };
  }

  async getSong(id: string): Promise<YtTrack | null> {
    const music = await this.musicClient();
    let info: YTMusic.TrackInfo;
    try {
      info = await music.getInfo(id);
    } catch (error) {
      return toNotFoundOrThrow(error);
    }
    const basic = info.basic_info;
    return {
      id: basic.id ?? id,
      title: basic.title ?? '',
      artists:
        basic.author === undefined ? [] : [{ id: basic.channel_id ?? null, name: basic.author }],
      album: null,
      durationSeconds: basic.duration ?? null,
      year: null,
    };
  }
}
