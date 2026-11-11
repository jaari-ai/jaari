# ADR-064: Owner routines: visible routine objects, queued overlaps, cheap checks first, a 14-day check-in, stop by replying

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**A routine is an object the owner can see.** Name, trigger, what to do (a prompt for a child,
optionally a skill (ADR-060) or a pinned script (ADR-036)), where output goes, a budget per run and
per month, an enabled flag, an optional expiry, a revision, run history (receipts, ADR-061), and
run now. Managed in the panel and with `jaari routine list | pause | resume | run | edit | rm`.
Built on the job engine (ADR-025); children do the work.

**Triggers.** A schedule (cron in the owner's timezone, or an interval aligned to its anchor so
"every 2 h" runs on the hour); a watcher (a condition on a source: a price, a page change, a feed,
the inbox); a webhook (OQ-52); one-shot ("remind me", "watch until under €100"), which ends itself
when done.

**Creating one in plain words.** Jaari drafts the routine and shows one confirm prompt with the
schedule and estimated monthly cost. A routine that runs a script is approved at creation and
pinned (ADR-036).

**Run semantics.** When a run is due while the previous one is still going, it is queued (the
default); queued runs coalesce, so at most one waits. Skipping is an option per routine. Catch-up:
one run if within the routine's window (default 12 hours), otherwise a missed-run note in the
digest (ADR-057).

**Cheap first, quiet when empty.** Plain code runs before any model call (fetch and compare, diff,
threshold); the model runs only when something changed. A price watcher finds the price on the page
once, then checks it with code. A run with nothing new posts nothing.

**Output** goes through the persona monitor and notification ledger (ADR-033): a digest by default,
immediately only when urgent or when the owner asked for it.

**Budgets.** Each routine has a cap that counts toward the ADR-046 budget; a routine that reaches
it pauses with one notice.

**Check-in, not a judgement.** After a routine has run for 14 days, Jaari tells the owner once that
it has been running for 14 days and asks whether to keep it or pause it. With no answer or a "keep",
it asks once more after 30 days, then never again for that routine.

**Stop by replying.** A reply to a routine's output such as "stop this" or "stop sending me this,
it's not useful" pauses that routine and records the reason with it (and as a reflection,
ADR-061). The routine can be resumed from the panel.

**Default routines.** An inbox watch when email is connected (ADR-023); the owner's digests
(ADR-033).

**Phase 1**, with the scheduler.

Borrowed: anchor-aligned intervals, overlap handling, catch-up and missed-run receipts, and
code checks before a model call from OpenMausBot (learning/09); the routine row with revision,
enabled flag, expiry, and run now from openinstinct `monitors/types.ts` and `triggers.ts`
(behaviour only) and open-instinct `core/src/scheduler.ts`.

## Alternatives rejected
Routines hidden inside the session; a model call on every tick; an unbounded backlog of queued
runs; posting "nothing new"; repeated check-ins; judging a routine "ignored" from read receipts.

## Consequences
_TODO: fill in as implementation reveals them._
