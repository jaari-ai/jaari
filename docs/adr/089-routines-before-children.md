# ADR-089: Routines in Phase 1 run code and one tool-less model step; delivery starts with the ledger

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-064 places routines in Phase 1 and says "children do the work", but children and their
receipts ship in Phase 4 (ADR-061) and routine output must pass the notification ledger
(Phase 2, ADR-033). Budgets ship in Phase 1 (ADR-087). ADR-064 already runs plain code first and
the model only when something changed, and ADR-061 gives every job a receipt (OQ-73). This ADR
changes when parts ship.

## Decision
**Phase 1.** The routine object; schedule and one-shot triggers; `jaari routine` commands; run
history with job receipts written by the job engine; per-routine caps counted against the
monthly budget. A Phase 1 routine runs plain code steps and at most one model step with no
tools, on the `child` role through `@jaari/llm`.

**No proactive delivery in Phase 1.** Results stay in the run history; the owner reads them
with `jaari routine runs` or by asking the main session, which can read the history. All routine
output keeps passing the persona monitor and the ledger.

**Phase 2.** Delivery turns on with the ledger: the digest by default, immediately when urgent
or asked for (ADR-064). Reminders, as one-shot routines, are delivered from here, and late
delivery after sleep (ADR-057) ships with them.

**Later.** Phase 4: the model step runs as a child with tools; script steps with code execution
(ADR-036); watcher triggers on web pages with `web.fetch`. Phase 5: watcher triggers on the
inbox; webhooks (ADR-073).

## Alternatives rejected
Moving routines to Phase 4 (no early test of the job engine with real routines); a separate
delivery path for reminders before the ledger (a second path for proactive output).

## Consequences
_TODO: fill in as implementation reveals them._
