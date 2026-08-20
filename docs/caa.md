# Cover Art Archive compatible endpoints

ytmbrainz serves [Cover Art Archive](https://coverartarchive.org) (CAA) compatible
routes for releases and release groups, backed by the album art YouTube Music
returns (which the `/ws/2` API never includes). This lets CAA-speaking clients
resolve covers for releases that only exist in YouTube Music.

All paths live under `/release/{mbid}` and `/release-group/{mbid}`. MBIDs are
ytmbrainz's deterministic UUID v5 values — the same ones served by `/ws/2`.

## Endpoints

| Endpoint                                            | Response                                    |
| --------------------------------------------------- | ------------------------------------------- |
| `GET/HEAD /release/{mbid}[/]`                       | 200 JSON image index (single `Front` image) |
| `GET/HEAD /release/{mbid}/front`                    | 307 redirect to the largest artwork         |
| `GET/HEAD /release/{mbid}/front-{250\|500\|1200}`   | 307 redirect to a sized thumbnail           |
| `GET/HEAD /release/{mbid}/{id}[.jpg]`               | 307 redirect to the artwork                 |
| `GET/HEAD /release/{mbid}/{id}-{250\|500\|1200}[.jpg]` | 307 redirect to a sized thumbnail        |
| `GET/HEAD /release/{mbid}/back`, `/back-{size}`     | 404 — no back art exists in YouTube Music   |
| `GET/HEAD /release-group/{mbid}...`                 | same set, backed by the same album          |
| `OPTIONS` on any endpoint                           | 200 with `Allow: GET, HEAD, OPTIONS`        |

- `{id}` is a deterministic image id derived from the YouTube album id
  (`toMbid('image', <albumId>)` without dashes). It is stable across restarts.
- `{size}` is one of `250`, `500`, `1200`, matching CAA's thumbnail sizes.

## Behavior

- **Redirects** return `307` with a `Location` header pointing at the
  Google-hosted (`lh3.googleusercontent.com`) thumbnail URL. No image bytes
  pass through ytmbrainz.
- **Sizing** rewrites the `=wN-hN` segment of the thumbnail URL to the
  requested size when present, and falls back to the nearest available
  thumbnail otherwise. `/front` (no size) always uses the largest available
  artwork.
- **Errors**: `400` for malformed MBIDs, `404` for unknown MBIDs, wrong entity
  types, missing albums, albums without artwork, unknown image ids, and all
  `back` requests, `405` for non-GET/HEAD/OPTIONS methods.

## JSON index

```sh
curl http://127.0.0.1:3000/release/9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c
```

```json
{
  "images": [
    {
      "types": ["Front"],
      "front": true,
      "back": false,
      "comment": "",
      "approved": true,
      "id": "e6a4d2f0c9b84a1e9d3f5b7c8a2e0d4f",
      "image": "http://127.0.0.1:3000/release/9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c/e6a4d2f0c9b84a1e9d3f5b7c8a2e0d4f.jpg",
      "thumbnails": {
        "250": "http://127.0.0.1:3000/release/9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c/e6a4d2f0c9b84a1e9d3f5b7c8a2e0d4f-250.jpg",
        "500": "http://127.0.0.1:3000/release/9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c/e6a4d2f0c9b84a1e9d3f5b7c8a2e0d4f-500.jpg",
        "1200": "http://127.0.0.1:3000/release/9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c/e6a4d2f0c9b84a1e9d3f5b7c8a2e0d4f-1200.jpg",
        "small": "http://127.0.0.1:3000/release/9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c/e6a4d2f0c9b84a1e9d3f5b7c8a2e0d4f-250.jpg",
        "large": "http://127.0.0.1:3000/release/9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c/e6a4d2f0c9b84a1e9d3f5b7c8a2e0d4f-500.jpg"
      }
    }
  ],
  "release": "http://127.0.0.1:3000/release/9f47e23c-9a5e-4b6d-8a1f-3c2d1e0a5b7c"
}
```

For release groups, the `release` field and the image/thumbnail URLs point at
the underlying release MBID, mirroring the real CAA.

## Where the art comes from

`getAlbum` on the YouTube Music client returns album cover thumbnails in the
album header (`MusicDetailHeader.thumbnails`), with the responsive header and
the album background as fallbacks. The adapter exposes them as `artwork` on
`YtAlbum` (sorted by size), and the CAA routes pick and rewrite from that set.
Upstream calls flow through the same cache, rate limiter, and retry wrappers
as everything else.

## Limitations

- One image per release (the front cover). YouTube Music has no back,
  booklet, disc, or tray art, so those CAA routes return 404.
- Thumbnails whose URLs carry no `=wN-hN` segment are served at their native
  size regardless of the requested size.
- Requests are subject to the per-IP HTTP rate limit like everything else.
- The real `coverartarchive.org` is a different dataset: ytmbrainz MBIDs will
  never resolve there. Clients must be pointed at ytmbrainz's own CAA routes.
