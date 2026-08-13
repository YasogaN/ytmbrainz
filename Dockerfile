# syntax=docker/dockerfile:1

FROM oven/bun:1.3 AS base
WORKDIR /app
COPY package.json bun.lock bunfig.toml ./
ENV LEFTHOOK=0
RUN bun install --frozen-lockfile

FROM base AS build
COPY . .
RUN bun run preflight

FROM oven/bun:1.3 AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV YTMB_HOST=0.0.0.0
ENV YTMB_DB_PATH=/app/data/ytmbrainz.db
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/bunfig.toml /app/tsconfig.json ./
COPY --from=build /app/src ./src
RUN mkdir -p /app/data
EXPOSE 3000
CMD ["bun", "src/index.ts"]
