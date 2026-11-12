# ADR-083: Reference repos are pinned in `scripts/refs.sh` and moved only with `bump`

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
Citations of borrowed designs name `refs/<repo>/<path>` and a pinned commit (ADR-014,
`docs/DEVELOPMENT.md`). `scripts/refs.sh` followed each upstream default branch, and
`refs/INDEX.md` is untracked, so the next sync moved every reference and the cited commits
no longer matched (OQ-84). The script already fetched any branch, tag, or sha named in its
manifest.

## Decision
**Pins live in the tracked script.** Each manifest line in `scripts/refs.sh` names a full
commit sha. `scripts/refs.sh sync` only re-applies the pins. The first pins are the commits the
docs cite: gajae-way `34cbd15`, open-instinct `2e5e71b`, openinstinct `213120c`, openmausbot
`b802268`, pi `469d865`.

**`scripts/refs.sh bump [name...]` is the only way to move a pin.** It fetches the latest
default-branch commit, writes the new full sha into the manifest line, prints old and new
commit with the licence line, and warns when the licence line changed. The owner reviews the
script diff and commits it on its own; when the licence changed, the `AGENTS.md` licence table
is updated first.

**Citations keep their commit.** A citation written after a bump names the new commit.
`refs/INDEX.md` stays generated and untracked.

## Alternatives rejected
Following the default branch and writing "latest" in the docs (citations stop being
checkable); tracking `refs/INDEX.md` (a generated file as the record); hand-editing the sha
(error-prone, and skips the licence check).

## Consequences
_TODO: fill in as implementation reveals them._
