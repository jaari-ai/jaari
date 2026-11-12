# Jaari: Memory

- Separate git repo of Markdown on the gajae-way axes (ADR-003). Suggested layout:
  `profile/` (owner facts and preferences), `daily/YYYY-MM-DD.md` (raw log),
  `people/`, `projects/`, `gaps/queue.md` (what Jaari does not know yet).
- `canonicalize` runs every 6 hours: folds daily logs into `profile/`, commits with a
  summary, and rewrites the gap queue (ADR-004).
- Daily audit: contradictions, stale facts, orphan files; results to the owner digest.
- Canonicalize reads the most sensitive data, so its model tier is local-only by default
  if a capable local model passes the fixtures (ADR-011, ADR-045, ADR-047); passes are bounded, sensitive lines never go to an API model, and a pass deleting over 20% of a file is held for review.
- Line conventions (ADR-029, ADR-074; after OpenMausBot, learning/09): entries are dated and
  name their source; a superseded fact is struck through with the date instead of deleted.
  Rules the owner stated ("always", "never") and health or safety facts are never moved or
  archived by upkeep. Proposed, not decided: an `until YYYY-MM-DD` suffix that stops a line
  loading after that day.
- Capture evidence (ADR-074): raw capture is mechanical; every derived fact carries a quote and
  source id that code checks, including every number, date, path, and URL; facts from others'
  content are "according to" until confirmed; inferred facts are marked and never drive actions
  until confirmed; commits carry actor and source trailers.
- Context assembly (ADR-024): code builds each prompt in a fixed layout. Upcoming events (14
  days), trackers, budget, commitments, and warnings go in front of the owner's message;
  dates mentioned in a message pull in records from that window at any distance; a horizon
  line points past 14 days. Recall is fenced as data and never in the cached prefix.
- Structured records (ADR-023): typed records (ledger, event, task, commitment, tracker,
  recurring bill, person, document and expiry, metric log, goal, list, trip, place, and custom
  types) under schemas in `ops/schemas/`. The model fills fields; code computes totals, dates,
  and run-out; ledgers are append-only and canonicalize never edits them. Capture is immediate.
- Search (ADR-023): `memory.search` over SQLite FTS5, a cache rebuilt from the Markdown, with a
  freshness check before each query; embeddings later, local-only.
- Writes (ADR-026): one writer applies every change (intent, files, commit with mutation id,
  actor, and session trailers, index update); the owner's hand edits are committed separately
  and win any conflict.
- Backup (ADR-027): memory pushed to owner-chosen git remotes within minutes; snapshots of
  SQLite, audit log, and config on an owner-set schedule (nightly by default) to local disk,
  a NAS, or S3-compatible storage; monthly restore drill.
- Sensitive content (ADR-093): records, files, photos, and lines at the `sensitive` level
  follow the owner's routing like any other content, so the main session can answer about
  them; privacy comes from making roles local-only. The level is set by record type,
  deterministic rules, a local `classify` role, or the owner, and canonicalize still keeps
  sensitive lines out of an API batch (ADR-047).
- Encryption (ADR-028): secrets are blocked before they reach memory; a secret in an owner
  message is replaced with `[secret removed: <kind>]` at channel ingress, before the transcript
  and the daily log, and the owner is told to rotate it (ADR-081); remotes not owned by the
  owner are encrypted; `jaari memory purge` rewrites history.
- Forgetting (ADR-029): corrections supersede and keep the old line struck through; forget
  removes a fact and can always be undone; erase rewrites history and cannot. The owner asks in
  plain words and confirms a preview; every line carries a source id so forgetting a source
  cascades.
- Retention (ADR-029, ADR-097): raw daily logs forever; others' messages 30 days; receipts and
  the browser action log 90 days in SQLite; delivered notifications and finished job rows 7
  days; the audit log forever, with forgotten or erased items as a bare mark.
- Files (ADR-038): attachments and dropped files live in a content-addressed store outside the
  git repo; memory keeps a pointer and the extracted text, indexed with page numbers.
