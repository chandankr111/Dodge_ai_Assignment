/**
 * Vercel serverless entry: routes all requests to Express via serverless-http.
 * Set project Root Directory to `backend` in Vercel.
 *
 * Note: better-sqlite3 is a native module; Vercel’s Linux build may still fail.
 * For production SQLite, prefer Railway, Render, Fly.io, or a managed DB.
 */
import serverless from 'serverless-http';
declare const handler: serverless.Handler;
export default handler;
//# sourceMappingURL=index.d.ts.map