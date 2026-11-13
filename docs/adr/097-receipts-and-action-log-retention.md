# ADR-097: Receipts and the browser action log are kept 90 days in SQLite; effects stay forever in the audit log

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
Receipts were "operational rows" kept 7 days (ADR-029) and also event-log entries kept 30 days
(ADR-061, ADR-032); the browser action log was "kept forever" (ADR-052) (OQ-81). Routine run
history (ADR-064), Phase 8 reflections (ADR-061), and the browser fixtures and origin review
(ADR-051, ADR-052) read them. Every decision and effect, including browser commitments, is
already in `audit.jsonl`, kept forever (ADR-032).

## Decision
| Record | Lives in | Kept |
|---|---|---|
| Receipts (jobs, children, browser tasks) | A `receipts` table in SQLite, also written to the event log | 90 days in SQLite, configurable; the event-log copy follows the event log |
| Browser action log, each action with its snapshot | The same SQLite store, linked to the task's receipt | 90 days, configurable |
| Browser screenshots | Unchanged | 30 days (ADR-052) |
| Decisions and effects, browser commitments included | `audit.jsonl` | Forever (ADR-032) |
| Other operational rows (delivered notifications, finished job rows) | Unchanged | 7 days (ADR-029) |

Forget and erase apply to receipts and the action log; the audit log keeps only "forgotten" or
"erased" (ADR-029). Backups include the SQLite store (ADR-027).

## Alternatives rejected
7 days (too short for routine history and reviews); keeping the full action log forever (page
activity piles up and adds nothing the audit log lacks for effects); receipts only in the event
log (30 days, and not queryable by routine).

## Consequences
_TODO: fill in as implementation reveals them._
