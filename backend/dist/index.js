import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import graphRouter from './routes/graph.js';
import chatRouter from './routes/chat.js'; // we'll build this next
dotenv.config();
const app = express();
const PORT = process.env.PORT || 3001;
app.use(cors());
app.use(express.json());
app.use('/api/graph', graphRouter);
app.use('/api/chat', chatRouter);
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map