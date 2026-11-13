# ADR-026: Memory writes go through one writer; the owner's edits win

- **Status:** Accepted
- **Extended by:** [ADR-100](100-file-store-backup-and-erase.md)
- **Date:** 2026-11-10

## Decision
**One writer.** A single component in the daemon is the only code that touches the memory
repo. Capture, structured records (ADR-023), canonicalize, audit fixes, the panel's memory
editor, and git pulls and pushes all submit changes to it.

**Closure ladder per change:** record the intent; write the files; commit with trailers
(mutation id, actor, source session); update the FTS index (ADR-023); mark the intent done.
After a crash a half-done intent is either completed or found by its mutation id in git; one
that cannot be recovered is quarantined, never deleted.

**Writers.**
- Fast writers (capture, structured records) submit small changes applied in order.
  Append-only records (ledgers, daily logs) only add lines, so they never conflict.
- Canonicalize (an ADR-025 job) works on a snapshot and submits a patch against the commit it
  read. If the base moved, the writer applies it file by file: untouched files apply cleanly;
  a file changed on both sides is a conflict, its part of the patch is dropped, and that file
  is redone on the next run. Nothing is force-merged.
- **The owner's edits.** Before each commit the writer checks for changes it did not make and
  commits them first as a separate commit with `actor: owner`. When the owner and Jaari change
  the same file, the owner's edit wins and Jaari's change is redone against it.
- Pulls and pushes to the git remote go through the same writer (ADR-027; other devices and host moves in ADR-058).

Borrowed design: the closure ladder, mutation-id trailers, and quarantine from gajae-way
(design only, `refs/gajae-way/packages/gateway/src/memory/closure.ts`).

## Alternatives rejected
A lock held by whoever writes (canonicalize holds it for minutes and blocks capture; a crash
leaves a stale lock); a git branch per task merged afterwards (Markdown merge conflicts and
heavy machinery for a personal repo); folding the owner's hand edits into Jaari's commits
(history no longer shows who changed what); letting Jaari's change win a conflict (the owner
is the authority on their own memory).

## Amendments
- **ADR-100:** the single writer refuses binary files and files over 1 MiB in a memory commit.

## Consequences
_TODO: fill in as implementation reveals them._
