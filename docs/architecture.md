# Architecture

This document explains how ytmbrainz is put together: the layers, the data flow
from an HTTP request to a YouTube Music call, and the design decisions behind the
MBID store and the reliability wrappers.

## Layers

The codebase is split into six layers under `src/`, each with a single job:

```
request
  │
  ▼
src/ws/        routing, params, formats, errors, services (per-entity handlers)
src/caa/       Cover Art Archive routes: index JSON + 307 artwork redirects
  │
  ▼
src/query/     Lucene query parsing + translation to upstream calls / local filters
  │
  ▼
src/mappers/   YouTube shapes  ->  normalized entity model (src/core/entities.ts)
  │
  ▼
src/adapters/  the YouTubeSource interface + the youtube.js (InnerTube) adapter
  │
  ▼
src/server/    reliability wrappers around the source: cache, rate limit, retry
  │
  ▼
YouTube Music (InnerTube)
```

| Layer           | Files                     | Responsibility                                   |
| --------------- | ------------------------- | ------------------------------------------------ |
| `src/core`      | `entities.ts`, `mbid.ts`, `config.ts`, `potoken.ts` | entity model, MBID generation + store, env config, PO token lifecycle |
| `src/ws`        | `app.ts`, `router.ts`, `params.ts`, `format.ts`, `errors.ts`, `inc.ts`, `services/*` | HTTP surface: routing, query params, formats, error shapes, per-entity handlers |
| `src/caa`       | `router.ts`, `artwork.ts`, `handler.ts` | Cover Art Archive compatible cover routes backed by album art |
| `src/query`     | `parser.ts`, `translate.ts` | Lucene tokenizer/parser, and translation of clauses into search text + local filters |
| `src/mappers`   | `artist.ts`, `recording.ts`, `release.ts`, `releaseGroup.ts`, `url.ts`, `credit.ts`, `type.ts` | map normalized YouTube shapes to the entity model |
| `src/adapters`  | `innertube.ts`, `http.ts`, `bgutils.ts`, `source.ts`, `types.ts`, `errors.ts`, `fake.ts` | the `YouTubeSource` boundary, the InnerTube adapter, browser-impersonating HTTP client, PO token minter, and a fake for tests |
| `src/server`    | `cache.ts`, `rateLimit.ts`, `retry.ts`, `httpRateLimit.ts` | caching, rate limiting, retries — wrapped around the source |
| `src/serializers` | `json.ts`, `xml.ts`      | entity model -> MusicBrainz JSON / MMD-2.0 XML |

## Request lifecycle

1. **Entry** — `src/index.ts` wires the layers together and starts `Bun.serve`.
   Before anything else, a per-IP HTTP rate limiter (`server/httpRateLimit.ts`)
   rejects requests over the configured limit with a 503.

2. **Routing** — `ws/router.ts` parses the path (`/ws/2/<entity>[/<mbid>]`) and
   `ws/app.ts` dispatches to the right entity service. Non-GET methods get a 405,
   unknown paths a 404.

3. **Format** — `ws/format.ts` resolves XML (default) or JSON from `fmt=` first,
   then the `Accept` header.

4. **Services** — each entity has a handler in `ws/services/` implementing
   `search`, `browse`, and `lookup`:
   - **search** parses the Lucene query (`query/parser.ts`), translates it
     (`query/translate.ts`) into (a) text to send to YouTube search and (b) a
     local filter that refines the results, since YouTube's search is fuzzy.
     Filters implement everything YouTube can't express: `arid:`, `reid:`,
     `rgid:`, `dur:` ranges, `video:`, primary/secondary types, dates.
   - **browse** resolves the linked MBID through the store and lists the
     related entities from the upstream artist/album page.
   - **lookup** resolves the MBID to a YouTube ID through the store, fetches
     the entity, and applies `inc=` subqueries.

5. **Mapping** — `mappers/*` turn raw YouTube responses into the normalized
   entity model (`core/entities.ts`). Everything has an MBID here; every MBID
   handed out is registered in the store.

6. **Serialization** — `serializers/json.ts` and `serializers/xml.ts` render
   entities as MusicBrainz JSON or MMD-2.0 XML.

7. **Errors** — `ws/errors.ts` renders MusicBrainz-shaped errors
   (`<error><text>…</text></error>` in XML, `{ "error": …, "help": … }` in JSON)
   with matching status codes.

## The source pipeline

The real adapter (`adapters/innertube.ts`) talks to YouTube Music through
youtube.js with `ClientType.MUSIC` — no main-YouTube endpoints are used. It is
wrapped by three decorators in `src/index.ts`, innermost first:

```
CachingSource(RetryingSource(RateLimitedSource(InnerTubeSource)))
```

Before the first upstream call the InnerTube adapter bootstraps a real visitor
data from YouTube and mints a Proof of Origin token bound to it, then recreates
the session whenever the token is refreshed (`adapters/bgutils.ts` mints tokens
via BotGuard, `core/potoken.ts` caches and auto-refreshes them). Every outbound
request — the InnerTube session, the bootstrap session, and the BotGuard
attestation — is sent through `adapters/http.ts`, a browser-impersonating
(Chrome TLS fingerprint via impit) fetch client.

1. **`RateLimitedSource`** — serializes all upstream calls through one queue so
   no two requests hit YouTube closer than `YTMB_YT_RATE_LIMIT_MS` apart. The
   InnerTube adapter paces continuation page fetches with the same interval, so
   a paged search does not burst requests at YouTube.
2. **`RetryingSource`** — retries transient failures (network errors, 429, 5xx)
   with exponential backoff. Bot walls and missing entities pass through
   immediately.
3. **`CachingSource`** — caches responses per call signature for
   `YTMB_CACHE_TTL` seconds and coalesces identical in-flight requests into a
   single upstream call. Cache entries are bounded (1000) and pruned on
   overflow.

The HTTP handlers depend only on the `YouTubeSource` interface
(`adapters/source.ts`), which is why tests can swap in the fake adapter and
cover the entire stack without network access.

## Search translation

YouTube Music search is free-text only, so `query/translate.ts` splits every
Lucene query into two parts:

- **Search text** — the free-text terms that are forwarded to YouTube (title,
  artist, release fields). They are joined with spaces, since YouTube has no
  boolean operators.
- **Local filter** — a predicate over the entity model that enforces everything
  else: fielded clauses (`arid:`, `rgid:`), ranges (`dur:[a TO b]`), negations,
  and `AND`/`OR` combinations.

Unknown fields are dropped from the search text but their clauses still filter
locally where supported.

## MBIDs

MBIDs are UUID v5 values derived from the YouTube identifier under a
per-entity-type namespace (`core/mbid.ts`). This gives determinism: the same
YouTube video always maps to the same recording MBID on every server.

But UUID v5 is one-way — you cannot recover the YouTube ID from the MBID. So
`MbidStore` (SQLite via `bun:sqlite`) records every `mbid -> (entity, source_id)`
mapping the server hands out. That makes lookups (`/ws/2/recording/<mbid>`) and
browse links (`?artist=<mbid>`) resolvable, and because the store persists to
disk, MBIDs keep working across restarts.

## Testing

- **Unit tests** live next to their sources (`src/**/*.test.ts`) and run
  against the fake adapter — no network. 100% coverage (lines, functions,
  statements, branches) is enforced in `bunfig.toml`; `src/index.ts` (entry
  wiring) and `tests/` are excluded.
- **Live tests** in `tests/live` hit the real YouTube API. They run on a daily
  schedule in CI and locally via `bun run test:live`, and are skipped in normal
  runs.
