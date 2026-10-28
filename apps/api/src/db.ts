import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
export function openDatabase(path = process.env.DATABASE_PATH ?? '../../data/nexo.sqlite') {
  if (path !== ':memory:') mkdirSync(dirname(resolve(path)), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec('PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL; PRAGMA busy_timeout=5000;');
  db.exec(`CREATE TABLE IF NOT EXISTS migrations(version INTEGER PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL UNIQUE, role TEXT NOT NULL CHECK(role IN ('employee','analyst')));
  CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES users(id), expires_at TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS tickets(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS tickets_owner ON tickets(owner_id);
  CREATE TABLE IF NOT EXISTS articles(id TEXT PRIMARY KEY, title TEXT NOT NULL, body TEXT NOT NULL);
  CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY, owner_id TEXT NOT NULL REFERENCES users(id), data TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS conversations_owner ON conversations(owner_id);
  CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), data TEXT NOT NULL);
  CREATE INDEX IF NOT EXISTS messages_conversation ON messages(conversation_id);
  CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id), data TEXT NOT NULL);
  INSERT OR IGNORE INTO migrations(version) VALUES(1);`);
  return db;
}
export type Db = ReturnType<typeof openDatabase>;
export function transaction<T>(db: Db, work: () => T): T {
  db.exec('BEGIN IMMEDIATE');
  try { const result = work(); db.exec('COMMIT'); return result; } catch (error) { db.exec('ROLLBACK'); throw error; }
}
