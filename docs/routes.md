# MusicBrainz API surface

This server implements the MusicBrainz `/ws/2` web service backed by YouTube
Music. Responses match the MusicBrainz XML (MMD-2.0) and JSON shapes.

## Formats

- XML is the default (`application/xml`).
- JSON: add `fmt=json` or send `Accept: application/json`.
- `fmt=` takes precedence over the Accept header.

## Errors

Errors use the MusicBrainz error shape with matching HTTP status codes:

| Status | Meaning                                   |
| ------ | ----------------------------------------- |
| 400    | Malformed request (bad mbid, inc, query)  |
| 404    | Unknown entity, MBID, or resource         |
| 405    | Non-GET request                           |
| 503    | Upstream (YouTube) failure                |

```xml
<?xml version="1.0" encoding="UTF-8"?>
<error><text>Invalid mbid.</text><text>https://musicbrainz.org/development/mmd</text></error>
```

```json
{"help": "https://musicbrainz.org/development/mmd", "error": "Invalid mbid."}
```

## Routes

### Recording

```
GET /ws/2/recording?query=<lucene>
GET /ws/2/recording/<mbid>
GET /ws/2/recording?artist=<mbid>       browse
GET /ws/2/recording?release=<mbid>      browse
```

Search fields: `recording`, `artist`, `artistname`, `release`, `dur`
(range), `arid`, `reid`, `video`. Example:

```
GET /ws/2/recording?query=recording:"Roygbiv" AND artist:"Boards of Canada"&fmt=json
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
      "video": false,
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
      "releases": [
        {
          "id": "c3d09e10-...",
          "title": "Music Has the Right to Children",
          "date": "1998"
        }
      ]
    }
  ]
}
```

```xml
<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<metadata created="2026-08-14T00:00:00.000Z" xmlns="http://musicbrainz.org/ns/mmd-2.0#" xmlns:ns2="http://musicbrainz.org/ns/ext#-2.0">
  <recording-list count="1" offset="0">
    <recording id="9f47e23c-..." ns2:score="100">
      <title>Roygbiv</title>
      <length>148000</length>
      <artist-credit>
        <name-credit>
          <name>Boards of Canada</name>
          <artist id="b1a0f4a5-...">
            <name>Boards of Canada</name>
            <sort-name>Boards of Canada</sort-name>
          </artist>
        </name-credit>
      </artist-credit>
      <first-release-date>1998</first-release-date>
      <release-list count="1">
        <release id="c3d09e10-...">
          <title>Music Has the Right to Children</title>
          <date>1998</date>
        </release>
      </release-list>
    </recording>
  </recording-list>
</metadata>
```

### Artist

```
GET /ws/2/artist?query=<lucene>
GET /ws/2/artist/<mbid>
```

Search fields: `artist`, `alias`, `sortname`, `arid`, `ended`.

```json
{
  "created": "2026-08-14T00:00:00.000Z",
  "count": 1,
  "offset": 0,
  "artists": [
    {
      "id": "b1a0f4a5-...",
      "name": "Boards of Canada",
      "sort-name": "Boards of Canada",
      "life-span": { "ended": false }
    }
  ]
}
```

### Release

```
GET /ws/2/release?query=<lucene>
GET /ws/2/release/<mbid>
GET /ws/2/release?artist=<mbid>          browse
GET /ws/2/release?release-group=<mbid>   browse
```

Search fields: `release`, `releaseaccent`, `artist`, `reid`, `arid`,
`rgid`, `primarytype`, `secondarytype`, `date`, `format`. A release lookup
includes the full track list:

```json
{
  "created": "2026-08-14T00:00:00.000Z",
  "id": "c3d09e10-...",
  "title": "Music Has the Right to Children",
  "date": "1998",
  "release-events": [{ "date": "1998", "area": null }],
  "artist-credit": [
    {
      "name": "Boards of Canada",
      "artist": { "id": "b1a0f4a5-...", "name": "Boards of Canada", "sort-name": "Boards of Canada" }
    }
  ],
  "media": [
    {
      "id": "...",
      "position": 1,
      "format": "Digital Media",
      "track": [
        { "id": "9f47e23c-...", "number": "1", "title": "Roygbiv", "length": 148000 }
      ],
      "track-count": 2,
      "track-offset": 0
    }
  ],
  "release-group": {
    "id": "...",
    "primary-type": "Single",
    "secondary-types": [],
    "title": "Music Has the Right to Children"
  }
}
```

### Release Group

```
GET /ws/2/release-group?query=<lucene>
GET /ws/2/release-group/<mbid>
GET /ws/2/release-group?artist=<mbid>   browse
```

Search fields: `releasegroup`, `artist`, `rgid`, `arid`, `reid`, `type`,
`primarytype`, `secondarytype`, `firstreleasedate`.

### URL

```
GET /ws/2/url?resource=<url>
GET /ws/2/url/<mbid>
GET /ws/2/url?query=<lucene>
```

A `resource` lookup maps a YouTube URL to an entity through a relation:

```
GET /ws/2/url?resource=https://www.youtube.com/watch?v=dQw4w9WgXcQ&fmt=json
```

```json
{
  "created": "2026-08-14T00:00:00.000Z",
  "resource": "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "relations": [
    {
      "type": "recording",
      "target": "9f47e23c-...",
      "direction": "backward",
      "recording": { "id": "9f47e23c-...", "title": "Roygbiv", "length": 148000 }
    }
  ],
  "id": "..."
}
```

Recognized URL shapes:

- `youtube.com/watch?v=<videoId>` and `youtu.be/<videoId>` -> recording
- `youtube.com/channel/UC...` -> artist
- `youtube.com/album/MPREb_...` -> release

## MBIDs

MBIDs are deterministic UUID v5 values derived from the underlying YouTube
identifier (per entity type). They are stable across restarts thanks to the
persistent `bun:sqlite` mapping store, so lookups keep working after a search
or browse first serves the entity.

## Paging

`limit` (default 25, max 100) and `offset` apply to search and browse.
`count` in responses reflects the total number of matches, not the page size.

## inc=

Lookups accept `inc=` with the values valid for that entity (e.g. `releases`,
`artist-credits`, `url-rels`). Values outside the per-entity allowlist return
400.
