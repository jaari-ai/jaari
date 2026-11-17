// The main session's store in SQLite through node:sqlite (ADR-065): the transcript, kept in full, and
// the small durable state (the pause flag, held messages, the last compaction), and `message_ref`, which maps a
// channel's message id to Jaari's own copy of that message (ADR-117).
import { DatabaseSync } from "node:sqlite";
import type { AgentMessage } from "@earendil-works/pi-agent-core";

export type Store = ReturnType<typeof openStore>;
// A channel's id for one message; unique only inside its conversation (ADR-117).
export type MessageKey = { channel: string; conversationId: string; messageId: string };
// `origin`: "turn" or "prompt:<id>" ("task:<id>" and "routine:<id>" arrive with children and routines).
export type MessageRef = { origin: string; seq?: number; at?: string; message?: AgentMessage };

// `path` is a file in the data directory, or ":memory:" in tests.
export function openStore(path: string) {
  const db = new DatabaseSync(path);
  db.exec(`CREATE TABLE IF NOT EXISTS transcript (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, message TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS message_ref (channel TEXT NOT NULL, conversation_id TEXT NOT NULL, message_id TEXT NOT NULL,
      seq INTEGER, origin TEXT NOT NULL, PRIMARY KEY (channel, conversation_id, message_id))`);
  const insert = db.prepare(`INSERT INTO transcript (at, message) VALUES (?, ?)`);
  const select = db.prepare(`SELECT seq, message FROM transcript WHERE seq >= ? ORDER BY seq`);
  const read = db.prepare(`SELECT value FROM state WHERE key = ?`);
  const write = db.prepare(`INSERT INTO state VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value`);
  const refInsert = db.prepare(`INSERT OR IGNORE INTO message_ref VALUES (?, ?, ?, ?, ?)`);
  const refSeq = db.prepare(`UPDATE message_ref SET seq = ? WHERE channel = ? AND conversation_id = ? AND message_id = ?`);
  const refSelect = db.prepare(`SELECT r.seq, r.origin, t.at, t.message FROM message_ref r LEFT JOIN transcript t ON t.seq = r.seq
    WHERE r.channel = ? AND r.conversation_id = ? AND r.message_id = ?`);
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
    refs: {
      // Returns false when the id is already known: the channel delivered the same message twice.
      // `seq` is the transcript row; a prompt has none, and an owner message gets its row when the session stores it.
      put: (key: MessageKey, origin: string, seq?: number): boolean =>
        refInsert.run(key.channel, key.conversationId, key.messageId, seq ?? null, origin).changes > 0,
      stored: (key: MessageKey, seq: number) => void refSeq.run(seq, key.channel, key.conversationId, key.messageId),
      get(key: MessageKey): MessageRef | undefined {
        const row = refSelect.get(key.channel, key.conversationId, key.messageId);
        if (!row) return undefined;
        const message = row.message == null ? undefined : (JSON.parse(String(row.message)) as AgentMessage);
        return { origin: String(row.origin), ...(message ? { seq: Number(row.seq), at: String(row.at), message } : {}) };
      },
    },
    close: () => db.close(),
  };
}
