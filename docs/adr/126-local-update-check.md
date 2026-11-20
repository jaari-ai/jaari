# ADR-126: The update is tested from local builds, with a script that never ships; releases are not test runs

- **Status:** Accepted
- **Date:** 2026-11-20

## Context
Releases `v0.1.0-beta.1` to `v0.1.0-beta.4` proved the npm release path. Two of them existed only to
test `jaari update` on a Mac, and the update from beta.3 to beta.4 found a bug (the launchd job
class, ADR-124 Consequences). The owner decided on 2026-11-20 that builds are tested locally from
now on: each release costs time, and it shows an unfinished project in public.

`jaari update` refuses any file that lacks the npm registry's signature and provenance from this
repository's release workflow (ADR-124, points 1 to 4). A locally packed tarball has neither, and
that refusal must stay on in what owners install. `scripts/check-release.sh` already installs the
packed tarball and switches between two versions through the launcher, but it does not run the
update itself: no stop, snapshot, check, start, doctor, or undo.

## Decision
1.  **A script, `scripts/check-update.mjs`, runs the real update between two local builds.** It packs
    two versions of the working tree with `scripts/pack-release.mjs` (`0.0.0-check.1` and
    `0.0.0-check.2`), installs the first into a temporary prefix as an owner would, writes a config
    in a temporary Jaari folder, and runs the `update` function of the installed first version,
    because an owner's update runs the code of the version that is active. Only three things are
    replaced, through the existing `UpdateDeps` injection:
    - `fetch` serves a registry entry and the tarball from the local files;
    - `verify` returns the commit without checking a signature (the check keeps its own tests,
      against the real attestations of `0.1.0-beta.1`);
    - the npm install by name is pointed at the local tarball file.
    Everything else is the real code: the byte comparison, the stop, the snapshot, the switch,
    `jaari-daemon --check`, the start, `jaari doctor`, and the undo.
2.  **The script ships nowhere.** It is not in the npm tarball (`files` in the packed `package.json`)
    and not in the image. No option, environment variable, or config key of the shipped programs
    turns verification off.
3.  **Two modes.** Without a service, the daemon is started and stopped by the script, which runs on
    every platform and in CI. With `--service`, it installs a real service under a test name
    (`org.jaari.daemon.check` under launchd, `\Jaari\daemon-check` in Task Scheduler,
    `jaari-check.service` under systemd), so it never touches the owner's own daemon, runs the
    update through it, and removes it at the end. The service name becomes a parameter of
    `jaari service install`, `jaari update`, and `jaari uninstall` (`--service-name`); its default
    is the current name.
4.  **It also runs the failures:** a second build whose `jaari doctor` fails, which must be undone
    with the data from before; and a start delayed past the old 15 seconds, which must pass.
5.  **CI runs it on Linux, macOS, and Windows** on every pull request, without a service, and with
    `--service` where the runner allows it (launchd on macOS; Task Scheduler on Windows; systemd on
    Linux with `sudo`).
6.  **A release is made when the owner asks for one,** not to test a change. ADR-043 and ADR-123 are
    unchanged for real releases.

## Alternatives rejected
- **A local npm registry (Verdaccio):** it tests npm's install by name, but still needs the
  verification stub, and it adds a server and a dependency.
- **An option in the shipped command that skips verification:** one setting, a stolen config or a
  bad guide, would install an unsigned package. Verification has no off switch.
- **Unit tests only:** the beta.4 bug was in the interaction with launchd, which a fake does not
  have.
- **Releasing a beta for each test:** slow, public, and npm keeps every version.

## Consequences
- Roadmap 0.20 builds it. It is the way to test roadmap 0.19 (ADR-125) without a release.
- The script tests an install from a file, which resolves the dependencies again, while an owner's
  update installs by name with the shrinkwrap (ADR-124, point 5). The dependency pins are therefore
  shown only by a real release.
- Amends ADR-124 (the service name is a parameter; testing the update no longer needs a release).
