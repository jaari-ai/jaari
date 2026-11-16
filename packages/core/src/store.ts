// The main session's store in SQLite through node:sqlite (ADR-065): the transcript, kept in full, and
// the small durable state (the pause flag, held messages, the last compaction).
import { DatabaseSync } from "node:sqlite";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

export type Store = ReturnType<typeof openStore>;

// `path` is a file in the data directory, or ":memory:" in tests.
export function openStore(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS transcript (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, message TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
  const insert = db.prepare(`INSERT INTO transcript (at, message) VALUES (?, ?)`);
  const select = db.prepare(`SELECT seq, message FROM transcript WHERE seq >= ? ORDER BY seq`);
  const read = db.prepare(`SELECT value FROM state WHERE key = ?`);
  const write = db.prepare(`INSERT INTO state VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
  return {
    // Returns the message's sequence number.
    append: (message: AgentMessage): number => Number(insert.run(new Date().toISOString(), JSON.stringify(message)).lastInsertRowid),
    load: (from = 0) =>
      select.all(from).map((row) => ({ seq: Number(row.seq), message: JSON.parse(String(row.message)) as AgentMessage })),
    get<T>(key: string): T | undefined {
      const row = read.get(key);
      return row ? (JSON.parse(String(row.value)) as T) : undefined;
    },
    set: (key: string, value: unknown) => void write.run(key, JSON.stringify(value)),
    close: () => db.close(),
  };
}
