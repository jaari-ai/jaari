// The usage log: one row per model call, kept forever (ADR-032, ADR-011). SQLite through node:sqlite.
import type { DatabaseSync } from "node:sqlite";

export type Outcome = "ok" | "refusal" | "not-accepted" | "failed" | "aborted";

export type UsageRow = {
  role: string;
  provider: string;
  model: string;
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  costUsd: number;
  latencyMs: number;
  outcome: Outcome;
};

export type UsageLog = { record(row: UsageRow): void; close(): void };

const COLUMNS = `at TEXT NOT NULL, role TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
  input INTEGER NOT NULL, output INTEGER NOT NULL, cache_read INTEGER NOT NULL, cache_write INTEGER NOT NULL,
  cost_usd REAL NOT NULL, latency_ms INTEGER NOT NULL, outcome TEXT NOT NULL`;

// The schema steps of usage.db, run by `openDatabase` in @jaari/core, which this package cannot import (ADR-119).
export const USAGE_MIGRATIONS: readonly ((db: DatabaseSync, ownerId: string) => void)[] = [
  (db) => db.exec(`CREATE TABLE IF NOT EXISTS usage (${COLUMNS})`), // 1: as roadmap 0.7 made it
  // 2: every row names its owner (ADR-044); rebuilt so the column is NOT NULL with no default.
  (db, ownerId) => {
    db.exec(`CREATE TABLE usage_2 (owner_id TEXT NOT NULL, ${COLUMNS})`);
    db.prepare(`INSERT INTO usage_2 SELECT ?, * FROM usage`).run(ownerId);
    db.exec(`DROP TABLE usage; ALTER TABLE usage_2 RENAME TO usage`);
  },
];

// `db` is usage.db, opened and migrated with USAGE_MIGRATIONS. Closing the log closes it.
export function openUsageLog(db: DatabaseSync, ownerId: string): UsageLog {
  const insert = db.prepare(`INSERT INTO usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  return {
    record: (r) =>
      void insert.run(ownerId, new Date().toISOString(), r.role, r.provider, r.model, r.input, r.output, r.cacheRead, r.cacheWrite, r.costUsd, r.latencyMs, r.outcome),
    close: () => db.close(),
  };
}
