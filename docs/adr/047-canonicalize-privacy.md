# ADR-047: Canonicalize privacy: local-only by default, bounded passes, sensitive lines never sent to an API

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Default confirmed (ADR-019).** Canonicalize is local-only when a local model qualifies with
`jaari llm eval`; otherwise the owner chooses at `jaari init`, and canonicalize does not run until
they do.

**Bounds per pass.**
- At most 20 capture files and 64 KiB of input; the rest waits for the next pass.
- A 45-minute timeout.
- Raw daily files are hashed before and after the pass; any change fails it.
- The model proposes edits; the daemon applies them through the single writer (ADR-026) as one
  commit with actor `canonicalize`.
- Append-only records such as ledgers are never edited (ADR-023).

**Sensitive lines stay local.** When the owner allows an API model for canonicalize, lines at the
`sensitive` level (ADR-023: health, identity numbers, finances) are left out of the API batch.
They wait for a local pass if a local model is available; otherwise they stay in the daily log,
searchable, and are not folded into `profile/`. This matches ADR-038 for sensitive files.

**Checks after the pass.** Every changed `profile/` line must carry a source quote from a daily
file (the capture rule, OQ-53); a fact without a source is rejected. A pass that would delete more
than 20% of a profile file is held for the owner's review instead of committed.

**Visibility.** Each pass logs input size, model, and duration (ADR-032); the digest shows a line
such as "memory tidied: 12 facts updated" with a link to the diff; `jaari memory canonicalize
--dry-run` shows what a pass would change. Prompt wording changes the result, so the canonicalize
prompt is covered by the golden set (ADR-041, ADR-042).

Borrowed: the per-pass bounds, raw-file hashing, and "the model writes, the daemon commits" from
openinstinct `memory/adapters/canonicalize.ts` (behaviour only).

## Alternatives rejected
API canonicalize by default (it reads the most sensitive data); sending sensitive lines to an
allowed API model; unbounded passes; letting the model commit directly; reviewing every pass
(nagging once the fixtures pass).

## Consequences
_TODO: fill in as implementation reveals them._
