# ADR-129: The daemon copies the data when a new version starts, and the copy names that version

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
[OQ-96](../OPEN_QUESTIONS.md): under Compose the image is the version (ADR-123), and the daemon took a
snapshot only before it migrated a store (ADR-122). After an image update that migrated nothing,
`admin rollback` had nothing from before the update. Worse, it could restore an older
`pre-migration` snapshot from an earlier update, and the data written since would be lost.
`scripts/check-update.mjs --docker` found the gap on 2026-11-20 (ADR-127). `jaari update` on npm
takes its own `pre-update` snapshot (ADR-124), but a manual `npm install` did not. The owner
accepted the leaning on 2026-11-21. Docker is the main install (ADR-128).

## Decision
1.  **The daemon remembers the version that started last,** in `last-version` in the data folder. It
    writes the file at the start, before it opens a store.
2.  **A start as another version copies the data first.** The daemon takes the copy when the
    conversation store exists and `last-version` is missing or names another version. The copy is a
    `version-change` snapshot (stores and config, ADR-122). When the start also migrates a store,
    the one copy is the `pre-migration` snapshot. A new install has nothing to copy.
3.  **One copy per version.** `last-version` is written straight after the copy, so a start that
    fails and is restarted by launchd, systemd, or Compose takes no second copy. That second copy
    would prune the first: only the last two are kept.
4.  **A snapshot the daemon takes names the version that took it** (`version` in the manifest).
    `jaari rollback --list` shows it as `by <version>`.
5.  **The way back under Compose:** `docker compose down`, then `admin rollback --list` with the new
    tag still in `compose.yaml`. When the latest line says `by NEW`, put the old tag back and run
    `admin rollback --yes`. Otherwise the new daemon never started, the data is the old image's, and
    the old tag alone is enough. Then `up --wait`. `scripts/check-update.mjs --docker` runs this
    and checks that the latest snapshot is by the new version.

## Alternatives rejected
- **A snapshot command that the guide runs before the tag change:** the owner can forget it, and a
  manual `npm install` would still have no copy.
- **Keeping the data of an image that migrated nothing:** the new version may have written data the
  old one reads wrongly. Also, the latest snapshot can be from an older update.
- **Storing the last version in `session.db`:** the copy must be taken before any store is opened.

## Consequences
- Every update takes one more copy of the stores at the first start of the new version. Under
  `jaari update` there are two (`pre-update`, then `version-change`); both are kept, and the undo
  restores its own.
- Going back starts the old version, which takes a copy of the newer data. That copy is the way to
  the data of the newer version again.
- A daemon from before this ADR writes no `last-version`. The first start of a version with this
  ADR then takes one copy.
- Resolves OQ-96. Amends ADR-122 (when the daemon takes a snapshot), ADR-124 (the second copy after
  `jaari update`), and ADR-127 (the way back under Compose).
