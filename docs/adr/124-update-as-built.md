# ADR-124: `jaari update` as built: verification without the network, a launcher over side-by-side versions, a check before the daemon comes back, and release notes from GitHub

- **Status:** Accepted
- **Date:** 2026-11-19

Roadmap 0.18 builds the update that [ADR-056](056-install-update-migrate.md),
[ADR-082](082-phase-split-update-and-catch-up.md), and [ADR-122](122-install-in-three-steps.md)
describe, on the release of [ADR-123](123-release-as-built.md). The first release showed that
`npm audit signatures` cannot check Jaari, and the documents left open how a version is swapped,
how the daemon is stopped, and where release notes come from. This ADR decides them. It amends
ADR-056, ADR-082, ADR-122, ADR-123, [ADR-043](043-project-process.md), and
[ADR-080](080-egress-core-in-phase-0.md).

## Decision
**What is checked before anything is installed.**
1.  **Three proofs, all required.** The downloaded tarball has the SHA-512 that the registry
    lists. The npm registry signed `jaari@<version>:<integrity>` with a key that npm publishes
    for signatures. And two attestations verify and name this package, this version, and this
    file: npm's publish attestation, and the SLSA provenance.
2.  **The provenance must come from one identity:** the workflow
    `.github/workflows/release.yml` of `jaari-ai/jaari`, at the tag `v<version>`, issued by
    GitHub Actions. A fork, another workflow, a branch, or another version's tag does not pass.
3.  **The check needs no network.** It uses `@sigstore/verify`, the verifying half of the
    `sigstore` package, with the Sigstore roots and the npm keys that ship inside
    `@sigstore/tuf`. The full `sigstore` package would refresh those roots with its own network
    client, which does not go through `@jaari/http` (ADR-080). Dependabot keeps the roots
    current. If npm or Sigstore rotates a key before an old Jaari is updated, the check fails
    closed, and the owner installs the new version by hand.
4.  **The download address is fixed:** `https://registry.npmjs.org/jaari/-/jaari-<version>.tgz`.
    A registry entry that names another address is refused.
5.  **npm installs by name, then the install is compared with the verified file.** npm honours
    the shrinkwrap inside the tarball only for an install by name (`jaari@<version>`); from a
    file it resolves the dependencies again. So npm downloads the package itself, takes every
    dependency from the shrinkwrap with its checksum, and then every file of the verified
    tarball must be in the installed copy, byte for byte. Install scripts stay off.

**How a version is installed and swapped.**
6.  **Side by side.** `npm install --global --prefix ~/.jaari/versions/<version>` installs each
    version. `~/.jaari/current` is a relative link to the active one, replaced in one step.
    `versions/state.json` records the active version and the one before it. The active one and
    the one before it are kept; older ones are removed.
7.  **A launcher.** The `jaari` and `jaari-daemon` commands of the npm package first look for
    `~/.jaari/current` (or the folder of `--home`). When it is a link into `versions/`, they run
    that version; otherwise the one they belong to. So the commands on `PATH`, and the service
    that names them, follow an update and a rollback. `jaari service install` does not have to
    run again. The launcher reads `--home` as the commands do (the last one wins; nothing after
    `--`). When the owner installs a newer Jaari with npm, that one runs instead of an older
    active version. When the active version's folder is gone, the launcher says so and runs its
    own.
8.  **The version that npm installed is never replaced.** It stays as the way back when no other
    version is active, and it holds the launcher.

**The order of an update.**
9.  Verify and install while the daemon still runs; stop the daemon; take a `pre-update`
    snapshot; switch the link; run the new `jaari-daemon --check`, which starts every part and
    runs the migrations; start the daemon; run the new `jaari doctor`. A failure at any step
    after the switch stops the daemon, switches back, restores the snapshot, and starts the old
    version. This is the "update lease" of ADR-056 in Phase 0: with one session and no jobs,
    stopping the daemon lets the running turn finish (ADR-065) and nothing else can start. The
    undo restores nothing while a daemon still answers: it says so and leaves the rest to
    `jaari rollback`. Any error after the daemon was stopped undoes and starts it again. One
    update runs at a time (`versions/update.lock`; a lock whose process is gone is taken over).
    The version remembered as the one before is the one that ran, not the one the state file
    names.
