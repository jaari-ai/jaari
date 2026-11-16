// The event log: one JSON object per line (NDJSON), for everything that happened (ADR-032).
// Events carry names and counts, never message text or tool arguments, so no secret reaches the log.
import { appendFileSync } from "node:fs";

export type EventLog = { write(event: { type: string } & Record<string, unknown>): void };

// shortcut: one file that only grows; add the 30-day retention of ADR-032 with `jaari doctor` (0.12).
export function openEventLog(path: string): EventLog {
  return { write: (event) => appendFileSync(path, JSON.stringify({ at: new Date().toISOString(), ...event }) + "\n") };
}
