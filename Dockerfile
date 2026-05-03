# AI Subtitle Tool — single-container image
# Combines FastAPI backend + Next.js frontend
# Usage: docker run -p 3000:3000 ai-subtitle-tool

# ── Stage 1: Build Next.js ──────────────────────────────────────────────────
FROM node:22-alpine AS web-builder
WORKDIR /build
COPY web/package*.json ./
RUN npm ci
COPY web/ .
ENV API_URL=http://127.0.0.1:8000
RUN npm run build

# ── Stage 2: Grab Node.js 22 runtime ────────────────────────────────────────
FROM node:22-slim AS node-bin

# ── Stage 3: Final image ────────────────────────────────────────────────────
FROM python:3.12-slim

# System deps (ffmpeg + curl only, Node comes from stage 2)
RUN apt-get update && \
    apt-get install -y --no-install-recommends ffmpeg curl && \
    rm -rf /var/lib/apt/lists/*

# Copy Node.js 22 binary from node-slim
COPY --from=node-bin /usr/local/bin/node /usr/local/bin/node
COPY --from=node-bin /usr/local/lib/node_modules /usr/local/lib/node_modules
RUN ln -sf /usr/local/lib/node_modules/npm/bin/npm-cli.js /usr/local/bin/npm

WORKDIR /app

# Python backend
COPY pyproject.toml README.md ./
COPY subtitle_tool/ subtitle_tool/
COPY api/ api/
RUN pip install --no-cache-dir ".[web]"

# Next.js standalone build
COPY --from=web-builder /build/public ./web/public
COPY --from=web-builder /build/.next/standalone ./web/
COPY --from=web-builder /build/.next/static ./web/.next/static

# Entrypoint script
COPY docker-entrypoint.sh /docker-entrypoint.sh
RUN chmod +x /docker-entrypoint.sh

# Cache Whisper models across restarts
VOLUME /root/.cache/huggingface
# Persist job files
VOLUME /tmp/subtitle_jobs

EXPOSE 3000

ENV PYTHONUNBUFFERED=1

ENTRYPOINT ["/docker-entrypoint.sh"]
