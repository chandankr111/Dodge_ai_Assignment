# Koyeb / Docker — use Debian-based image (not Alpine) so better-sqlite3 native builds work.
FROM node:20-bookworm-slim

WORKDIR /app

# Native addon build toolchain
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY package.json package-lock.json* ./
RUN npm ci

COPY . .

# Compile TypeScript → dist/ (same as local `npm run build`)
RUN npm run build

ENV NODE_ENV=production
ENV PORT=3001
# DB file is copied next to package root; connection.ts resolves ../../database.sqlite from dist/db → /app/database.sqlite
ENV DATABASE_PATH=/app/database.sqlite

EXPOSE 3001

CMD ["node", "dist/index.js"]
