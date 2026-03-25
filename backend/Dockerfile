# Koyeb: **Build context** = repo root (`.`), **Dockerfile** = `backend/Dockerfile`.
# COPY paths are relative to the context root, not this file's directory.
FROM node:20-bookworm-slim

WORKDIR /app

# Toolchain for better-sqlite3 native build
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./

RUN npm ci

# Source, config, and database.sqlite (under backend/)
COPY backend/ .

RUN npm run build

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/database.sqlite

EXPOSE 3001

CMD ["node", "dist/index.js"]
