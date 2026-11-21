# ADR-132: The memory writer as built: the git program, run with hooks off, an intent store, and trailers

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
Roadmap 1.1 builds the memory repo and its single writer (ADR-003, ADR-026). No ADR said how Jaari runs
git, and the image (ADR-123) had no git. ADR-028 already needs the `git` program: `git-remote-gcrypt`
works only through it. The memory repo is a folder the owner may edit by hand, and git reads
`.git/config` and `.git/hooks` from it: `core.fsmonitor`, `core.hooksPath`, and hooks can make git run
any program. The owner chose the `git` program in the image on 2026-11-21, with hooks turned off.

## Decision
1.  **The `git` program, from the image's Debian release** (`apt-get install git` in
    `docker/Dockerfile`). Jaari runs it by its full path, `/usr/bin/git`. On a host without it the
    daemon refuses to start, and `jaari doctor` fails with the reason.
2.  **Every git call is hardened:** `core.hooksPath=/dev/null` (no hooks), `core.fsmonitor=false`,
    `commit.gpgSign=false` (signing would run `gpg.program`), no
    system or global config (`GIT_CONFIG_NOSYSTEM`, `GIT_CONFIG_GLOBAL=/dev/null`, a `HOME` that does not
    exist), a fixed `PATH`, and no terminal prompt. Command-line settings win over the repo's own config.
3.  **The repo is `memory/` in the data folder**, mode `0700`, files `0600`, on the branch `main`. Under
    Compose it is in the same folder or volume as the stores (ADR-130).
4.  **The intent journal is a versioned store, `memory.db`** (ADR-119), with `ownerId` on every row.
    An intent holds its change while it is pending or quarantined, and only its id once done. The
    snapshots copy it with the other stores (ADR-122).
5.  **Trailers:** `Jaari-Mutation-Id`, `Jaari-Actor`, and `Jaari-Session` (when there is one). Every
    mutation is a commit, even one that changes nothing, so its id can always be found.
6.  **A change** writes whole files, appends to them, or removes them. One that names a `base` commit
    is refused when one of its files changed since; the caller redoes it (ADR-026).
7.  **Refused before an intent is recorded:** a path outside the repo or into `.git`, a binary file, a
    file over 1 MiB (also after an append), and a secret found by the ADR-081 rules (ADR-028: the write
    is blocked, not rewritten). The owner's own edits that fail these checks stay out of their commit
    and are reported.
8.  **After a crash**, before the owner's edits are looked at: a pending intent found in git by its
    mutation id is marked done; one not found is applied again; one that cannot be applied is
    quarantined, with its change kept.

## Alternatives rejected
- **A JavaScript git library (`isomorphic-git`):** no gcrypt remotes (ADR-028), so the program would
  be needed anyway.
- **Trusting the repo's config:** a hand-edited or restored repo could run a program as the owner's
  account at the next commit.
- **Intents in `session.db`:** a store of its own keeps the writer's package independent, and needs
  no migration of the conversation store.

## Consequences
- The image is about 30 MB larger. The git version follows the base image's Debian release, which
  Dependabot moves with the pinned digest.
- On macOS without the Command Line Tools, `/usr/bin/git` is a stub that fails; a bare-metal install
  needs them (`docs/HOSTS.md`).
- Where the data is in a volume (ADR-130), the owner edits memory through the admin container or the
  panel (Phase 2), not in Finder.
- The FTS index step of the closure ladder comes with structured records (roadmap 1.2).
- Amends ADR-026 (as built), ADR-028 (the scan blocks the write), and ADR-123 (git in the image).
