FROM node:20-bookworm-slim

WORKDIR /app

# Install build tools (for better-sqlite3)
RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ \
  && rm -rf /var/lib/apt/lists/*

# Copy package files
COPY package*.json ./

RUN npm ci

# Copy entire backend code (including database.sqlite)
COPY . .

# Build TypeScript
RUN npm run build

ENV NODE_ENV=production
ENV PORT=8000
ENV DATABASE_PATH=/app/database.sqlite

EXPOSE 8000

CMD ["node", "dist/index.js"]
