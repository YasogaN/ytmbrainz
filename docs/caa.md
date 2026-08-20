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

## Proxying the real Cover Art Archive for scrobblers

Some scrobblers and services can be pointed at ytmbrainz for `/ws/2` but still
hardcode `https://coverartarchive.org` for cover art (Koito is one — it has no
CAA URL override, only a disable flag). Such a service fetches covers with the
MBIDs it got from ytmbrainz, and because those are ytmbrainz MBIDs, the real CAA
answers 404.

The fix is to MITM `coverartarchive.org` itself: run mitmproxy as a TLS reverse
proxy on the host so requests to `coverartarchive.org` are served by ytmbrainz's
CAA routes instead. This works because the MBIDs in those requests are ytmbrainz
MBIDs, and the request shapes match 1:1. A Koito-style client issues `HEAD`
(and later `GET`) to `/release/{mbid}/front` and `/release-group/{mbid}/front` —
exactly the routes ytmbrainz serves, which return a 307 to the Google-hosted
thumbnail. The client's HTTP library follows the redirect, so it sees a 200 and
accepts the cover.

### Setup

1. Make sure the scrobbler's MusicBrainz URL points at ytmbrainz
   (`KOITO_MUSICBRAINZ_URL=http://<host>:3000` for Koito), so every MBID it
   hands to CAA is a ytmbrainz MBID.

2. Run mitmproxy in reverse mode on the host, forwarding to ytmbrainz
   (the ytmbrainz quadlet already publishes port 3000 to the host):

   ```sh
   sudo mitmdump -p 443 --mode reverse:http://127.0.0.1:3000 --set keep_host_header=true
   ```

   mitmproxy terminates TLS and presents its own certificate for
   `coverartarchive.org`; `keep_host_header=true` preserves the `Host` header so
   ytmbrainz builds the right URLs. Redirects are passed through unchanged.

3. Build a CA bundle the scrobbler will trust — both parts are required: the
   mitmproxy CA (for the forged `coverartarchive.org` certificate) and the real
   roots (for the `lh3.googleusercontent.com` thumbnail the client is redirected
   to):

   ```sh
   cat /etc/ssl/certs/ca-certificates.crt ~/.mitmproxy/mitmproxy-ca-cert.pem > ca-bundle.crt
   ```

4. Point the scrobbler container's `coverartarchive.org` traffic at the host and
   trust the bundle:

   - **Docker**: in the scrobbler's `docker-compose.yml`
     ```yaml
     extra_hosts:
       - 'coverartarchive.org:host-gateway'
     environment:
       - SSL_CERT_FILE=/etc/caa-ca/ca-bundle.crt
     volumes:
       - ./ca-bundle.crt:/etc/caa-ca/ca-bundle.crt:ro
     ```
   - **Rootless podman quadlet**: in the scrobbler's `.container` file
     ```ini
     AddHost=coverartarchive.org:host-gateway
     Environment=SSL_CERT_FILE=/etc/caa-ca/ca-bundle.crt
     Volume=/path/to/ca-bundle.crt:/etc/caa-ca/ca-bundle.crt:ro,Z
     ```

   Only `coverartarchive.org` is redirected; everything else (including the
   Google thumbnail) still resolves normally.

### Caveats

- The image bytes still come from Google directly — the 307 redirect bypasses
  the proxy, so the scrobbler needs normal internet access to
  `lh3.googleusercontent.com`.
- Import bursts can trip ytmbrainz's per-IP HTTP rate limit (default 10 req/s);
  raise `YTMB_HTTP_RATE_LIMIT` or set it to `0` if covers start 503ing.
- Only ytmbrainz MBIDs resolve this way; the real MusicBrainz dataset never
  will.
