# Deployment Guide (Vercel + Railway)

This project is split into:

- `frontend` (Vite + React + TypeScript) -> deploy to Vercel
- `backend` (Express + SQLite) -> deploy to Railway

## 1) Deploy Backend on Railway

1. Push code to GitHub.
2. In Railway, create a new project from your GitHub repository.
3. Configure service:
   - Root Directory: `backend`
   - Build Command: `npm install`
   - Start Command: `npm run start`
4. Add environment variables:
   - `PORT` = `3001` (Railway can override automatically; keeping it is fine)
   - `CORS_ORIGIN` = `https://your-frontend.vercel.app`
   - `GEMINI_API_KEY` = `<your_key>` (optional; fallback mode still works without valid key)
5. Deploy and copy the backend public URL (example: `https://your-backend.up.railway.app`).

## 2) Deploy Frontend on Vercel

1. In Vercel, import the same GitHub repository.
2. Configure project:
   - Root Directory: `frontend`
   - Build Command: `npm run build`
   - Output Directory: `dist`
3. Add environment variable:
   - `VITE_API_BASE_URL` = your Railway backend URL
     - Example: `https://your-backend.up.railway.app`
4. Deploy.

## 3) Post Deploy Checks

Run these checks after both deployments:

1. Backend health:
   - `GET https://your-backend.up.railway.app/health`
   - Expected: `{ "status": "ok" }`
2. Graph API:
   - `GET https://your-backend.up.railway.app/api/graph`
   - Expected: JSON with `nodes` and `edges`
3. Frontend:
   - Open Vercel URL
   - Graph should load and node click should open inspector
   - Chat should return dataset responses

## Notes

- The backend uses `database.sqlite` file. Railway ephemeral restarts may reset local file changes unless persistent storage is configured.
- For production-grade persistence, move DB to managed storage later.
