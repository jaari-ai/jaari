# ADR-128: Docker is the main way to run and test Jaari; a real host is optional until the owner confirms it

- **Status:** Accepted
- **Extended by:** [ADR-130](130-compose-on-docker-desktop.md)
- **Date:** 2026-11-21

## Context
ADR-125 made Windows a Phase 0 host, and ADR-126 asked for runs of the local update check on the
owner's Linux, macOS, and Windows machines. Each real host needs its own machine, its own service
manager, and its own run, and Phase 0 could not finish until all of them had passed. Docker already
runs the same Linux image on every system: Docker Engine on Linux, and Docker Desktop on macOS and
Windows. `scripts/check-update.mjs --docker` passed on Docker Desktop on 2026-11-20, with the data in
a named volume (ADR-127, point 4).

The owner decided on 2026-11-21: all tests run through Docker; Docker is the main way to install
Jaari; a real host (Linux with systemd, macOS with launchd, Windows) is optional and is tested only
when the owner asks for it; a host joins the supported installs once the owner confirms it.

## Decision
1.  **Docker is the main install on every system.** The Compose file that `jaari init` writes is
    the supported install on Linux (Docker Engine), macOS, and Windows (Docker Desktop). Roadmap 0.21
    makes this work on Docker Desktop: the data folder in a named volume (a folder shared from macOS
    or Windows cannot hold the chat socket with its mode, ADR-127), and `jaari init` writing the file
    there. The guide puts Compose first.
2.  **Tests run in Docker.** The unit tests stay as they are (`pnpm check`, and the existing CI,
    which runs on Linux). Every check of the install, the update, and the way back runs against the
    image on the owner's local Docker: `scripts/check-release.sh` and `scripts/check-update.mjs
    --docker`. No new CI job (ADR-126).
3.  **A real host is optional until the owner confirms it.** The host code that exists stays
    (launchd, systemd, the npm install, `jaari update` with the launcher), and its unit tests keep
    running. No phase waits for a run on a real host. [HOSTS.md](../HOSTS.md) keeps, for each host,
    its requirements, its tasks, and its evidence.
4.  **A host becomes confirmed in three steps.** The owner asks for it. Its tasks in
    [HOSTS.md](../HOSTS.md) are done, and its checks pass on a machine of the owner's. Its row then
    says *Confirmed*, with the date and the evidence. Only then does the guide list it as a supported
    install.
5.  **Host items in the roadmap wait for the owner.** Their status is *On request*. They are not
    part of a phase gate until the owner asks for them. Roadmap 0.19 (Windows, ADR-125) is the first.
6.  **The rule of ADR-127, point 5, stays.** Every ADR that adds a host-facing feature states its
    behaviour on Linux, macOS, Windows, and Docker. A host that is not confirmed gets its tasks
    added to [HOSTS.md](../HOSTS.md) instead of a run.

## Alternatives rejected
- **Keep every host in Phase 0:** three machines and three service managers before Phase 1, for
  installs that no owner has asked for yet.
- **Drop the host code:** launchd and the npm install were shown on the owner's Mac (0.12, 0.13,
  0.18), and the owner's own Jaari runs on them. Removing them loses working code.
- **Run the host checks in CI on hosted Linux, macOS, and Windows runners:** the owner said no new CI
  jobs until a big milestone (ADR-126).

## Amendments
- **ADR-130:** point 1 as built: the socket probe, the `nocopy` volume, and the `data` step.

## Consequences
- Phase 0 waits for 0.20 (Docker mode of the local check) and 0.21 (Compose on Docker Desktop), not
  for 0.19.
- The laptop features of ADR-121 do not work in a container: Docker Desktop cannot hold the Mac or
  the PC awake for a turn, and does not read the battery. The clock-gap detection works in the
  container. An owner who needs those features uses a real host, once it is confirmed.
- A named volume is not a folder that the owner sees on the host. Backup (Phase 3) must reach the
  data in the volume.
- Amends ADR-123 (Compose is the main install), ADR-125 (Windows is on request), ADR-126 (the host
  runs are tasks in HOSTS.md; Docker runs are the checks), and ADR-127 (Compose on Docker Desktop is a
  supported install).
