import { describe, expect, it } from 'bun:test';
import { makeApp, sharedSource } from './helpers';

const runLive = Boolean(process.env.RUN_LIVE);

describe.skipIf(!runLive)('url route (live)', () => {
  it('maps a watch URL to a recording', async () => {
    const { app, store } = makeApp(sharedSource);
    const songs = await sharedSource.searchSongs('Roygbiv Boards of Canada');
    const videoId = songs[0]?.id;
    expect(videoId).toBeTruthy();

    const response = await app(
      new Request(
        `http://localhost/ws/2/url?resource=${encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`)}&fmt=json`,
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      resource: string;
      relations: Array<{ type: string; recording: { title: string; length: number | null } }>;
    };
    expect(body.relations[0]?.type).toBe('recording');
    expect(body.relations[0]?.recording.length).toBeGreaterThan(0);
    store.close();
  }, 60_000);

  it('maps a channel URL to an artist', async () => {
    const { app, store } = makeApp(sharedSource);
    const artists = await sharedSource.searchArtists('Boards of Canada');
    const channelId = artists[0]?.id;
    expect(channelId).toBeTruthy();

    const response = await app(
      new Request(
        `http://localhost/ws/2/url?resource=${encodeURIComponent(`https://www.youtube.com/channel/${channelId}`)}&fmt=json`,
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      relations: Array<{ type: string; artist: { name: string } }>;
    };
    expect(body.relations[0]?.type).toBe('artist');
    expect(body.relations[0]?.artist.name).toBe('Boards of Canada');
    store.close();
  }, 60_000);

  it('maps an album URL to a release', async () => {
    const { app, store } = makeApp(sharedSource);
    const albums = await sharedSource.searchAlbums('Music Has the Right to Children');
    const albumId = albums[0]?.id;
    expect(albumId).toBeTruthy();

    const response = await app(
      new Request(
        `http://localhost/ws/2/url?resource=${encodeURIComponent(`https://music.youtube.com/album/${albumId}`)}&fmt=json`,
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      relations: Array<{ type: string; release: { title: string } }>;
    };
    expect(body.relations[0]?.type).toBe('release');
    expect(body.relations[0]?.release.title.toLowerCase()).toContain('music has');
    store.close();
  }, 60_000);

  it('finds a url entity from a url query', async () => {
    const { app, store } = makeApp(sharedSource);
    const songs = await sharedSource.searchSongs('Roygbiv');
    const videoId = songs[0]?.id;
    expect(videoId).toBeTruthy();
    const resource = `https://youtu.be/${videoId}`;

    const response = await app(
      new Request(
        `http://localhost/ws/2/url?query=${encodeURIComponent(`url:"${resource}"`)}&fmt=json`,
      ),
    );

    expect(response.status).toBe(200);
    const body = (await response.json()) as { count: number; urls: Array<{ resource: string }> };
    expect(body.count).toBe(1);
    expect(body.urls[0]?.resource).toBe(resource);
    store.close();
  }, 60_000);

  it('resolves a url by the MBID it served', async () => {
    const { app, store } = makeApp(sharedSource);
    const songs = await sharedSource.searchSongs('Roygbiv');
    const videoId = songs[0]?.id;
    expect(videoId).toBeTruthy();
    const resource = `https://www.youtube.com/watch?v=${videoId}`;

    const lookup = await app(
      new Request(`http://localhost/ws/2/url?resource=${encodeURIComponent(resource)}&fmt=json`),
    );
    const body = (await lookup.json()) as { id: string };
    expect(body.id).toBeTruthy();

    const response = await app(new Request(`http://localhost/ws/2/url/${body.id}?fmt=json`));
    expect(response.status).toBe(200);
    const roundTrip = (await response.json()) as { resource: string };
    expect(roundTrip.resource).toBe(resource);
    store.close();
  }, 60_000);
});
