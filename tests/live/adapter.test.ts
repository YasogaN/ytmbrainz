import { describe, expect, it } from 'bun:test';
import { InnerTubeSource } from '@/adapters/innertube';

const runLive = Boolean(process.env.RUN_LIVE);

const createSource = () => new InnerTubeSource();

describe.skipIf(!runLive)('InnerTubeSource (live)', () => {
  it('searches songs with durations and resolves the song detail', async () => {
    const source = createSource();

    const songs = await source.searchSongs('Boards of Canada Roygbiv');
    expect(songs.length).toBeGreaterThan(0);

    const first = songs[0];
    expect(first?.id).toBeTruthy();
    expect(first?.durationSeconds).toBeGreaterThan(0);

    const song = await source.getSong(first?.id ?? '');
    expect(song?.durationSeconds).toBeGreaterThan(0);
  }, 60_000);

  it('resolves an album and its tracks', async () => {
    const source = createSource();

    const albums = await source.searchAlbums('Boards of Canada Music Has the Right');
    expect(albums.length).toBeGreaterThan(0);

    const albumId = albums[0]?.id;
    expect(albumId).toBeTruthy();

    const album = await source.getAlbum(albumId ?? '');
    expect(album?.name).toBeTruthy();
    expect(album?.tracks.length).toBeGreaterThan(0);
  }, 60_000);

  it('resolves an artist page', async () => {
    const source = createSource();

    const artists = await source.searchArtists('Boards of Canada');
    expect(artists.length).toBeGreaterThan(0);

    const artistId = artists[0]?.id;
    expect(artistId).toBeTruthy();

    const artist = await source.getArtist(artistId ?? '');
    expect(artist?.name).toBe('Boards of Canada');
  }, 60_000);
});
