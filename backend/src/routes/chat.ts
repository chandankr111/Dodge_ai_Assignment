import { Router } from 'express';
import type { Request, Response } from 'express';
import { handleChatQuery } from '../services/llmService.js';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const { message } = req.body;

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'Message is required' });
  }

  try {
    const result = await handleChatQuery(message);
    res.json(result);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Something went wrong' });
  }
});

export default router;