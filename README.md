# ytmbrainz

> **A MusicBrainz-compatible metadata server backed by YouTube Music.**
> Point any MusicBrainz `/ws/2` client at it and get real track, release, artist, and
> duration data for the long tail of music that only exists on YouTube.

[![CI](https://img.shields.io/github/actions/workflow/status/YasogaN/ytmbrainz/ci.yml?style=for-the-badge&label=CI)](https://github.com/YasogaN/ytmbrainz/actions/workflows/ci.yml)
[![Docker](https://img.shields.io/github/actions/workflow/status/YasogaN/ytmbrainz/docker.yml?style=for-the-badge&label=Docker)](https://github.com/YasogaN/ytmbrainz/actions/workflows/docker.yml)
[![Live tests](https://img.shields.io/github/actions/workflow/status/YasogaN/ytmbrainz/live.yml?style=for-the-badge&label=Live%20tests)](https://github.com/YasogaN/ytmbrainz/actions/workflows/live.yml)
[![Stars](https://img.shields.io/github/stars/YasogaN/ytmbrainz?style=for-the-badge)](https://github.com/YasogaN/ytmbrainz)
[![License](https://img.shields.io/badge/license-MIT-blue?style=for-the-badge)](LICENSE)

---

## What is this?

ytmbrainz implements the [MusicBrainz `/ws/2` web service API](https://musicbrainz.org/doc/MusicBrainz_API)
in front of YouTube Music (via [youtube.js](https://github.com/LuanRT/YouTube.js) / InnerTube).
It speaks the same XML (MMD-2.0) and JSON shapes as the real MusicBrainz server, so existing
clients work without modification — you just point them at a different URL.

The motivation: [Koito](https://koito.io) (and similar MusicBrainz-backed clients)
fill in covers and metadata from MusicBrainz. If you listen through YouTube Music and
you like indie and niche music, a lot of that data simply isn't in MusicBrainz — missing
covers, no artist/track metadata, and scrobble minutes that never get attributed. I hit
this after moving from Last.fm to Koito: thousands of scrobbled tracks resolved to
nothing. Those tracks are almost always on YouTube Music though, so ytmbrainz bridges
that gap: point your client's MusicBrainz server at it and the metadata shows up.

## Features

- Full `/ws/2` surface: search, lookup, and browse for **recordings**, **artists**,
  **releases**, **release-groups**, and **urls**
- Lucene query syntax — fielded terms, phrases, `AND`/`OR`/`NOT`, negation, and
  duration ranges like `dur:[200000 TO 400000]`
- XML (MMD-2.0) and JSON responses, `fmt=` or `Accept` header, MusicBrainz-compatible
  error shapes and status codes
- Deterministic UUID v5 MBIDs backed by a persistent SQLite store, so every MBID handed
  out keeps resolving across restarts
- YouTube URL resolution — paste a `watch?v=`, `youtu.be`, channel, or album link and
  get the linked entity
- `inc=` subqueries (artist discographies, release track lists, and more) with
  per-entity validation
- Cover Art Archive-compatible cover routes (`/release/<mbid>/front` and friends)
  served straight from YouTube Music's album art
- Built to not get banned: upstream caching with request coalescing, serialized
  YouTube rate limiting, retries with exponential backoff, and per-IP HTTP rate limiting
- Ships as a hardened Docker image: compiled single binary, non-root user, healthcheck
- 100% coverage enforced — lint, typecheck, and the coverage gate run in CI

## Stack

[![Bun](https://img.shields.io/badge/Bun-000000?style=for-the-badge&logo=bun&logoColor=white)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?style=for-the-badge&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Biome](https://img.shields.io/badge/Biome-60A5FA?style=for-the-badge&logo=biome&logoColor=white)](https://biomejs.dev/)
[![youtube.js](https://img.shields.io/badge/youtubei.js-FF0000?style=for-the-badge&logo=youtube&logoColor=white)](https://github.com/LuanRT/YouTube.js)
[![SQLite](https://img.shields.io/badge/SQLite-003B57?style=for-the-badge&logo=sqlite&logoColor=white)](https://www.sqlite.org/)

- [Bun](https://bun.sh) runtime and test runner (`bun test`) — Bun ≥ 1.2 required
- [TypeScript](https://www.typescriptlang.org) in strict mode
- [Biome](https://biomejs.dev) for linting and formatting
- [youtube.js](https://www.ytjs.dev) (InnerTube) as the data source — YouTube Music
  client only, no main-YouTube endpoints
- `bun:sqlite` for the persistent, deterministic MBID store

## Quick start

```sh
# prerequisites: Bun >= 1.2
git clone https://github.com/YasogaN/ytmbrainz.git
cd ytmbrainz
bun install
bun run dev          # starts on http://127.0.0.1:3000
```

Try it:

```sh
curl 'http://127.0.0.1:3000/ws/2/recording?query=recording:"Roygbiv" AND artist:"Boards of Canada"&fmt=json'
```

```json
{
  "created": "2026-08-14T00:00:00.000Z",
  "count": 1,
  "offset": 0,
  "recordings": [
    {
      "id": "9f47e23c-...",
      "score": 100,
      "title": "Roygbiv",
      "length": 148000,
      "artist-credit": [
        {
          "name": "Boards of Canada",
          "artist": {
            "id": "b1a0f4a5-...",
            "name": "Boards of Canada",
            "sort-name": "Boards of Canada"
          }
        }
      ],
      "first-release-date": "1998",
      "releases": [{ "id": "c3d09e10-...", "title": "Music Has the Right to Children", "date": "1998" }]
    }
  ]
}
```

## Scripts

| Command               | What it does                              |
| --------------------- | ----------------------------------------- |
| `bun run dev`         | Start the server in watch mode            |
| `bun run start`       | Start the server                          |
| `bun run check`       | Biome lint and format check               |
| `bun run check:fix`   | Auto-fix lint and format issues           |
| `bun run typecheck`   | Type-check with `tsc --noEmit`            |
| `bun test`            | Run tests                                 |
| `bun run test:coverage` | Run tests with 100% coverage gate       |
| `bun run test:watch`  | Run tests in watch mode                   |
| `bun run test:live`   | Run live tests against the real YouTube   |
| `bun run preflight`   | Everything: check + typecheck + coverage  |

The coverage gate is enforced in `bunfig.toml` — every file must hit 100% lines,
functions, statements, and branches (`src/index.ts` and `tests/` are excluded).

## Configuration

Configuration is read from the environment:

| Variable                 | Default                | Description                          |
| ------------------------ | ---------------------- | ------------------------------------ |
| `YTMB_HOST`              | `127.0.0.1`            | Bind address                         |
| `YTMB_PORT`              | `3000`                 | HTTP port                            |
| `YTMB_CACHE_TTL`         | `3600`                 | Upstream response TTL (seconds)      |
| `YTMB_YT_RATE_LIMIT_MS`  | `1000`                 | Min interval between YT calls        |
| `YTMB_YT_RETRIES`        | `2`                    | Retries for transient YT failures    |
| `YTMB_YT_BACKOFF_MS`     | `250`                  | Retry backoff base (exponential)     |
| `YTMB_HTTP_RATE_LIMIT`   | `10`                   | Per-IP requests/sec (0 disables)     |
| `YTMB_VISITOR_DATA`      | unset                  | Persistent InnerTube visitor data    |
| `YTMB_COOKIE`            | unset                  | YouTube cookies (for authenticated)  |
| `YTMB_PO_TOKEN`          | unset                  | Proof-of-origin token                |
| `YTMB_DB_PATH`           | `./data/ytmbrainz.db`  | MBID store (SQLite)                  |

YouTube may throw bot walls on unauthenticated requests. If that happens, provide
`YTMB_VISITOR_DATA` (and optionally `YTMB_COOKIE` / `YTMB_PO_TOKEN`) from your own
logged-in YouTube session.

## API

The following MusicBrainz `/ws/2` routes are implemented:

| Entity           | Search   | Lookup    | Browse |
| ---------------- | -------- | --------- | ------ |
| `recording`      | `query`  | `<mbid>`  | by `artist`, by `release` |
| `artist`         | `query`  | `<mbid>`  | —      |
| `release`        | `query`  | `<mbid>`  | by `artist`, by `release-group` |
| `release-group`  | `query`  | `<mbid>`  | by `artist` |
| `url`            | `query`  | `<mbid>` or `?resource=<url>` | — |

- **Formats**: XML is the default; add `fmt=json` or send `Accept: application/json`.
  `fmt=` takes precedence.
- **Paging**: `limit` (default 25, max 100) and `offset` on search and browse.
- **`inc=`**: lookups accept subqueries like `releases`, `recordings`,
  `artist-credits`, `url-rels`, and more — validated per entity.
- **Errors**: MusicBrainz-shaped errors with proper status codes (400, 404, 405, 503).

### Cover art

[Cover Art Archive](https://coverartarchive.org)-compatible routes are served for
release and release-group covers, backed by YouTube Music's album art:

```sh
curl -I http://127.0.0.1:3000/release/<mbid>/front       # 307 -> YTM album art
curl http://127.0.0.1:3000/release/<mbid>                # JSON image index
```

Front, sized (`-250`/`-500`/`-1200`), and per-image variants are supported under
both `/release/<mbid>` and `/release-group/<mbid>`. See [docs/caa.md](docs/caa.md).

See [docs/routes.md](docs/routes.md) for the full route reference with XML and JSON
examples, and [docs/architecture.md](docs/architecture.md) for how it works under the hood.

> **Not the whole MusicBrainz API.** YouTube Music has no labels, works, areas,
> genres, aliases, tags, or ISRCs, so those endpoints and fields are not (and
> can't be) implemented. See [docs/compatibility.md](docs/compatibility.md) for
> the full list of what is supported, what isn't, and why.

## Docker

```sh
docker build -t ytmbrainz .
docker run --rm -p 3000:3000 -v ytmbrainz-data:/app/data ytmbrainz
```

or with compose:

```sh
docker compose up -d
```

The image is built in three stages:

1. **deps** — installs with the frozen lockfile
2. **build** — runs the full preflight gate (lint, typecheck, 100% coverage tests),
   then compiles `src/index.ts` into a standalone binary
3. **runtime** — ships only the binary, runs as an unprivileged `ytmbrainz` user,
   with a `/health` healthcheck

Images are published to GHCR (`ghcr.io/YasogaN/ytmbrainz`) on every push to `main`
and on `v*` tags.

### Podman (rootless quadlet)

A ready-to-use rootless quadlet is provided in
[ytmbrainz.container](ytmbrainz.container) (requires Podman ≥ 4.4):

```sh
mkdir -p ~/.config/containers/systemd
cp ytmbrainz.container ~/.config/containers/systemd/
systemctl --user daemon-reload
systemctl --user enable --now ytmbrainz
```

Enable automatic image updates:

```sh
systemctl --user enable --now podman-auto-update.timer
```

The service runs as your user, keeps the MBID database in a named volume
(`ytmbrainz-data`), restarts on failure, and pulls fresh `ghcr.io/YasogaN/ytmbrainz:latest`
images on the update timer.

## CI/CD

| Workflow    | Trigger                       | What it does                                  |
| ----------- | ----------------------------- | --------------------------------------------- |
| `ci.yml`    | push/PR to `main`             | lint, typecheck, coverage-gated tests         |
| `live.yml`  | daily cron + manual dispatch  | live tests against the real YouTube API       |
| `docker.yml`| push to `main` + `v*` tags    | builds and pushes the image to GHCR           |

## Development

- **Commits**: [Conventional Commits](https://www.conventionalcommits.org/) are
  enforced by commitlint.
- **Hooks**: [lefthook](https://github.com/evilmartians/lefthook) installs
  automatically on `bun install` (`LEFTHOOK=0` to skip) and runs the same checks as CI
  before every commit.
- **Tests**: unit tests live next to their source files (`src/**/*.test.ts`); live tests
  that hit the real YouTube API live in `tests/live` and only run with `RUN_LIVE=1`.

## License

[MIT](LICENSE) © 2026 Yasoga Nanayakkarawasam
