// The event log: one JSON object per line (NDJSON), for everything that happened (ADR-032).
// Events carry names and counts, never message text or tool arguments, so no secret reaches the log.
import { appendFileSync, existsSync, readFileSync, writeFileSync } from "node:fs";

export type EventLog = { write(event: { type: string } & Record<string, unknown>): void };

// Lines older than `retentionDays` are dropped when the log opens, before anything writes (ADR-032: 30 days).
// Every line names its owner (ADR-044); lines from before roadmap 0.14 have none and age out with the retention.
// shortcut: trimmed only at start; a daemon that runs for months keeps old lines until its next restart.
export function openEventLog(path: string, ownerId: string, retentionDays = 30, now = Date.now()): EventLog {
  if (existsSync(path)) {
    const cutoff = new Date(now - retentionDays * 86_400_000).toISOString();
    const lines = readFileSync(path, "utf8").split("\n").filter(Boolean);
    // ISO times sort as text; a line that does not parse is kept rather than lost.
    const kept = lines.filter((line) => {
      try {
        return (JSON.parse(line) as { at?: string }).at! >= cutoff;
      } catch {
        return true;
      }
    });
    if (kept.length < lines.length) writeFileSync(path, kept.map((line) => line + "\n").join(""), { mode: 0o600 });
  }
  return { write: (event) => appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), ownerId, ...event }) + "\n", { mode: 0o600 }) };
}
