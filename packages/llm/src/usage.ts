// The usage log: one row per model call, kept forever (ADR-032, ADR-011). SQLite through node:sqlite.
import { DatabaseSync } from "node:sqlite";

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

// `path` is a file in the data directory, or ":memory:" in tests.
export function openUsageLog(path: string): UsageLog {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS usage (
    at TEXT NOT NULL, role TEXT NOT NULL, provider TEXT NOT NULL, model TEXT NOT NULL,
    input INTEGER NOT NULL, output INTEGER NOT NULL, cache_read INTEGER NOT NULL, cache_write INTEGER NOT NULL,
    cost_usd REAL NOT NULL, latency_ms INTEGER NOT NULL, outcome TEXT NOT NULL)`);
  const insert = db.prepare(`INSERT INTO usage VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  return {
    record: (r) =>
      void insert.run(new Date().toISOString(), r.role, r.provider, r.model, r.input, r.output, r.cacheRead, r.cacheWrite, r.costUsd, r.latencyMs, r.outcome),
    close: () => db.close(),
  };
}
