import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { createTables } from './schema.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DB_PATH = path.join(__dirname, '../../../database.sqlite');

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('journal_mode = WAL');
    createTables(db);
  }
  return db;
}