# ADR-122: Install and update in three steps: the local commands first, npm and Compose as the Phase 0 channels, keyless signing, and a snapshot before every store migration

- **Status:** Accepted
- **Date:** 2026-11-17

Roadmap 0.12 bundled everything of [ADR-056](056-install-update-migrate.md) that
[ADR-082](082-phase-split-update-and-catch-up.md) left in Phase 0. Part of it works on one
machine with no release; the rest publishes packages and images, and updates between them. The
documents also had gaps: five install methods with a roadmap home for none of them, no way to
keep a previous version of an npm install, and a `jaari doctor` warning about providers that
the config refuses. This ADR splits the work, decides the open points, and records the local
part as built. It amends ADR-056, ADR-082, [ADR-032](032-observability.md),
[ADR-079](079-secret-zero-on-servers.md), [ADR-018](018-capability-vocabulary-and-phase-0-floor.md),
and [ADR-028](028-encryption-at-rest.md).

## Decision
**The split.**
1.  **Roadmap 0.12 is the local part:** `jaari doctor`, `jaari config`, `jaari service
    install`, the snapshot, and `jaari rollback` for data. It publishes nothing.
2.  **Roadmap 0.17 is the release:** one public npm package `jaari` that carries the daemon and
    the command, a multi-arch image on the GitHub container registry, and the `compose.yaml`
    that `jaari init` writes around that image.
3.  **Roadmap 0.18 is `jaari update`:** signature and provenance check, snapshot, version swap,
    `jaari doctor`, automatic rollback, and `jaari uninstall`. It is tested between two
    published pre-releases.

**Channels and signing.**
4.  **Phase 0 ships two install channels:** npm for a laptop, Compose for a server. The
    Homebrew tap, the single binary, and the one-line installer of ADR-056 move to roadmap 7.7.
    A binary or a formula that macOS trusts needs an Apple Developer ID; none is bought before
    7.7.
