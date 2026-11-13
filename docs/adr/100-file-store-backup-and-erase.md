# ADR-100: Binary files never in git; the file store is backed up to object storage; erase reaches every copy Jaari controls

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
ADR-038 keeps files in a content-addressed store outside the memory repository and says the store
"is part of backups", but ADR-027 does not list it or give a method; whether erase (ADR-029)
removes the blob, transcript rows, and existing snapshots was undecided (OQ-87). The owner set
two requirements: git never holds blobs or binary files, uploaded or generated, and files are
backed up to storage suited to files, such as R2 or MinIO.

## Decision
**Git holds text only.** The memory repository holds Markdown and structured records. Every
binary file (uploads, documents, photos, voice-note audio, files the owner keeps from code
execution such as charts and generated documents, browser screenshots) is a blob in the
content-addressed store (ADR-038); memory keeps a pointer and the extracted text. The single
writer (ADR-026) refuses a binary file or any file over 1 MiB in a memory commit.

**Blob backup goes to object storage.** S3-compatible stores only: Cloudflare R2, AWS S3,
Backblaze B2, or self-hosted MinIO (on a NAS, for example), chosen at `jaari init` separately
from the git remotes and snapshot destinations (ADR-027). Upload is incremental: blobs never
change, so a run uploads only blobs the store lacks. Each blob is age-encrypted with the backup
recovery key, and its object name is a keyed hash, so the store cannot tell which known file it
holds. Short-lived blobs (voice-note audio, 30 days, ADR-037; browser screenshots, 30 days,
ADR-052) are not backed up. Without an object store, `jaari doctor` warns that files are not
backed up.

**Snapshots reference blobs.** Each snapshot's manifest lists the blob hashes it references; a blob
stays in the object store while any retained snapshot lists it and is deleted when pruning drops
the last one. Restore and the monthly drill restore and check the blobs the chosen snapshot
lists. The owner may exclude files over a size limit; `jaari doctor` and the panel show what is
excluded.

**Erase reaches every copy Jaari controls, at once:** the memory lines and their git history
(purge, ADR-028); the blob in the local store and in the object store; transcript rows, receipts,
and action-log rows that contain it (ADR-065, ADR-097); FTS entries and derived records
(ADR-029). Older SQLite snapshots are single encrypted archives and keep the erased rows until
retention deletes them; the erase card gives that date and offers "also delete older backups
now", which takes a fresh snapshot and then deletes every older one.

## Alternatives rejected
Blobs in the memory repository or git LFS (repository size, slow clones, and purge rewrites);
blobs inside the nightly archive (every snapshot repeats every file); plaintext hashes as object
names (a store could confirm a known file); always deleting older backups on erase (loses restore
history without the owner choosing it).

## Consequences
_TODO: fill in as implementation reveals them._
