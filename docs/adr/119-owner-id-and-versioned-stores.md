# ADR-119: The owner id comes from `jaari init`; every store is versioned, owned, and opened through one function

- **Status:** Accepted
- **Date:** 2026-11-17

## Context
ADR-044 says every record carries an `ownerId`, and ADR-056 says each SQLite store has a schema
version, migrates when it opens, and is refused by a binary older than it. Neither says where the
id comes from or what a store does when the id is wrong. Building roadmap 0.14 on stores that
already hold data (`session.db`, `usage.db`, the event log) needed both answers, and the
migration step that roadmap 0.12 lists.

## Decision
- **The id is made once.** `jaari init` writes a random lowercase UUID to `owner.id` in the
  config (ADR-118) the first time it runs, and never replaces it. It is an id, not a secret.
- **Reading and starting differ.** The config loader accepts a config with no `owner.id`, so
  `jaari init` can add it to a config written before this ADR. The daemon refuses to start
  without it, before it writes anything, and names the fix.
- **Event lines** carry `ownerId` as their last field, so an event cannot replace it.
- **One way to open a store.** `openDatabase(path, ownerId, migrations)` in `@jaari/core`:
  1. refuses a store that belongs to another owner, before it reads or migrates anything;
  2. refuses a store whose `user_version` is higher than the number of steps it knows (ADR-056);
  3. runs the missing steps in order, each in one transaction with its version number, so a
     failed step leaves the store as it was;
  4. records the owner in the store's `owner` table in the same transaction as the first step, so
     no store is ever versioned but unowned; one that is anyway holds rows of an unknown owner
     and is refused, never claimed.
- **Why a store records its owner.** Every query is scoped to the owner, so opening a store with
  the wrong id would not fail: it would show an empty transcript and look like a new session.
  The `owner` table turns that into a refusal. A multi-owner instance (ADR-044) adds rows there
  on purpose, through its own ADR.
- **Every record carries the owner.** SQLite tables have an `owner_id TEXT NOT NULL` column with
  no default, so a write that forgets the owner fails; each line of the event log has `ownerId`.
  Step 2 of `session.db` and `usage.db` rebuilds the tables with the column and gives every
  existing row to the one owner. Transcript row numbers are kept, and so is the row counter: a
  number used before, even by a row deleted before the migration, is never handed out again.
- **A package owns its schema.** `@jaari/llm` cannot import `@jaari/core`, so the usage log
  exports its steps (`USAGE_MIGRATIONS`) and takes an opened database; the daemon joins the two.
- **A released step is never edited.** Stores in the field have already run it; a change is a
  new step.

## Alternatives rejected
- **A fixed id such as `"owner"`:** a second owner later would need a real id, and every row
  would be rewritten: the migration ADR-044 exists to avoid.
- **An id made by the daemon on first start:** two installs pointed at one data folder, or one
  install at another's data, could not be told apart from the config.
- **Scoping queries without recording the owner:** a wrong id looks like an empty store.
- **`ALTER TABLE … ADD COLUMN owner_id … DEFAULT ''`:** the default stays in the schema, so a
  write that forgets the owner succeeds with an empty id.
- **Bumping the config version to add the id:** a migration cannot invent a stable random id in
  memory; the id must be written to the file once, which is init's job.

## Consequences
- Until `jaari update` ships its pre-update snapshot (roadmap 0.12, ADR-082), a migration is
  protected only by its transaction: it cannot leave a half-changed store, but there is no
  copy from before it. The steps so far only add a column.
- Event-log lines written before this ADR have no `ownerId`; they leave with the 30-day
  retention (ADR-032).
- Stores that later phases add (memory index, jobs, audit, grants, files) open through
  `openDatabase` and carry `owner_id` from their first step.
- The message-reference table of ADR-117 gained `owner_id`; its key is unchanged.
