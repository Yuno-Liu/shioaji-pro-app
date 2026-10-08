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

# ── 2. Production Web Serve Stage ─────────────────────────────────────────────
FROM nginx:alpine AS runner

# Copy compiled static assets from builder stage
COPY --from=builder /app/dist /usr/share/nginx/html

# Copy Nginx template for environment-variable substitution (envsubst)
COPY deploy/nginx.conf.template /etc/nginx/templates/default.conf.template

# Default target points to Shioaji server on the host machine
ENV API_TARGET=http://host.docker.internal:8080

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
