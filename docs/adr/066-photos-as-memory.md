# ADR-066: Photos as memory: photo notes in the file store, the vision role as the owner routed it, location kept, face recognition planned for later

- **Status:** Accepted
- **Extended by:** [ADR-093](093-sensitive-content-follows-routing.md)
- **Date:** 2026-11-12

## Decision
**A photo or screenshot the owner sends becomes a photo note.** The file goes into the
content-addressed store (ADR-038). The `vision` role writes a short description, and OCR (ADR-038
ladder) extracts any text. Memory holds a note with a pointer to the hash, the description, the
text, the date taken, and the location, indexed in FTS5 (ADR-023), so "the photo of the boiler
label" can be found. Answers can attach the photo.

**Records offered with a quote**, as for documents (ADR-038): a receipt becomes a ledger line, a
ticket an event, a product label a note.

**Which model reads photos is the owner's setup.** The `vision` role goes to any configured model
that accepts images, through normal routing (role, tier, fallback chain; LLM.md): local-only,
hybrid, or API, as chosen at `jaari init` (ADR-045, ADR-046). There is no forced local-only path
for photos. The owner can make the `vision` role local-only, or route images marked sensitive to a
different model, in config.

**Location is kept.** The EXIF date and GPS position stay in the stored file and in the photo
note, so "where did I park" and "photos from Lisbon" work. Images Jaari sends out keep their
metadata unless the owner turns on removing location when sending.

**No face recognition in v1.** Descriptions may say "two people at a table" but do not identify
anyone. The owner may tag people in a photo; tags are plain text on the note. Face recognition is
a planned future feature (ROADMAP, Later) and needs its own ADR, because face data is biometric.

**Not memory.** Jaari's own browser screenshots are logs, kept 30 days (ADR-052). Images from
others or the web follow the 30-day retention of ADR-038 unless the owner keeps them or they
become a record. Voice notes follow ADR-037.

**Untrusted content.** Text read from an image (OCR or description) goes through the `reader`
role, as for documents (ADR-038).

**Daily audit** (ADR-004): stored files without a note, notes pointing to a missing file,
duplicates by hash, and retention expiry. The audit and canonicalize (ADR-047) work on the
descriptions and text only; they never re-read the images.

**Later:** image similarity search ("photos like this") and albums.

**Phase 5**, with documents (ADR-038).

## Alternatives rejected
Keeping photos only as files without a note (they could not be found by content); forcing local
models for photos regardless of the owner's setup; removing GPS by default; face recognition in
v1; treating Jaari's own screenshots as memory; re-reading images in every audit.

## Amendments
- **ADR-093:** "marked sensitive" uses the ADR-093 marking rules.

## Consequences
_TODO: fill in as implementation reveals them._
