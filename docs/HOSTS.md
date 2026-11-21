# Jaari: Hosts

Docker is the main way to run and test Jaari (ADR-128). A real host, where Jaari runs from npm under
the system's own service manager, is optional: it is tested only when the owner asks for it, and it
becomes a supported install only after the owner confirms it. This file keeps, for each host, what
it needs, what is left to do, and what has been shown.

## How to read this file

| Status | Meaning |
|---|---|
| Main | The supported install; every check runs here |
| Optional | Code exists and its unit tests run; not confirmed on a machine of the owner's |
| On request | Designed; no code, or the code waits for the owner to ask |
| Confirmed | The owner asked, the tasks are done, and the checks passed on the owner's machine (date and evidence) |

To confirm a host: the owner asks for it, the tasks below are done, the checks pass on a machine
of the owner's, and the row gets *Confirmed* with the date and the evidence. Then the install guide
lists it. A new host-facing feature adds its task for each host that is not *Main* (ADR-128, point 6).

## Overview

| Host | Install | Status | Roadmap |
|---|---|---|---|
| Linux, Docker Engine | Compose | Main | 0.17, 0.20 |
| macOS, Docker Desktop | Compose | Main once 0.21 is Verified (code in, shown 2026-11-21) | 0.21 |
| Windows, Docker Desktop | Compose | Main once 0.21 is Verified | 0.21 |
| macOS, launchd | npm | Optional | 0.12, 0.13, 0.18 |
| Linux, systemd | npm | Optional | 0.12, 0.18 |
| Windows, scheduled task | npm | On request | 0.19 |

## Docker (main)

Needs: Docker Engine 25 or later with Compose (for `start_interval` in the health check, ADR-127), or
Docker Desktop on macOS or Windows; amd64 or arm64.

Shown:
- Linux Docker Engine: the `compose.yaml` that `jaari init` writes comes up and `jaari doctor` passes
  beside it (Phase 0 exit, [audits/phase-0-exit.md](audits/phase-0-exit.md)).
- Docker Desktop on macOS: `scripts/check-update.mjs --docker` passed on 2026-11-20, with the data in
  a named volume. On 2026-11-21 it passed again with the way back: the latest snapshot was by the new
  version, and `admin rollback --yes` restored it (ADR-129).

Tasks:
- [x] 0.20: the way back under Compose (ADR-129); `check-update.mjs --docker` passes on Docker
      Desktop (2026-11-21).
- [ ] `check-update.mjs --docker` passes on Linux Docker Engine.
- [x] 0.21: the data folder in a named volume on Docker Desktop, chosen by `jaari init`, and the
      guide puts Compose first (ADR-130). Shown on macOS on 2026-11-21: `check-update.mjs --docker`,
      and an install with a key file (healthy, `admin doctor` passes).
- [ ] 0.21: the chat with a real model on Docker Desktop (`docker compose exec jaari jaari chat`).
- [ ] 0.21: `scripts/check-release.sh` and `check-update.mjs --docker` pass on Docker Desktop on
      Windows.

## macOS, launchd (optional)

Needs: macOS on Apple silicon or Intel, Node 26 and npm, the login keychain for `os-keychain`.

Shown:
- 0.12: `jaari service install` on the owner's Mac (2026-11-17).
- 0.13: the lid-close test, `power.wake` with a 202 s gap (2026-11-17).
- 0.18: `v0.1.0-beta.2` to `v0.1.0-beta.3` with `jaari update` under launchd (2026-11-20).
- `check-update.mjs --service`, 12 of 12 runs, after the launchd fix of 2026-11-20 (not asked for by
  the owner, so not a confirmation).

Tasks to confirm:
- [ ] `check-update.mjs` (npm) and `--service` pass on the owner's Mac when the owner asks.
- [ ] `jaari rollback` after a real update.

## Linux, systemd (optional)

Needs: a Linux distribution with systemd and `systemd-creds` (ADR-122), Node 26 and npm, a TPM for
credentials bound to the machine (optional, `jaari doctor` reports it, ADR-123).

Shown: unit tests with fakes only. The unit file, its quoting, and `systemd-creds` have not run on a
real host (ADR-122, Consequences).

Tasks to confirm:
- [ ] `jaari service install` with encrypted credentials on a real host.
- [ ] A `--service` mode for systemd in `check-update.mjs` (today it covers launchd only).
- [ ] `jaari update` and its undo under systemd; `jaari rollback` after a real update.
- [ ] `check-update.mjs` (npm) passes on the host.

## Windows, scheduled task (on request)

Needs: Windows 11 or Windows 10 22H2, x64 or arm64, Node 26 and npm (ADR-125, point 1).

Shown: nothing; there is no Windows code.

Tasks to confirm (ADR-125, points 2 to 10; roadmap 0.19):
- [ ] `os-keychain` on Credential Manager; `host-credential` refused.
- [ ] The Jaari folder private through its ACL, and the `jaari doctor` check of it.
- [ ] The named-pipe chat channel; another account cannot write to it ([THREAT_MODEL.md](THREAT_MODEL.md)).
- [ ] The per-user scheduled task `\Jaari\daemon`.
- [ ] The PowerShell power hold and the battery reading.
- [ ] `node <script>` instead of `.cmd` shims, and System32 tools by full path.
- [ ] The npm layout and a junction for `current` in `jaari update`.
- [ ] The tests and `check-update.mjs` (npm and a Task Scheduler mode) pass on the owner's Windows
      machine.
