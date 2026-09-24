# Keelflow image built from source.
#   docker build -t keelflow .
#   docker run -d -p 3000:3000 -v ~/.keelflow:/home/node/.keelflow keelflow
# An existing Flowise volume works too: -v ~/.flowise:/home/node/.flowise

ARG NODE_VERSION=24

# ---------- build ----------
FROM node:${NODE_VERSION}-alpine AS build

RUN apk add --no-cache libc6-compat python3 make g++ build-base cairo-dev pango-dev git && \
    npm install -g pnpm@10.26.0

ENV PUPPETEER_SKIP_DOWNLOAD=true \
    CYPRESS_INSTALL_BINARY=0 \
    HUSKY=0 \
    TURBO_TELEMETRY_DISABLED=1 \
    NODE_OPTIONS=--max-old-space-size=8192

WORKDIR /src
COPY . .

# Build everything, then copy only the server and its production dependencies to /app
RUN pnpm install --frozen-lockfile && \
    pnpm build && \
    pnpm --filter keelflow deploy --prod --legacy /app && \
    rm -rf /app/src /app/test

# ---------- runtime ----------
FROM node:${NODE_VERSION}-alpine

# chromium for the Puppeteer/Playwright document loaders; cairo/pango for canvas
RUN apk add --no-cache libc6-compat chromium curl cairo pango

ENV NODE_ENV=production \
    PORT=3000 \
    PUPPETEER_SKIP_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium-browser

COPY --from=build --chown=node:node /app /app

# Owned by node so a named volume mounted here is writable. While it stays empty,
# a mounted ~/.flowise is used instead (see getDataDir).
RUN mkdir -p /home/node/.keelflow && chown node:node /home/node/.keelflow

WORKDIR /app
USER node
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=60s --retries=3 \
    CMD curl -fs http://localhost:${PORT}/api/v1/ping || exit 1

ENTRYPOINT ["node", "/app/bin/run"]
CMD ["start"]
