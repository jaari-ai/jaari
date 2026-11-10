# Jaari: Memory

- Separate git repo of Markdown on the gajae-way axes (ADR-003). Suggested layout:
  `profile/` (owner facts and preferences), `daily/YYYY-MM-DD.md` (raw log),
  `people/`, `projects/`, `gaps/queue.md` (what Jaari does not know yet).
- `canonicalize` runs every 6 hours: folds daily logs into `profile/`, commits with a
  summary, and rewrites the gap queue (ADR-004).
- Daily audit: contradictions, stale facts, orphan files; results to the owner digest.
- Canonicalize reads the most sensitive data, so its model tier is local-only by default
  if a capable local model passes the fixtures (ADR-011, OQ-24, OQ-26).
- Proposed line conventions, after OpenMausBot (learning/09): entries are dated and name
  their source; a superseded fact is struck through with the date instead of deleted; an
  `until YYYY-MM-DD` suffix stops a line loading after that day. Rules the owner stated
  ("always", "never") and health or safety facts are never moved or archived by upkeep.
- Proposed capture rule (OQ-53): a captured fact carries the owner's quoted words; code
  checks the quote and rejects numbers, paths, and URLs that are not in it.
- Recalled memory is placed in front of the owner's message inside a fenced data block,
  within a fixed budget, never in the cached prompt prefix (OQ-04).
- Structured records (ADR-023): typed records (ledger, event, task, commitment, tracker,
  recurring bill, person, document and expiry, metric log, goal, list, trip, place, and custom
  types) under schemas in `ops/schemas/`. The model fills fields; code computes totals, dates,
  and run-out; ledgers are append-only and canonicalize never edits them. Capture is immediate.
- Search (ADR-023): `memory.search` over SQLite FTS5, a cache rebuilt from the Markdown, with a
  freshness check before each query; embeddings later, local-only.
- Open: context assembly (OQ-04), concurrent writes (OQ-06),
  encryption (OQ-08), forgetting (OQ-09), backup (OQ-07), capture evidence (OQ-53).