10. **Only a launchd agent is stopped and started by the command.** Under systemd it needs
    root, and a daemon started by hand has no manager. There the owner stops the daemon first;
    the update refuses while it answers. The check is then `--check` and `jaari doctor
    --no-daemon`, and the owner starts the daemon again.
11. **`jaari rollback` takes the version back with the data.** It swaps the active version and
    the one before it; a second run swaps both again. Without an update it restores data only,
    as before. It writes the version it switches to (`versions/rollback.json`) before it starts,
    so a run that is cut short is finished by the next one, never undone by it.

**The rest.**
12. **Channels.** `update.channel` is `"stable"` (npm `latest`) or `"beta"` (also npm `next`,
    whichever is newer). Without the key, an install keeps the kind it has. An older version is
    installed only with `--to <version>`.
13. **Release notes are the GitHub release.** The release workflow creates it from the titles of
    the merged pull requests, and `jaari update` prints it without control characters. This is
    the `CHANGELOG.md` of ADR-043: a file in the repository would need the workflow to push to
    `main`. It is a draft until the owner approves the version on npm, so a rejected version has
    no public notes.
14. **Under Compose the image is the version.** `jaari update` refuses where npm is missing and
    points to the guide: change the image tag, verify it with `cosign`, `docker compose up -d`,
    `admin doctor`, and go back with the old tag and `admin rollback`.
15. **`jaari uninstall`** removes the service and the installed versions and keeps the data. It
    refuses while the daemon answers. `--purge` deletes the Jaari folder after the owner types
    `delete` at a terminal; `--yes` does not replace that. It never purges `/`, the home folder,
    or a folder that is not a Jaari folder, and it leaves keychain entries alone. Under systemd
    it prints the root commands.
16. **Telling the owner that an update exists** is `jaari update --check` for now. A message
    from the daemon is proactive output and waits for the notification ledger (2.3).

## Alternatives rejected
- **`npm audit signatures`:** it looks up the bundled `@jaari/*` packages, which are not
  published, and stops at the first 404.
- **Only the registry signature:** it proves that npm holds the file, not who built it.
- **The full `sigstore` package:** a second network client outside the egress gate, for roots
  that the pinned package already carries.
- **`npm install -g jaari@new` in place:** the old version is gone, so there is nothing to go
  back to, and a failed install leaves no working command.
- **Rewriting the service file at each update:** it needs root on Linux; the launcher does not.
- **Switching while the daemon runs:** the old daemon would keep writing with the old code
  into stores that the new one is about to migrate.

## Consequences
- The first version that can update is the first release after this ADR. `0.1.0-beta.1` has no
  `jaari update`; its owners install the next version with npm once.
- The verification is tested against the real attestations of `jaari@0.1.0-beta.1`, kept as a
  fixture, and the expected identity is tested against the forms a forged one would take
  (another workflow, a branch, another tag, a fork). A real end-to-end run updated a packed
  build to the published `0.1.0-beta.1`: verified, installed by name, compared byte for byte,
  then undone because that version lacks `doctor --no-daemon`.
- ADR-123 point 2 holds for an install by name only: an install from a file resolves the
  dependencies again. CI's `check-release.sh` installs from a file and is not pinned.
- `scripts/check-release.sh` installs two versions, switches between them, and runs both
  commands through the launcher, in CI on every pull request.
- A daemon under systemd must be stopped by the owner before an update; `jaari update` says so.
- The launcher adds one `realpath` and one dynamic import to each start.
- 2026-11-20, the update from `0.1.0-beta.3` to `0.1.0-beta.4` on a busy Mac (an Xcode build and
  an Android emulator, load average 35 on 11 cores): the daemon took about 30 seconds to start,
  `jaari doctor` ran after the 15 seconds the update waited, and the update undid itself. The undo
  then said the daemon ran again before it answered. Two causes: `jaari service install` wrote
  `ProcessType` `Background`, which launchd.plist(5) reserves for work the user did not ask for
  (loading the daemon code took 0.6 s at normal priority and 7.4 s at background priority), and
  the fixed wait. From the next release the launchd job is `Standard`, the update waits up to two
  minutes and says that it waits, and the undo says the daemon runs only once it answers. The
  update runs the code of the active version, so owners update from an older version while the
  Mac is not busy, then run `jaari service install` once. Linux is not affected: the systemd unit
  sets no lower priority, and there the owner stops and starts the daemon. Windows (ADR-125) sets
  the scheduled task's priority to normal for the same reason, and its start uses the same wait.
