# ADR-025: Scheduler and job engine: a small SQLite queue built to pi-durable's contract

- **Status:** Accepted
- **Date:** 2026-11-10

## Decision
Jaari runs its own small job engine in the daemon, shaped so `pi-durable` (`refs/pi`, commit in
`refs/INDEX.md`, currently marked Experimental) can replace it later. The agent loop stays on
`pi-agent-core` (ADR-001).

- **Store.** One SQLite table of jobs and an append-only events table; a job's status can
  always be rebuilt from its events.
- **Job kinds.** One-shot (at a time), cron in an IANA time zone, interval aligned to an
  anchor, and child task (background work spawned by the main session). Each job has an owner-
  visible id and revision so routines (ADR-064) can list, pause, run now, and expire it.
- **Crash safety.** Every tool call records its intent before it runs, with a `replay: safe |
  unsafe` flag. After a crash, a safe step reruns once; an unsafe step that had started is
  never rerun: the job settles `ambiguous` and the owner is told (ADR-016 restart rule).
  Provider calls are retried only from protocol state, never from error text.
- **Missed runs.** One catch-up run per job if the slot was missed within its catch-up window,
  otherwise a "missed while I was down" receipt and a jump to the next slot. The window is a
  per-job setting with a default of 12 hours. A laptop waking from sleep (ADR-017) triggers the
  same check.
- **Daylight saving.** A local time that does not exist is skipped; a repeated one fires once.
- **Retries.** At 0, 10 minutes, 1 hour, 4 hours, and 12 hours; then the job is terminal and the
  owner is told once.
- **Overlap.** Per job, `skip` (default) or `queue`.
- **Boundary.** The engine exposes submit, cancel, list, and an event stream only, so it can be
  swapped for `pi-durable` when that leaves Experimental.

Borrowed designs: the replay flag and intent record from Pi `packages/durable`; cron per zone,
DST handling, and one catch-up run from openinstinct's monitor scheduler (behaviour only); slot
claiming, the retry ladder, and overlap modes from gajae-way (design only).

## Alternatives rejected
`pi-durable` as both loop and engine now (Experimental API that changes without notice; it owns
the agent loop; still no cron, time zones, or missed-run policy); a generic queue library such
as BullMQ or Agenda (needs Redis or MongoDB, too heavy for a home box, and knows nothing about
effects or replay); at-most-once firing with no retries (open-instinct; a transient failure
loses the run); replaying every missed slot (a burst of stale runs after downtime).

## Consequences
_TODO: fill in as implementation reveals them._