5.  **Releases are signed without a stored key (Sigstore):** npm provenance from trusted
    publishing (ADR-010), and `cosign` with the workflow's identity for the image. `jaari
    update` checks both (0.18).
6.  **An install keeps versions side by side.** `jaari update` installs each version into
    `~/.jaari/versions/<version>` and points a `current` link at the active one, so `jaari
    rollback` can move the link back. `npm i -g` alone replaces the old version and leaves
    nothing to go back to. Built with 0.18.

**The snapshot, as built.**
7.  **The daemon takes it, before a store migration.** At start, when `session.db` or
    `usage.db` is older than this Jaari, the daemon copies the stores and the config first.
    ADR-082 has `jaari update` take it; a store is migrated by whatever starts a newer Jaari
    (an update, `git pull`, a package manager), so the copy belongs to the start. `jaari
    update` takes one more before the swap (0.18). It takes one per target: when the latest
    snapshot is a pre-migration snapshot for the same store versions, a start that failed and is
    restarted by launchd or systemd takes no new one, so the copy of the original data is never
    pruned by restarts.
8.  **What it holds:** a SQLite online backup of every `*.db` in the data folder, a copy of the
    config, and a manifest with the store versions, written last through a temporary file and
    a rename. It lives in `data/snapshots/<sequence>-<time>-<reason>`, folder 0700, files 0600.
    The sequence number orders the snapshots, so a clock set back does not make a new snapshot
    look old. The last two are kept; a folder with a missing or unreadable manifest does not
    count, and pruning removes only folders named like a snapshot. The
    memory git tag of ADR-082 joins with the memory repository (1.1). The event log is not
    copied.
9.  **`jaari rollback` restores the latest snapshot:** the stores and the config, written
    through a link when the config is one, so a dotfiles link stays a link (as `jaari init`). It refuses
    while the daemon answers on its socket, and it needs a person at a terminal or `--yes`
    (ADR-076). It first snapshots the data as it is, so a second run undoes the first. It marks
    the snapshot it restores in `data/snapshots/restoring` and removes the mark when done: a run
    that was cut short is finished by the next run, pruning keeps the marked snapshot, and the
    daemon refuses to start while the mark exists. Until 0.18 it does not swap the Jaari
    version: the owner starts the version of that time.

**`jaari doctor`, as built.**
10. **Four levels: `ok`, `info`, `warn`, `FAIL`. Only `FAIL` sets exit code 1.** ADR-032 says
    it "exits non-zero when any check fails". `jaari update` rolls back when it does, so a
    state the owner chose (a server without disk encryption) is a warning, never a failure.
11. **Phase 0 checks:** the Node version (ADR-105); the config, with the `llm` section and the
    owner id; the modes of the data folder and its files (ADR-028); the form of secret zero and
    whether each model key can be read (ADR-079); the version of each store against this
    Jaari, and a store that cannot be read; the latest snapshot and an unfinished rollback;
    whether the daemon answers within 2 seconds, so a hung daemon is a failure and not a wait;
    a failed power hold since the last start (ADR-121); FileVault on macOS. Other checks arrive
    with their features. What it cannot read is a `FAIL` line, never a crash.
12. **No warning for `env` and `file` providers.** ADR-018 asks for one. The config accepts
    only `os-keychain` and `host-credential` (ADR-079, ADR-118), so a config that names
    another provider fails the config check. The roadmap exit criterion says so now.
13. **Not told apart yet:** TPM-sealed from encrypted credentials, and disk encryption on
    Linux; both need root. They join with the Compose install (0.17).

**`jaari service install`, as built.**
14. **macOS: a launchd user agent** (`~/Library/LaunchAgents/org.jaari.daemon.plist`). A user
    agent starts at login, not at boot: the login keychain is open only then. Its log is
    `~/Library/Logs/jaari-daemon.log`, outside the data folder. It refuses a daemon or a Jaari
    folder under Documents, Desktop, or Downloads (ADR-057).
15. **Linux: a systemd system unit**, written as root, that runs as the owner's account. With
    `systemd-creds`, each file of the credentials folder is encrypted into
    `/etc/jaari/credstore` and passed with `LoadCredentialEncrypted=`; without it, the plain
    file is passed with `LoadCredential=`, which cannot quote a path: a credentials folder with a
    space or a quote is refused there. The command never reads a value. It does not delete
    the plain files: it tells the owner to do so after the first good start. It must run again
    after every `jaari secret set`. `os-keychain` is refused: a system service has no login
    keychain.
16. **Node and the daemon are named by absolute path**, as found on `PATH` (`--daemon` for the
    daemon; the running Node only when no `node` is on `PATH`), so a start does not depend on
    `PATH`. The paths are never resolved through links: a link such as `/opt/homebrew/bin/node`
    or the `current` link of 0.18 stays valid across an upgrade, while the versioned folder it
    points to goes away.

**Smaller points.**
17. **`jaari config <deployment | secrets | llm>`** revisits one step of `jaari init` and
    leaves the rest of the file as it is.
18. **A store is made owner-only when it opens.** SQLite creates the file with the default
    mode, so `session.db` and `usage.db` were readable by other users inside the 0700 data
    folder. `openDatabase` now sets 0600 (ADR-028). `jaari doctor` found it.

## Alternatives rejected
- **One roadmap item and one pull request for all of it:** the local part would wait for
  registry and organization setup that only the owner can do.
- **All five install methods in Phase 0:** three of them need an Apple Developer ID or a
  bundling step that nothing else needs yet.
- **A signing key in a repository secret:** it must be stored, rotated, and can leak; the
  workflow identity cannot.
- **The snapshot only in `jaari update`:** a store migrated by a manual start would have no
  copy.
- **Failing `jaari doctor` on every finding:** an update on a host without disk encryption
  would always roll back.
- **A launchd daemon at boot on macOS:** it cannot read the login keychain.
- **Deleting the plain credential files after encrypting them:** a failed first start would
  leave the owner without the keys.

## Consequences
- The Linux unit, its quoting, and `systemd-creds` were built from the documentation and
  tested with fakes; they have not run on a real Linux host. The launchd file was generated on
  a real Mac but not loaded. Both are owner tests.
- A daemon that launchd keeps alive and that refuses to start (a bad config) is started again
  about every 10 seconds; `~/Library/Logs/jaari-daemon.log` shows why.
- A store created after a snapshot stays in place after a rollback; the Jaari of that time
  does not open it.
- `jaari rollback` checks the daemon by its socket only. A daemon that has opened the stores
  but does not listen yet (the first second of a start) is not seen; the owner stops the service
  before a rollback, as the command says.
- Roadmap 1.12 (the nightly snapshot) builds on `takeSnapshot`; the ADR-027 bundle replaces
  both in Phase 3.
