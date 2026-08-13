import { describe, expect, it } from 'bun:test';
import { ClientType, Innertube, YTNodes } from 'youtubei.js';

const runLive = Boolean(process.env.RUN_LIVE);

const createSession = () =>
  Innertube.create({
    client_type: ClientType.MUSIC,
    retrieve_player: false,
    generate_session_locally: true,
  });

describe.skipIf(!runLive)('innerTube smoke (live)', () => {
  it('creates a YTMUSIC session on Bun', async () => {
    const yt = await createSession();

    expect(yt.session.context.client.clientName).toBe('WEB_REMIX');
  }, 30_000);

  it('searches songs with durations', async () => {
    const yt = await createSession();
    const search = await yt.music.search('Boards of Canada Roygbiv', {
      type: 'song',
    });

    const songs = search.songs?.contents;
    expect(songs?.length).toBeGreaterThan(0);

    const song = songs?.first()?.as(YTNodes.MusicResponsiveListItem);
    expect(song?.title).toBeTruthy();
    expect(song?.duration?.seconds).toBeGreaterThan(0);
  }, 30_000);
});
