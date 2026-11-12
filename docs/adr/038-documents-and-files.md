# ADR-038: Documents and files: content-addressed store, sealed parsing, sensitive files local-only, disk watch

- **Status:** Accepted
- **Extended by:** [ADR-037](037-voice.md), [ADR-066](066-photos-as-memory.md), [ADR-078](078-documents-follow-owner-routing.md)
- **Date:** 2026-11-11

## Decision
**Ways in.** Attachments on any channel; uploads in the panel; email attachments (Phase 5); and
a drop folder, `~/Jaari/inbox` on the host by default (configurable), plus one on each node that
has the files capability. A dropped file is ingested, moved into the store, and mentioned in the
next digest (ADR-033).

**Limits.** 10 files per message and 25 MB each, configurable; a channel's own lower limit
applies. A file over a limit still arrives as one line naming it, its size, and the panel upload
as the way in; it is never dropped silently.

**Storage.** A content-addressed store, `data/files/<sha256>`, mode 0600, outside the memory git
repository. Memory holds a note or record that points to the hash, with the extracted text. The
store is part of backups (ADR-027).

**Retention** (ADR-029): files the owner sends are kept, with no size quota; files from others or
the web 30 days unless the owner keeps them or they become a record; temporary sandbox outputs 7
days unless saved.

**Disk watch instead of a quota.** The daemon tracks free space on every volume it writes
(data, files store, drop folders, memory, backups). It notifies the owner at 80% and 90% used
(default thresholds, configurable), and urgently at 95% (ADR-033). Below 2% or 1 GB free, it
stops accepting new files and says so, to protect SQLite, git, and the audit log. `jaari doctor`
and the panel show use per volume and the largest stored files.

**Parsing in a sealed sandbox** (ADR-036), because file parsers are a common exploit target. A
ladder like `web.fetch`'s: the text layer first (candidates: pdf.js or PDFium, mammoth for DOCX,
SheetJS for spreadsheets); OCR for scans and photos (local Tesseract by default, or the `vision`
role); LibreOffice headless as an optional sidecar for legacy formats; Docling (MIT) as an
optional richer parser for tables and layout. Final picks are made with fixtures at
implementation.

**Sensitive documents stay local.** Files recognised as sensitive (identity documents, medical,
bank and tax statements; ADR-023 sensitivity levels) are read, OCR'd, and summarised by local
models only, even when the main session uses an API model. On by default; the owner can turn it
off. Without a qualified local model, Jaari stores the file, says it cannot read it locally, and
asks.

**Untrusted content.** Extracted text goes through the `reader` role, including the owner's own
files.

**Search and quoting.** Extracted text is indexed in FTS5 (ADR-023) with file and page; answers
quote the page ("page 3 of lease.pdf") and can attach the file.

**Records from documents.** Jaari offers records with a quote: a passport becomes a document
with an expiry, a receipt a ledger line, a bill a recurring bill (ADR-023).

**Files out.** Jaari produces files (PDF, CSV, charts) in the sandbox and sends them as
attachments.

Borrowed: attachment limits, hashed names, and the over-limit line from open-instinct
`packages/inkbox/src/hydration.ts`; "the message arrives even when the bytes do not" and 0600
files from gajae-way `packages/adapter-telegram/src/attachments.ts` (design only).

## Amendments
- **ADR-066:** photos and screenshots are read by the `vision` role as the owner routed it
  (local-only, hybrid, or API); the sensitive-documents local-only rule does not force local
  models for photos.
- **ADR-078:** documents, sensitive ones included, are read by the models the owner routed
  (local-only, hybrid, or API); "Sensitive documents stay local" is no longer forced, and the
  owner can still make those roles local-only.
- **ADR-037:** voice-note audio is deleted after 30 days, an exception to "files the owner sends are kept".

## Alternatives rejected
Storing binaries in the memory git repository (history bloat); a fixed storage quota (the owner
owns the disk; a watch is enough); parsing in the daemon process (a malformed file would run with
the daemon's rights); sending sensitive documents to API models by default; dropping oversized
files silently.

## Consequences
_TODO: fill in as implementation reveals them._
