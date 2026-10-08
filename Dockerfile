# syntax=docker/dockerfile:1

# ── 1. Build Stage ────────────────────────────────────────────────────────────
FROM node:22-bookworm-slim AS builder

WORKDIR /app

# Enable pnpm v10 via corepack
RUN corepack enable && corepack prepare pnpm@10.34.6 --activate

# Copy dependencies definitions and local E.SUN SDK package
COPY package.json pnpm-lock.yaml esun-trade-2.2.0.tgz ./

# Install dependencies using frozen lockfile
RUN pnpm install --frozen-lockfile

# Copy source tree
COPY . .

# Build production SPA assets to dist/
RUN pnpm run build

# ── 2. E.SUN Order Bridge (Node.js + native @esun/trade SDK) ──────────────────
FROM node:22-bookworm-slim AS bridge

WORKDIR /app

# trade-core 以 HTTPS 連玉山 API，需要系統 CA 憑證
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# 只安裝 SDK 本身；--ignore-scripts 跳過 keytar 原生編譯（bridge 以 stub 取代，
# 帳密改由環境變數提供）
COPY esun-trade-2.2.0.tgz ./
RUN npm init -y >/dev/null \
    && npm install --omit=dev --ignore-scripts --no-audit --no-fund ./esun-trade-2.2.0.tgz \
    && rm esun-trade-2.2.0.tgz

COPY server/esun-bridge.cjs ./server/esun-bridge.cjs

ENV ESUN_BRIDGE_HOST=0.0.0.0 \
    ESUN_BRIDGE_PORT=8090 \
    ESUN_CONFIG_PATH=/app/esun/config.ini

EXPOSE 8090

USER node

CMD ["node", "server/esun-bridge.cjs"]

# ── 3. Production Web Serve Stage ─────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx template for environment-variable substitution (envsubst)
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

# Default target points to Shioaji server on the host machine
ENV API_TARGET=http://host.docker.internal:8080 \
    ESUN_BRIDGE_TARGET=http://esun-bridge:8090

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
