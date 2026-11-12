# ADR-029: Forgetting and retention: correct, forget, or erase, by plain request

- **Status:** Accepted
- **Extended by:** [ADR-095](095-missing-capability-names.md), [ADR-097](097-receipts-and-action-log-retention.md)
- **Date:** 2026-11-10

## Decision
Three different things, by what the owner wants:
- **Correction** (a fact changed). The new fact supersedes the old one, which is struck through
  with the date and kept, with its evidence quote (ADR-023). Done by capture or canonicalize.
- **Forget** ("stop knowing it"). The fact is removed from the current files and from
  structured records, and its FTS entries are rebuilt. A forgotten entry (a hash plus a short
  label, never the text) stops canonicalize relearning it from older daily logs. It stays in
  git history, so **forget can always be undone**.
- **Erase** ("it was never stored"). `jaari memory purge` (ADR-028) rewrites history on the
  host and on every remote Jaari pushes to. **Erase cannot be undone.**

**No exact commands needed.** The owner asks in plain words. The model recognises the intent
and proposes it as an action; it never forgets or erases on its own. Code finds everything
affected (including derived facts and records) and shows a preview. Forget needs the owner's
yes and can be undone; erase is irreversible and goes through the approval gate like an
external effect, with the card showing exactly what will be erased, bound to its digest
(ADR-006). When the wording is ambiguous, Jaari asks once: "just stop using it, or remove it
completely, including history?"; with no answer, the default is forget. `jaari memory forget`
and `jaari memory purge` exist in the CLI and the panel for precision.

**Forget by source.** Every fact and record line carries a source id (conversation, email,
document, channel, node). Forgetting a conversation, disconnecting an account, or unpairing a
node (ADR-022) forgets everything derived from it as one cascade; the owner chooses forget or
erase for it.

**Retention defaults (all configurable).** Raw daily logs: kept forever (they are the source
canonicalize works from). Copies of other people's messages kept for drafts and alerts: 30
days. Operational rows (delivered notifications, finished jobs, receipts): 7 days. The audit
log: never pruned; a forgotten or erased item appears there as "forgotten" or "erased" with no
content. Rules the owner stated and health or safety facts are never moved or archived by
upkeep; the owner can still forget or erase them.

Borrowed: forget by source and the 30-day window for others' messages from Pally (learning/11);
the forgotten list from OpenMausBot (learning/09); supersede-don't-delete from gajae-way
(design only).

## Alternatives rejected
Strike-through only (the text stays readable); always rewriting history to forget (breaks
every remote's history for routine use); an undo window that expires (data stays in history
anyway, so a deadline only adds a rule to remember); exact commands as the only way in; acting
on a forget or erase request without a preview and confirmation; deleting raw daily logs on a
timer.

## Amendments
- **ADR-095:** erase is the capability `memory.erase`, Allow once and never grantable.
- **ADR-097 (resolves OQ-81):** receipts leave the 7-day operational group; they and the
  browser action log are kept 90 days in SQLite.

## Consequences
_TODO: fill in as implementation reveals them._
