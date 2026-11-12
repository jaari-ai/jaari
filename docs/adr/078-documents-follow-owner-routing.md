# ADR-078: Documents follow the owner's model routing; no forced local-only path for sensitive files

- **Status:** Accepted
- **Date:** 2026-11-12

## Decision
**Documents are read by the models the owner routed, like photos (ADR-066).** Reading, OCR, and
summarising of every file, including files recognised as sensitive (identity documents,
medical, bank and tax statements; ADR-023 levels), go to the roles' configured models through
normal routing (LLM.md): local-only, hybrid, or API, as chosen at `jaari init` (ADR-045,
ADR-046). This replaces ADR-038's "sensitive documents stay local", which was on by default.

**The owner can still keep them local.** Config can make the roles that read files local-only,
or route files marked sensitive to a chosen model; a local-only role keeps failing closed
(ADR-011). `init` explains the choice once, with its trade-off.

**Unchanged.** Parsing in the sealed sandbox, the `reader` role for extracted text, and
canonicalize's rule that sensitive lines are left out of an API batch (ADR-047), which is a
separate decision about the owner's own memory.

## Alternatives rejected
Keeping a forced local-only path for sensitive documents while photos follow routing (two rules
for the same kind of content); removing the option to keep them local.

## Consequences
_TODO: fill in as implementation reveals them._
