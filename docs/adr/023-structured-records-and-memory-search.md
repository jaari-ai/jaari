# ADR-023: Structured records first, SQLite FTS5 search behind one tool

- **Status:** Accepted
- **Date:** 2026-11-10

## Decision
**Why.** Three failures the owner hit with Instinct set the requirements: a budget balance
that drifted because the model kept a running total in prose; a doctor's appointment
forgotten after seven days because "pills" never matched "appointment" and nothing computed
the pills left; and important emails never surfaced unless the owner named the senders (that
last one is carried to OQ-13 and OQ-43). Numbers and dates are not search problems.

**1. Structured records.** A general mechanism for typed records, with a schema per type in
`ops/schemas/<type>.md` in the memory repo. Records stay Markdown in git: one line per entry
(ledgers, logs) or one file per record (people, documents), so the owner can read and fix
them. Rules that apply to every type:
- The model fills fields; code computes. Totals, balances, run-out dates, next due dates, and
  overdue flags are computed by code from the entries and never written by the model.
- Capture is immediate: when the owner, or an email read by the `reader` role, says something
  that fits a type, the model proposes a typed record with a quote of its source; code checks
  the fields and the quote (ADR-074) and writes it. Each entry is confirmed back to the owner
  with its computed effect (for example the new balance).
- A type may declare: append-only (corrections are new lines, never rewrites, and canonicalize
  never edits it); always-in-context with a window (for example events in the next 14 days,
  handed to the assembler of OQ-04); warnings with a lead time; and a sensitivity level that
  keeps health and money on local-only models where one qualifies (ADR-019).

**Built-in types in v1:** ledger, event, task, commitment and follow-up, tracker (quantity and
rate), recurring bill and subscription (feeds the ledger and events), person, document and
expiry, metric log, goal and habit, list, trip, and place. Health records are never archived
or compressed.

**Custom types in v1.** The owner can define a type by asking or by writing the schema file.
The model may propose a new type; creating it needs the owner's approval, like installing a
skill.

**2. Search.** One `memory.search` tool over SQLite FTS5 from day one: `porter` and `trigram`
tokenizers (stemming and typo tolerance), `unicode61` accent folding, and column weights (tags
and titles above body). Code adds axis priority (profile and rules above raw daily logs) and
linked-note expansion. The Markdown files stay the source of truth and the index is a cache:
rebuilt from the files on start; Jaari's own writes update it through the single writer
(ADR-026); a freshness check by modification time and hash before each search re-indexes files
edited by hand or pulled from git; if the index is missing or corrupt, search scans the files.
Embeddings come later as an optional layer behind the same tool, local-only by default.

**Eval fixtures from these failures** (OQ-20): a budget with 20 expenses must report the exact
balance; an appointment told seven days earlier must be found from a question about pills,
with the run-out date computed; a mailbox of 200 mixed messages must surface the bill, the
appointment change, and a frequent contact's reply without being told any sender.

## Alternatives rejected
Grep or keyword search only (misses synonyms and typos, Instinct's documented failure); a
BM25 scan with no index (simpler, but weaker ranking and no prefix, phrase, or typo
tolerance, for little saved effort); embeddings as the first or primary store (opaque, an
index that can drift, and the most sensitive data leaves the box on an API tier); a vector or
SQLite database as the store of record (ADR-003); keeping numbers and dates as prose facts
that the model updates (the cause of the drift); three special-case record kinds instead of
one mechanism.

## Consequences
_TODO: fill in as implementation reveals them._
