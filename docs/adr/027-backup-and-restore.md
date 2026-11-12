# ADR-027: Backup and restore: owner-chosen destinations and schedule, encrypted archives, monthly drill

- **Status:** Accepted
- **Extended by:** [ADR-038](038-documents-and-files.md), [ADR-079](079-secret-zero-on-servers.md), [ADR-087](087-safety-pieces-ship-with-what-they-protect.md)
- **Date:** 2026-11-10

## Decision
The owner owns the data, so where and how often it is backed up is the owner's choice. Jaari
supplies defaults and checks, never a hard rule.

**What is backed up.** The memory repo; SQLite (jobs and events, device registry, notification
ledger, usage log); `audit.jsonl`; and the config file. The FTS index is a cache and is rebuilt
(ADR-023). The vault backs itself up. Secret zero (OS keychain) is never in a backup.

**Memory.** Pushed through the single writer (ADR-026) to one or more git remotes chosen at
`jaari init`, a few minutes after each commit: a self-hosted git server (for example Forgejo),
a bare repo on another owner device over Tailscale, or a private repo at any git host,
encrypted so the host sees nothing (method in ADR-028). Structured records such as ledgers live
in the memory repo, so they get this minutes-level backup.

**Snapshots.** SQLite, the audit log, and the config are bundled into one encrypted archive
using SQLite's online backup, so the snapshot is consistent. The schedule defaults to nightly
and is configurable by the owner (any interval, or off). Retention defaults to 7 daily, 4
weekly, and 12 monthly and is configurable. Continuous replication with Litestream is an
optional add-on.

**Destinations.** Local disk; another owner device or NAS over the overlay network; and any
S3-compatible store, including AWS S3, Cloudflare R2, Backblaze B2, and self-hosted MinIO.
Credentials are `secretRef` handles (ADR-007). Several destinations can be used at once.

**Advice, not enforcement.** `jaari doctor` reports when every copy sits on the daemon's own
host and recommends at least two copies with one off the host; the owner can acknowledge and
silence that warning.

**Recovery key.** `jaari init` creates an age key for the archives and asks the owner to keep
it outside Jaari (on paper or in their own password manager). Without it the archives cannot
be opened.

**Restore.** `jaari restore <snapshot>` is journaled: the current data is kept under
`pre-restore-<id>/`, the restore can be aborted before install, and it returns typed exit
codes. Afterwards the FTS index is rebuilt and the audit chain verified.

**Drill.** A monthly job (an ADR-025 job, schedule configurable) restores the latest snapshot
into a temporary folder and checks `git fsck`, SQLite `integrity_check`, and the audit hash
chain, then reports one line ("backup verified") or an alert.

Borrowed design: online backup that refuses to overwrite, and the journaled restore with a
kept copy, abort, and exit codes, from gajae-way (design only, `refs/gajae-way/packages/gateway/src/ops/`).

## Alternatives rejected
A manual tar of the data directory (open-instinct; no automation, no test); a fixed backup
schedule or a mandatory off-host copy (the owner decides how much they trust their devices);
backing up the FTS index (a rebuildable cache); including secret zero or vault contents in
archives (one leaked archive would expose every credential); unencrypted archives on a third-
party bucket.

## Amendments
- **ADR-038:** the file store is part of backups.
- **ADR-079:** on a server, secret zero is a `host-credential` file; it is never in a backup,
  and the provider refuses to start if the file is in the backup set.
- **ADR-087:** a nightly local snapshot (last 7, mode 0700) ships in Phase 1; remotes and the
  drill stay Phase 3.

## Consequences
_TODO: fill in as implementation reveals them._
