# MusicBrainz API compatibility

ytmbrainz implements a **subset** of the MusicBrainz `/ws/2` web service. This page
documents exactly what is implemented, what is accepted but empty, and what is not
implemented — and why. The root cause for most gaps is simple: **YouTube Music simply
does not have that data**, and ytmbrainz will not invent values just to make a response
look complete.

## Implemented

| Entity          | Search | Lookup        | Browse                     |
| --------------- | ------ | ------------- | -------------------------- |
| `recording`     | yes    | `/recording/<mbid>` | `?artist=<mbid>`, `?release=<mbid>` |
| `artist`        | yes    | `/artist/<mbid>`    | —                          |
| `release`       | yes    | `/release/<mbid>`   | `?artist=<mbid>`, `?release-group=<mbid>` |
| `release-group` | yes    | `/release-group/<mbid>` | `?artist=<mbid>`    |
| `url`           | yes    | `/url/<mbid>`, `?resource=<url>` | —        |

Also implemented: XML (MMD-2.0) and JSON output with `fmt=` / `Accept` negotiation,
MusicBrainz-shaped errors (400/404/405/503), `limit`/`offset` paging, `inc=`
subqueries, Lucene search syntax (see [docs/routes.md](routes.md)),
[Cover Art Archive compatible routes](caa.md) for release and release-group
covers, and a `/health` endpoint.

## Accepted but empty

Some MusicBrainz fields and `inc=` values exist in responses for client
compatibility but are always empty, because YouTube Music provides no such data:

| Field / `inc=` value        | Why it's empty                                             |
| --------------------------- | ---------------------------------------------------------- |
| `aliases`                   | YTM has no artist/track alias data                          |
| `tags`, `user-tags`         | YTM has no tag system                                       |
| `ratings`, `user-ratings`   | YTM exposes no ratings                                      |
| `genres`, `user-genres`     | YTM exposes no per-entity genres (verified: youtube.js v18 parses no genre data at all) |
| `annotation`                | YTM has no editorial annotation field                       |
| `isrcs`                     | YTM does not expose ISRCs (verified: youtube.js v18 has no ISRC support anywhere) |
| `*-rels` (artist-, url-, etc. relation lists) | YTM exposes no MusicBrainz-style relation graph |
| `video` (recording)         | always `false`; YTM search doesn't reveal whether a track is a music video |
| `barcode`, `asin`           | physical-media-only data; YTM is digital                    |
| `country` (release/artist)  | YTM has no geography for entities                           |
| `status` (release)          | YTM has no "official vs bootleg" status                     |
| `disambiguation`            | YTM has no disambiguation comments                          |
| `life-span` dates           | only `ended: false` is emitted; YTM has no begin/end dates  |
| `release-events[].area`     | always `null`; YTM has no release geography                 |
| `discids`, media format detail | always one `Digital Media` medium; no CD/TOC data        |

If a client requires these fields to be populated, ytmbrainz cannot provide them —
they would have to come from MusicBrainz itself.

## Not implemented

These MusicBrainz endpoints do not exist here and return 404:

| Endpoint              | Why YTM can't back it                                   |
| --------------------- | ------------------------------------------------------ |
| `/ws/2/label`         | YTM has no record-label data                           |
| `/ws/2/work`          | YTM has no composition/work entity                     |
| `/ws/2/area`, `/ws/2/place` | YTM has no geography                              |
| `/ws/2/series`        | no concept in YTM                                      |
| `/ws/2/event`         | YTM has no live-event/concert data                     |
| `/ws/2/instrument`    | YTM exposes no instrument credits                      |
| `/ws/2/genre`         | no public genre taxonomy                               |
| `/ws/2/collection`    | no user accounts/collections                           |
| `/ws/2/artist-credit` (direct lookup) | credits only appear inline on entities   |
| `/ws/2/isrc`          | ISRCs are not exposed by the YT Music client           |
| `/ws/2/discid`, `/ws/2/cd-toc`, `/ws/2/cdstub` | physical-media/CD data; YTM is digital |
| `/ws/2/release?barcode=`, `/ws/2/release?asin=` | no barcode/ASIN data                    |
| `/ws/2/tag`, `/ws/2/rating` (user endpoints) | no authenticated user concept            |

### Cover art

MusicBrainz serves covers through a **separate** service, the
[Cover Art Archive](https://coverartarchive.org), not through `/ws/2` — so no
images ever appear in ytmbrainz's `/ws/2` responses either.

ytmbrainz implements CAA-compatible routes itself, backed by the album art
YouTube Music returns: `/release/{mbid}/front`, `/release/{mbid}/{id}`,
`/release/{mbid}/{id}-{250|500|1200}`, the JSON image index, and the
`/release-group/{mbid}` equivalents. See [docs/caa.md](caa.md) for the full
reference.

Two things to know:

- **Only front covers.** YouTube Music returns front cover art (and artist
  avatars, track art, and search thumbnails). It has no back, booklet, disc, or
  tray images, so those CAA routes return 404.
- **Real CAA lookups will never resolve.** The real `coverartarchive.org` is
  keyed by MusicBrainz MBIDs, and ytmbrainz MBIDs are UUID v5 values derived
  from YouTube IDs — they will never match IDs in the real MusicBrainz/CAA
  databases. Clients must be pointed at ytmbrainz's own CAA routes (or a
  reverse proxy in front of them) to get covers for ytmbrainz-only entities.

## Behavioral differences from musicbrainz.org

Even on implemented routes, some semantics differ:

- **Search matching** — YouTube Music search is free-text and fuzzy. ytmbrainz sends
  the text terms to YouTube and then applies the fielded Lucene clauses
  (`arid:`, `dur:[a TO b]`, etc.) as a local filter over the returned page. Results
  can therefore differ from MusicBrainz's full-text index.
- **Paging** — `count` is the number of matches in the fetched window (capped at
  200 items), not the true total number of matches. YouTube search does not expose
  reliable totals. `offset`+`limit` beyond 200 returns the tail of the 200-item
  window.
- **Scores** — `score` is synthetic (`100 - index`); YouTube returns no relevance
  score.
- **Release-group primary types** — inferred from track count: ≤3 tracks = Single,
  4-6 = EP, otherwise Album. YTM does not label these.
- **MBIDs** — deterministic UUID v5 derived from YouTube identifiers, stable across
  restarts thanks to the SQLite store, but unrelated to musicbrainz.org MBIDs.
- **`release-group` vs `release`** — YTM albums map to both a release and a
  release-group with the same source ID; there is no distinction between editions
  of an album.
