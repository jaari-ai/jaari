// The main session's store in SQLite through node:sqlite (ADR-065): the transcript, kept in full, and
// the small durable state (the pause flag, held messages, the last compaction), and `message_ref`, which maps a
// channel's message id to Jaari's own copy of that message (ADR-117).
import type { AgentMessage } from "@earendil-works/pi-agent-core";
import { openDatabase, type Migration } from "./database.js";

export type Store = ReturnType<typeof openStore>;
// A channel's id for one message; unique only inside its conversation (ADR-117).
export type MessageKey = { channel: string; conversationId: string; messageId: string };
// `origin`: "turn" or "prompt:<id>" ("task:<id>" and "routine:<id>" arrive with children and routines).
export type MessageRef = { origin: string; seq?: number; at?: string; message?: AgentMessage };

export const STORE_MIGRATIONS: readonly Migration[] = [
  // 1: the tables as roadmap 0.5 and 0.8 made them. IF NOT EXISTS, because stores from before versions have them.
  (db) =>
    db.exec(`CREATE TABLE IF NOT EXISTS transcript (seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, message TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS message_ref (channel TEXT NOT NULL, conversation_id TEXT NOT NULL, message_id TEXT NOT NULL,
        seq INTEGER, origin TEXT NOT NULL, PRIMARY KEY (channel, conversation_id, message_id))`),
  // 2: every row names its owner (ADR-044, ADR-119). The tables are rebuilt, not altered, so `owner_id` is NOT NULL
  // with no default: a write that forgets the owner fails. Every existing row goes to the one owner; `seq` is kept.
  (db, ownerId) => {
    db.exec(`CREATE TABLE transcript_2 (seq INTEGER PRIMARY KEY AUTOINCREMENT, owner_id TEXT NOT NULL, at TEXT NOT NULL, message TEXT NOT NULL);
      CREATE TABLE state_2 (owner_id TEXT NOT NULL, key TEXT NOT NULL, value TEXT NOT NULL, PRIMARY KEY (owner_id, key));
      CREATE TABLE message_ref_2 (owner_id TEXT NOT NULL, channel TEXT NOT NULL, conversation_id TEXT NOT NULL, message_id TEXT NOT NULL,
        seq INTEGER, origin TEXT NOT NULL, PRIMARY KEY (channel, conversation_id, message_id))`);
    // The rebuild would reset the row counter to the highest row left, so a deleted row's number could come back.
    const counter = Number(db.prepare(`SELECT seq FROM sqlite_sequence WHERE name = 'transcript'`).get()?.seq ?? 0);
    db.prepare(`INSERT INTO transcript_2 (seq, owner_id, at, message) SELECT seq, ?, at, message FROM transcript`).run(ownerId);
    db.prepare(`INSERT INTO state_2 SELECT ?, key, value FROM state`).run(ownerId);
    db.prepare(`INSERT INTO message_ref_2 SELECT ?, channel, conversation_id, message_id, seq, origin FROM message_ref`).run(ownerId);
    db.exec(`DROP TABLE transcript; ALTER TABLE transcript_2 RENAME TO transcript;
      DROP TABLE state; ALTER TABLE state_2 RENAME TO state;
      DROP TABLE message_ref; ALTER TABLE message_ref_2 RENAME TO message_ref`);
    db.prepare(`DELETE FROM sqlite_sequence WHERE name = 'transcript'`).run();
    db.prepare(`INSERT INTO sqlite_sequence (name, seq) SELECT 'transcript', MAX(?, COALESCE(MAX(seq), 0)) FROM transcript`).run(counter);
  },
];

// `path` is a file in the data directory, or ":memory:" in tests. Every read and write is this owner's (ADR-044).
export function openStore(path: string, ownerId: string) {
  const db = openDatabase(path, ownerId, STORE_MIGRATIONS);
  const insert = db.prepare(`INSERT INTO transcript (owner_id, at, message) VALUES (?, ?, ?)`);
  const select = db.prepare(`SELECT seq, message FROM transcript WHERE owner_id = ? AND seq >= ? ORDER BY seq`);
  const read = db.prepare(`SELECT value FROM state WHERE owner_id = ? AND key = ?`);
  const write = db.prepare(`INSERT INTO state VALUES (?, ?, ?) ON CONFLICT (owner_id, key) DO UPDATE SET value = excluded.value`);
  const refInsert = db.prepare(`INSERT OR IGNORE INTO message_ref VALUES (?, ?, ?, ?, ?, ?)`);
  const refSeq = db.prepare(`UPDATE message_ref SET seq = ? WHERE owner_id = ? AND channel = ? AND conversation_id = ? AND message_id = ?`);
  const refSelect = db.prepare(`SELECT r.seq, r.origin, t.at, t.message FROM message_ref r LEFT JOIN transcript t ON t.seq = r.seq AND t.owner_id = r.owner_id
    WHERE r.owner_id = ? AND r.channel = ? AND r.conversation_id = ? AND r.message_id = ?`);
  return {
    // Returns the message's sequence number.
    append: (message: AgentMessage): number => Number(insert.run(ownerId, new Date().toISOString(), JSON.stringify(message)).lastInsertRowid),
    load: (from = 0) =>
      select.all(ownerId, from).map((row) => ({ seq: Number(row.seq), message: JSON.parse(String(row.message)) as AgentMessage })),
    get<T>(key: string): T | undefined {
      const row = read.get(ownerId, key);
      return row ? (JSON.parse(String(row.value)) as T) : undefined;
    },
    set: (key: string, value: unknown) => void write.run(ownerId, key, JSON.stringify(value)),
    refs: {
      // Returns false when the id is already known: the channel delivered the same message twice.
      // `seq` is the transcript row; a prompt has none, and an owner message gets its row when the session stores it.
      put: (key: MessageKey, origin: string, seq?: number): boolean =>
        refInsert.run(ownerId, key.channel, key.conversationId, key.messageId, seq ?? null, origin).changes > 0,
      stored: (key: MessageKey, seq: number) => void refSeq.run(seq, ownerId, key.channel, key.conversationId, key.messageId),
      get(key: MessageKey): MessageRef | undefined {
        const row = refSelect.get(ownerId, key.channel, key.conversationId, key.messageId);
        if (!row) return undefined;
        const message = row.message == null ? undefined : (JSON.parse(String(row.message)) as AgentMessage);
        return { origin: String(row.origin), ...(message ? { seq: Number(row.seq), at: String(row.at), message } : {}) };
      },
    },
    close: () => db.close(),
  };
}
