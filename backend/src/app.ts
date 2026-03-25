import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import graphRouter from './routes/graph.js';
import chatRouter from './routes/chat.js';

dotenv.config();

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
