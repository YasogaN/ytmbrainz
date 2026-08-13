# syntax=docker/dockerfile:1

# 1. Install dependencies
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
ENV LEFTHOOK=0
RUN bun install --frozen-lockfile

# 2. Build single binary
FROM deps AS build
COPY . .
RUN bun run preflight
# Compiles src/index.ts into a standalone binary named 'app'
RUN bun build --compile --minify --sourcemap ./src/index.ts --outfile app

# 3. Minimal runtime using alpine base
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production \
    YTMB_HOST=0.0.0.0 \
    YTMB_DB_PATH=/app/data/ytmbrainz.db

# Copy ONLY the compiled binary
COPY --from=build /app/app /app/app
RUN addgroup -S ytmbrainz && adduser -S -G ytmbrainz ytmbrainz \
    && mkdir -p /app/data && chown -R ytmbrainz:ytmbrainz /app

USER ytmbrainz
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/health > /dev/null 2>&1 || exit 1
CMD ["/app/app"]