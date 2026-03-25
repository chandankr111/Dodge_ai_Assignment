import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import graphRouter from './routes/graph.js';
import chatRouter from './routes/chat.js';

// Load backend/.env regardless of the current working directory.
// This prevents "dotenv injecting (0)" when the server is started from the repo root.
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// Helpful runtime diagnostics (do not log the secret itself).
console.log(
  `[config] GEMINI_API_KEY present: ${Boolean(process.env.GEMINI_API_KEY)}`
);
if (!process.env.GEMINI_API_KEY) {
  console.warn('[config] GEMINI_API_KEY is missing; LLM features will disable.');
}
if (process.env.GEMINI_MODEL) {
  console.log(`[config] GEMINI_MODEL=${process.env.GEMINI_MODEL}`);
}

const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((v) => v.trim())
  .filter(Boolean);

export const app = express();

app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin) return callback(null, true);
      if (allowedOrigins.length === 0 || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error('CORS origin not allowed'));
    }
  })
);
app.use(express.json());

app.use('/api/graph', graphRouter);
app.use('/api/chat', chatRouter);

app.get('/health', (req, res) => res.json({ status: 'ok' }));
