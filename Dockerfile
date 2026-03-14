# ── Stage 1: Build ────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace manifests first for layer caching
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/

# Install all dependencies (dev included — needed to compile)
RUN npm ci

# Copy source
COPY server/src       ./server/src
COPY server/tsconfig.json ./server/
COPY client/src       ./client/src
COPY client/index.html ./client/
COPY client/tsconfig.json   ./client/
COPY client/vite.config.ts  ./client/
COPY client/tailwind.config.js ./client/
COPY client/postcss.config.js  ./client/

# Build server (tsc → server/dist) and client (vite → client/dist)
RUN npm run build

# ── Stage 2: Runtime ───────────────────────────────────────────────────────────
FROM node:20-alpine AS runtime
WORKDIR /app

# Copy workspace manifests and install production deps only
COPY package.json package-lock.json ./
COPY server/package.json ./server/
COPY client/package.json ./client/
RUN npm ci --omit=dev

# Copy built artefacts from builder
COPY --from=builder /app/server/dist ./server/dist
COPY --from=builder /app/client/dist ./client/dist

# Persistent data directory (presets, schedules, HomeKit pairing)
RUN mkdir -p server/data/hap-persist

# HTTP server port (HAP port is exposed via host networking — see compose file)
EXPOSE 4001

ENV NODE_ENV=production

CMD ["node", "server/dist/index.js"]
