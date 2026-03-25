# Build from REPOSITORY ROOT (default on Koyeb / many CI systems).
# If your platform sets build context to `backend/` only, use `backend/Dockerfile` instead.
FROM node:20-bookworm-slim

WORKDIR /app

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

COPY backend/package.json backend/package-lock.json* ./
RUN npm ci

COPY backend/ ./

RUN npm run build

ENV NODE_ENV=production
ENV DATABASE_PATH=/app/database.sqlite

EXPOSE 3001

CMD ["node", "dist/index.js"]
