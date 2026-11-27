import { createClient, type Client } from "@libsql/client";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

let client: Client | undefined;
let initialized: Promise<void> | undefined;
export function databaseUrl(): string {
  const url = process.env.TURSO_DATABASE_URL || process.env.DATABASE_URL;
  if (process.env.VERCEL && (!url || url.startsWith("file:"))) {
    throw new Error(
      "Vercel 需要配置 TURSO_DATABASE_URL 和 TURSO_AUTH_TOKEN，以持久保存历史数据。",
    );
  }
  return url || "file:data/economic.db";
}
export function db(): Client {
  if (!client) {
    const url = databaseUrl();
    if (url.startsWith("file:") && url !== "file::memory:")
      mkdirSync(dirname(url.slice(5)), { recursive: true });
    client = createClient({
      url,
      authToken: process.env.TURSO_AUTH_TOKEN || undefined,
    });
  }
  return client;
}
export async function initDb(): Promise<void> {
  initialized ??= db()
    .batch(
      [
        `CREATE TABLE IF NOT EXISTS quote_cache (
      metric_id TEXT PRIMARY KEY, payload TEXT, checked_at TEXT, error TEXT,
      next_refresh_at INTEGER NOT NULL DEFAULT 0, owner TEXT)`,
        `CREATE TABLE IF NOT EXISTS custom_metrics (id TEXT PRIMARY KEY, definition TEXT NOT NULL, created_at TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS observations (
      metric_id TEXT NOT NULL, date TEXT NOT NULL, value REAL NOT NULL, volume REAL,
      source TEXT NOT NULL, fetched_at TEXT NOT NULL, revised_at TEXT,
      PRIMARY KEY(metric_id, date))`,
        `CREATE TABLE IF NOT EXISTS revisions (
      id INTEGER PRIMARY KEY AUTOINCREMENT, metric_id TEXT NOT NULL, date TEXT NOT NULL,
      old_value REAL NOT NULL, new_value REAL NOT NULL, old_volume REAL, new_volume REAL,
      changed_at TEXT NOT NULL, source TEXT NOT NULL)`,
        `CREATE INDEX IF NOT EXISTS revisions_metric_date ON revisions(metric_id, date)`,
        `CREATE TABLE IF NOT EXISTS metric_status (
      metric_id TEXT PRIMARY KEY, last_attempt TEXT, last_success TEXT, error TEXT)`,
        `CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY, started_at TEXT NOT NULL, finished_at TEXT,
      successes INTEGER DEFAULT 0, failures INTEGER DEFAULT 0, status TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS leases (name TEXT PRIMARY KEY, owner TEXT NOT NULL, expires_at INTEGER NOT NULL)`,
      ],
      "write",
    )
    .then(() => undefined)
    .catch((error) => {
      initialized = undefined;
      throw error;
    });
  await initialized;
}
