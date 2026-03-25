# Deployment (Vercel, Cloudflare Pages, or Railway)

## Layout

- `frontend/` — Vite + React + TypeScript
- `backend/` — Express + SQLite (`backend/database.sqlite`)

The SQLite file lives **inside `backend/`**. Paths in code resolve to `backend/database.sqlite` by default. You can override with `DATABASE_PATH` (absolute or relative to the process `cwd`).

---

## 1) Backend API

### Option A — Vercel (serverless)

1. Import the repo in Vercel.
2. Set **Root Directory** to `backend`.
3. Environment variables:
   - `CORS_ORIGIN` — comma-separated front-end URLs, e.g. `https://your-app.vercel.app,https://your-app.pages.dev`
   - `GEMINI_API_KEY` — optional
   - `DATABASE_PATH` — optional; default is `database.sqlite` next to the server when cwd is `backend`. For serverless, set to something writable if the platform allows (often limited).

`vercel.json` routes all traffic to `src/api/index.ts`, which wraps Express with `serverless-http`.

**Important:** `better-sqlite3` is a **native** Node addon. Vercel’s build may succeed or fail depending on ABI and filesystem limits. If the deploy fails or the DB is read-only at runtime, use **Railway / Render / Fly.io** for the API instead, or move to a hosted SQL database.

### Option B — Railway / Render / Fly (long-lived Node, best for SQLite)

1. Root directory: `backend`
2. Install: `npm install`
3. Start: `npm run start`
4. Env: `PORT` (optional), `CORS_ORIGIN`, `GEMINI_API_KEY`, `DATABASE_PATH` (optional)

Commit `backend/database.sqlite` or run `npm run seed` in build with your dataset path configured in `seed.ts`.

### Option C — Koyeb (Docker)

1. Commit **`backend/database.sqlite`** (it is not listed in `backend/.gitignore`).
2. In Koyeb: **Create App** → GitHub → your repo.
3. Use **Docker** with:
   - **Build context:** `.` (repository root — Koyeb’s default).
   - **Dockerfile path:** `backend/Dockerfile` (uses `COPY backend/...` so `package.json` and `database.sqlite` resolve correctly).
   - **Alternative:** **Dockerfile path:** `Dockerfile` at repo root (same layout; see root `Dockerfile`).
4. **Wrong setup:** `backend/Dockerfile` with build context **`backend/`** *and* `COPY package.json` with no `backend/` prefix — or root context with `COPY package.json` only — both fail with `package.json` not found at context root.
5. **Port:** match what Koyeb expects (often **8000** on the platform; the app uses `process.env.PORT`, so set **`PORT`** in Koyeb env to that value if health checks fail).
6. **Environment variables:**
   - `CORS_ORIGIN` — your frontend URL(s), comma-separated, e.g. `https://your-app.vercel.app`
   - `GEMINI_API_KEY` — optional
7. Deploy. Test `https://<your-app>.koyeb.app/health` and `/api/graph`.

The image uses **`node:20-bookworm-slim`** (not Alpine) and installs `python3` / `make` / `g++` so **`better-sqlite3`** can compile. The app runs **`node dist/index.js`** after `npm run build` (`tsc`).

**Frontend env:** use **`VITE_API_BASE_URL`** (not `VITE_API_URL`) pointing at your Koyeb URL.

---

## 2) Frontend on Vercel

1. New project → same repo.
2. **Root Directory:** `frontend`
3. **Build:** `npm run build`
4. **Output:** `dist`
5. Env: `VITE_API_BASE_URL` = your deployed API URL (no trailing slash), e.g. `https://your-api.vercel.app`

---

## 3) Frontend on Cloudflare Pages

1. Connect the Git repo → Pages.
2. **Build command:** `npm run build`
3. **Build output directory:** `dist`
4. **Root directory:** `frontend`
5. **Environment variable:** `VITE_API_BASE_URL` = your API URL.

`frontend/public/_redirects` enables SPA routing (all paths → `index.html`).

Optional: from `frontend/`, after `npm run build`, deploy with Wrangler:

```bash
npx wrangler pages deploy dist --project-name=<your-project>
```

---

## 4) Post-deploy checks

- `GET <API>/health` → `{ "status": "ok" }`
- `GET <API>/api/graph` → JSON with `nodes` / `edges`
- Open the frontend, confirm graph and chat work.

---

## 5) CORS

Set `CORS_ORIGIN` to every origin that serves your UI, comma-separated:

- Vercel preview: `https://your-app.vercel.app`
- Cloudflare Pages: `https://<project>.pages.dev` (and custom domain if any)

---

## 6) Notes

- SQLite on ephemeral serverless instances is fragile; prefer a VM-style host for production if you keep SQLite.
- Regenerate `backend/dist/` locally with `npx tsc` if you still rely on compiled output; primary source is `backend/src/`.
