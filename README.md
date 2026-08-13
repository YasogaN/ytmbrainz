# ytmbrainz

A MusicBrainz-compatible metadata server backed by YouTube Music (via
[youtube.js](https://github.com/LuanRT/YouTube.js) / InnerTube).

It exposes the MusicBrainz `/ws/2` web service API (XML and JSON) so existing
MusicBrainz clients — most importantly the new Last.fm Scrobbler, which needs
reliable track durations for niche and indie music — can be pointed at it.

## Stack

- [Bun](https://bun.sh) runtime and test runner (`bun test`)
- [TypeScript](https://www.typescriptlang.org) in strict mode
- [Biome](https://biomejs.dev) for linting and formatting
- [youtube.js](https://www.ytjs.dev) (InnerTube) as the data source
- `bun:sqlite` for the deterministic MBID store

## Scripts

| Command                | What it does                              |
| ---------------------- | ----------------------------------------- |
| `bun run dev`          | Start the server in watch mode            |
| `bun run start`        | Start the server                          |
| `bun run check`        | Biome lint and format check               |
| `bun run check:fix`    | Auto-fix lint and format issues           |
| `bun run typecheck`    | Type-check with `tsc --noEmit`            |
| `bun test`             | Run tests                                 |
| `bun test --coverage`  | Run tests with 100% coverage gate         |
| `bun run test:live`    | Run live tests against the real YouTube   |
| `bun run preflight`    | Everything: check + typecheck + coverage  |

## Configuration

Configuration is read from the environment:

| Variable                 | Default                | Description                     |
| ------------------------ | ---------------------- | ------------------------------- |
| `YTMB_HOST`              | `127.0.0.1`            | Bind address                    |
| `YTMB_PORT`              | `3000`                 | HTTP port                       |
| `YTMB_CACHE_TTL`         | `3600`                 | Upstream response TTL (seconds) |
| `YTMB_YT_RATE_LIMIT_MS`  | `1000`                 | Min interval between YT calls   |
| `YTMB_DB_PATH`           | `./data/ytmbrainz.db`  | MBID store (SQLite)             |

## Docker

```sh
docker build -t ytmbrainz .
docker run --rm -p 3000:3000 -v ytmbrainz-data:/app/data ytmbrainz
```

or with compose:

```sh
docker compose up -d
```

The image builds with the full preflight gate (lint, typecheck, tests,
100% coverage) and runs the server on `0.0.0.0:3000`.

## GitHub Actions

- `ci.yml` — lint, typecheck, and the coverage-gated test suite on every
  push/PR to `main`.
- `live.yml` — runs the live tests against YouTube on a schedule or manually.
- `docker.yml` — builds and pushes the image to GHCR on `main` and `v*` tags.

## API

See [docs/routes.md](docs/routes.md) for the implemented MusicBrainz
`/ws/2` routes with XML and JSON examples.

