import { app } from './app.js';
const PORT = Number(process.env.PORT) || 3001;
app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});
//# sourceMappingURL=index.js.map