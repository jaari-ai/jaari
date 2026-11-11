# ADR-061: Learning from outcomes: receipts, reflections, promotions the owner confirms, routing suggestions, a protected core that never learns

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Receipts.** Every child, job, and browser task ends with a receipt of at most 1 KiB: what was
asked, what was done, the outcome, the cost, and links to evidence. Failures and restart orphans
always leave one. Receipts go to the event log (ADR-032), and their summary is folded into the
main session.

**Reflections.** A failure or an owner correction leaves a reflection: what went wrong, the lesson
(the invariant), the next action, and a promotion target (a rule, a skill edit, a fixture, or a
routing change). Reflections live in `reflections/` in the memory repository.

**Promotion.** A lesson is proposed when it recurs (the same lesson twice), or at once after a
single owner correction. The daily audit (ADR-004) groups reflections and puts each proposal in the
digest as one diff (ADR-033, ADR-042), never as an interruption. A dismissed proposal is not raised
again unless the failure recurs; an unanswered one expires after 14 days.

**Routing suggestions.** The outcome log tracks, per role and model, tool-call validity,
escalations, retries, and owner corrections. At most once a month, and only on a clear signal, the
digest suggests a routing change ("child tasks on model X needed escalation 30% of the time; route
them to Y?"). Never automatic (ADR-019). A learned router stays a later item (LLM.md).

**A protected core never learns from outcomes:** the gate, approval rules, capability grants,
security settings, and locked prompts (ADR-042) change only by the owner's explicit action.

**Visibility.** The panel's "What Jaari learned" lists every learned item (rules, skills, urgency
(ADR-033), routing, fetch rungs (ADR-049)) with its source and an undo.

**Phasing.** Receipts in Phase 4 with children; reflections and promotions in Phase 8.

Borrowed: receipts of at most 1 KiB and orphan receipts from openinstinct `children/receipts.ts`
(behaviour only); reflection promotion from gajae-way `monitors/propagate.ts` (design only), made
stricter by requiring the owner's confirmation.

## Alternatives rejected
Automatic promotion of lessons into rules (gajae-way's default); interrupting the owner with
proposals; automatic routing changes; letting outcomes tune the gate or grants; learned items the
owner cannot see or undo.

## Consequences
_TODO: fill in as implementation reveals them._
