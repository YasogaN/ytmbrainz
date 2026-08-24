# syntax=docker/dockerfile:1

# 1. Install dependencies
FROM oven/bun:1.3-alpine AS deps
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
ENV LEFTHOOK=0
RUN bun install --frozen-lockfile

# 2. Build the JavaScript bundle
FROM deps AS build
COPY . .
RUN bun run preflight
# jsdom stays external: it reads its default stylesheet and css-tree reads
# data files via createRequire at runtime, which bundling would break.
RUN bun build ./src/index.ts --outdir ./dist --target bun --minify --external jsdom

# 3. Production runtime
FROM oven/bun:1.3-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    YTMB_HOST=0.0.0.0 \
    YTMB_DB_PATH=/app/data/ytmbrainz.db

# Production dependencies: jsdom (and its asset reads) and impit's native
# binding must be present at runtime.
COPY package.json bun.lock bunfig.toml ./
ENV LEFTHOOK=0
RUN bun install --production --frozen-lockfile

# Copy built bundle from build stage (includes impit's native .node assets)
COPY --from=build /app/dist /app/dist

# Setup non-root user and persistent data directory
RUN addgroup -S ytmbrainz && adduser -S -G ytmbrainz ytmbrainz \
    && mkdir -p /app/data \
    && chown -R ytmbrainz:ytmbrainz /app

USER ytmbrainz
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O- http://127.0.0.1:3000/health > /dev/null 2>&1 || exit 1

CMD ["bun", "run", "/app/dist/index.js"]