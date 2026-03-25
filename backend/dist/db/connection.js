import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTables } from './schema.js';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
/** Default: backend/database.sqlite (one level up from backend/src/db). */
function defaultDbPath() {
    return path.join(__dirname, '../../database.sqlite');
}
function resolveDbPath() {
    const fromEnv = process.env.DATABASE_PATH?.trim();
    if (fromEnv) {
        return path.isAbsolute(fromEnv) ? fromEnv : path.resolve(process.cwd(), fromEnv);
    }
    return defaultDbPath();
}
const DB_PATH = resolveDbPath();
let db;
export function getDb() {
    if (!db) {
        const dir = path.dirname(DB_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        db = new Database(DB_PATH);
        db.pragma('journal_mode = WAL');
        createTables(db);
    }
    return db;
}
//# sourceMappingURL=connection.js.map