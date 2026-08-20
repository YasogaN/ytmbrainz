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

## Proxying the real Cover Art Archive

Some services that can be pointed at ytmbrainz for `/ws/2` still hardcode
`https://coverartarchive.org` for cover art (Koito is one — it has no CAA URL
override, only a disable flag). Such a service fetches covers with the MBIDs it
got from ytmbrainz, and because those are ytmbrainz MBIDs, the real CAA answers
404.

The fix is to MITM `coverartarchive.org` itself: run mitmproxy as a sidecar
container that owns the `coverartarchive.org` DNS alias on a shared network,
terminates TLS with its own CA, and reverse-proxies to ytmbrainz's CAA routes.
This works because the MBIDs in those requests are ytmbrainz MBIDs and the
request shapes match 1:1 — a client issues `HEAD` (and later `GET`) to
`/release/{mbid}/front` and `/release-group/{mbid}/front`, exactly the routes
ytmbrainz serves. Those return a 307 to the Google-hosted thumbnail; the
client's HTTP library follows the redirect, sees a 200, and accepts the cover.

```
caa (shared user-defined network, DNS on)
├─ ytmbrainz     http://ytmbrainz:3000        (no alias)
├─ caa-mitm      alias: coverartarchive.org
│     mitmdump --mode reverse:http://ytmbrainz:3000@443 --set keep_host_header=true
│     Volume: mitm-ca:/home/mitmproxy/.mitmproxy    (CA persists)
└─ any client    resolves coverartarchive.org → caa-mitm
```

No ports are published: `caa-mitm` listens on 443 inside its own container and
is reachable only by other containers on the `caa` network. Expose the services
over the container network however you already expose container services.

### Prerequisites

- The client that fetches covers must be pointed at ytmbrainz for `/ws/2` so
  every MBID it sends to CAA is a ytmbrainz MBID (i.e. its MusicBrainz URL must
  point at ytmbrainz).
- `podman` ≥ 5.2 for the quadlet `NetworkAlias=` support (Docker and plain
  podman support network aliases natively).

### 1. Trust the sidecar's certificate (one time)

mitmproxy generates its CA on first start, stored in the `mitm-ca` volume.
Extract it and build a trust bundle. Both parts are required: the mitmproxy CA
(for the forged `coverartarchive.org` certificate) and the real system roots
(for the `lh3.googleusercontent.com` thumbnail the client is redirected to):

```sh
# after the sidecar has started once (see variants below):
podman cp caa-mitm:/home/mitmproxy/.mitmproxy/mitmproxy-ca-cert.pem .
cat /etc/ssl/certs/ca-certificates.crt mitmproxy-ca-cert.pem > ca-bundle.crt
```

Then mount `ca-bundle.crt` into the client container and point it at the file
(docker: `volumes: - ./ca-bundle.crt:/etc/caa-ca/ca-bundle.crt:ro` and
`environment: - SSL_CERT_FILE=/etc/caa-ca/ca-bundle.crt`):

```ini
Volume=/path/to/ca-bundle.crt:/etc/caa-ca/ca-bundle.crt:ro,Z
Environment=SSL_CERT_FILE=/etc/caa-ca/ca-bundle.crt
```

> Note: if the client still rejects the certificate, its runtime may not honor
> `SSL_CERT_FILE` — bind the bundle over the base image's CA path instead
> (e.g. `/etc/ssl/certs/ca-certificates.crt` on Debian-based images,
> `/etc/ssl/cert.pem` on Alpine).

### 2. Variant A — podman quadlet (recommended)

`~/.config/containers/systemd/caa.network`:

```ini
[Unit]
Description=CAA proxy shared network

[Network]
# Name the network explicitly; podman auto-assigns the subnet.
NetworkName=caa
```

Join ytmbrainz to the network by adding a single line to your copied
`ytmbrainz.container` (a container can join multiple networks — one `Network=`
line per network):

```ini
[Container]
Network=caa.network
```

`~/.config/containers/systemd/caa-mitm.container`:

```ini
[Unit]
Description=CAA MITM sidecar (coverartarchive.org -> ytmbrainz)

[Container]
Image=docker.io/mitmproxy/mitmproxy
Network=caa.network
NetworkAlias=coverartarchive.org
Exec=mitmdump --mode reverse:http://ytmbrainz:3000@443 --set keep_host_header=true
Volume=mitm-ca:/home/mitmproxy/.mitmproxy
AutoUpdate=registry

[Service]
Restart=on-failure

[Install]
WantedBy=default.target
```

The client container joins the same network and trusts the bundle:

```ini
[Container]
Network=caa.network
Volume=/path/to/ca-bundle.crt:/etc/caa-ca/ca-bundle.crt:ro,Z
Environment=SSL_CERT_FILE=/etc/caa-ca/ca-bundle.crt
```

Apply:

```sh
systemctl --user daemon-reload
systemctl --user restart ytmbrainz        # joins caa.network
systemctl --user enable --now caa-mitm
systemctl --user restart <client>
```

Custom podman networks enable DNS by default — verify with
`podman network inspect -f '{{.DNSEnabled}}' caa`.

### 3. Variant B — plain podman

```sh
podman network create caa
podman run -d --name ytmbrainz --network caa ghcr.io/YasogaN/ytmbrainz:latest
podman run -d --name caa-mitm --network caa --network-alias coverartarchive.org \
  -v mitm-ca:/home/mitmproxy/.mitmproxy \
  docker.io/mitmproxy/mitmproxy \
  mitmdump --mode reverse:http://ytmbrainz:3000@443 --set keep_host_header=true
podman run -d --name <client> --network caa \
  -v /path/to/ca-bundle.crt:/etc/caa-ca/ca-bundle.crt:ro,Z \
  -e SSL_CERT_FILE=/etc/caa-ca/ca-bundle.crt \
  <client-image>
```

### 4. Variant C — Docker Compose

```sh
docker network create caa
```

In the ytmbrainz compose file:

```yaml
services:
  ytmbrainz:
    image: ghcr.io/YasogaN/ytmbrainz:latest
    networks: [caa]
    # ...your environment and volumes...

  caa-mitm:
    image: mitmproxy/mitmproxy
    networks:
      caa:
        aliases: [coverartarchive.org]
    command: ["mitmdump", "--mode", "reverse:http://ytmbrainz:3000@443", "--set", "keep_host_header=true"]
    volumes:
      - mitm-ca:/home/mitmproxy/.mitmproxy
    restart: unless-stopped

networks:
  caa:
    external: true

volumes:
  mitm-ca:
```

In the client's compose file, join the same external `caa` network, trust the
bundle, and point its MusicBrainz URL at ytmbrainz. No `ports:` are defined
anywhere — every service is reached by name on the `caa` network.

### Caveats

- The image bytes still come from Google directly — the 307 redirect bypasses
  the proxy, so the client needs normal internet access to
  `lh3.googleusercontent.com` (hence the real roots in the trust bundle).
- Import bursts can trip ytmbrainz's per-IP HTTP rate limit (default 10 req/s);
  raise `YTMB_HTTP_RATE_LIMIT` or set it to `0` if covers start 503ing.
- Only ytmbrainz MBIDs resolve this way; the real MusicBrainz dataset never
  will.
