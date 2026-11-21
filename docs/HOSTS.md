# Jaari: Hosts

The checklist for each host, outside the roadmap phases (ADR-131). Phase gates check Docker only:
the image under Docker Compose, in CI and on the owner's local Docker. Nothing here holds a gate.

Docker Compose is the one install for every host (ADR-128). Bare metal, where Jaari runs from npm under
the system's own service manager, is for later. For each host this file keeps what it needs, what was
found, what is left, and how to run its checks. When the owner asks for a host, its list is the work.
A check that passes is ticked here with the date and the evidence (ADR-128, point 4).

## Docker: every host

| Host | Engine with Compose | Notes | Shown |
|---|---|---|---|
| Linux | Docker Engine 25 or later with Compose | The data in `./data` in the Jaari folder | `check-release.sh` in CI on every pull request, with the chat; the Phase 0 exit ([audits/phase-0-exit.md](audits/phase-0-exit.md)) |
| macOS | An engine that runs Linux in a virtual machine (Docker Desktop tested) | The data in a named volume (ADR-130) | 2026-11-21: `check-release.sh`, `check-update.mjs --docker` with the way back (ADR-129), and an install with a key file |
| Windows | An engine with WSL 2 (Docker Desktop, or Docker Engine inside WSL), commands in a WSL 2 shell | In the WSL file system the data stays in `./data`; in a folder shared from Windows, `jaari init` picks the volume | Not run yet |

Found on Docker, and handled:
- A folder shared from macOS or Windows keeps file and folder modes but cannot set a socket's mode
  (`EINVAL`). `jaari init` tests for it and puts the data in a named volume (ADR-130).
- Docker copies the image folder's owner and mode into a volume each time it is mounted empty: every
  mount of the data volume uses `nocopy`, and a one-off root step with only `CHOWN` and `FOWNER` gives
  it to the owner's account (ADR-130).
- `start_interval` in the health check needs Docker Engine 25 or later (ADR-127).
- Compose mounts `config.jsonc` as one file: an editor that writes a new file (`sed -i`) is seen only
  after `docker compose up --wait --force-recreate` (the install guide says so).
- A container cannot keep the computer awake for a turn or read the battery (ADR-121). The clock-gap
  detection of sleep works there (ADR-128).

Not covered by the checks:
- [ ] A chat with a real model key under Compose. The chat itself through `docker compose exec` is
      checked by `check-release.sh` (`pause` and `resume`, answered by code).

## Docker Compose on a given host: checklist

Run these from a clone of the repository, with the engine running:

~~~bash
pnpm install && pnpm -r build
bash scripts/check-release.sh            # the tarball, the image, Compose with the chat
node scripts/check-update.mjs --docker   # the image update and the way back
~~~

- [x] macOS, Docker Desktop (2026-11-21): both pass; the data is in the named volume.
- [x] Linux, Docker Engine: `check-release.sh` in CI on every pull request.
- [ ] Linux, Docker Engine: `check-update.mjs --docker`.
- [ ] Windows: both, in a WSL 2 shell (Docker Desktop's WSL integration, or Docker Engine inside WSL),
      from a clone in the WSL file system and from one in a folder shared from Windows (`/mnt/c/...`),
      which should pick the volume.

## Bare metal: for later

The code that exists stays and its unit tests run: launchd, systemd, the npm install, and `jaari
update` with the launcher. Nothing in a phase waits for it.

### macOS, launchd

Needs: macOS on Apple silicon or Intel, Node 26 and npm, the login keychain for `os-keychain`, and the Command Line
Tools for `/usr/bin/git` (the memory repo, ADR-132).

Found:
- launchd slows a job marked `ProcessType` `Background` on a busy Mac, which undid the beta.3 to
  beta.4 update. `jaari service install` now writes `Standard` (ADR-124, Consequences).
- `launchctl bootout` can return while launchd still holds the job, and a `bootstrap` at once then
  fails. `jaari update` waits until `launchctl print` no longer finds it, at most 10 seconds.
- `jaari update` waits up to 120 seconds for the new daemon; `--wait` changes it.
- The launcher follows `~/.jaari/current`, so a test script must pass `--home`, or it runs the owner's
  own Jaari.
- Shown on the owner's Mac: `jaari service install` (0.12), the lid-close test with `power.wake` (0.13),
  and the update from `v0.1.0-beta.2` to `v0.1.0-beta.3` under launchd (0.18).

Left: `check-update.mjs --service` as an owner's check, and `jaari rollback` after a real update.

### Linux, systemd

Needs: systemd with `systemd-creds` (ADR-122), Node 26 and npm, git at `/usr/bin/git` (ADR-132), a TPM for credentials bound to the
machine (optional, `jaari doctor` reports it, ADR-123).

Found:
- The unit file, its quoting, and `systemd-creds` were built from the documentation and tested with
  fakes; they have never run on a real host (ADR-122, Consequences).
- `jaari update` does not stop or start a systemd service; the owner does (ADR-124, point 10).

Left: `jaari service install` with encrypted credentials on a real host; a systemd mode in
`check-update.mjs`, which covers launchd only; `jaari update`, its undo, and `jaari rollback` under
systemd.

### Windows, scheduled task (was roadmap 0.19)

Needs: Windows 11 or Windows 10 22H2, x64 or arm64, Node 26 and npm (ADR-125, point 1).

Found (from the Node.js and npm documentation, ADR-125):
- Unix file modes do not exist there: `chmod` changes only the write bit, so the owner-only checks
  need the folder's ACL, and `host-credential` is refused.
- The chat must be a named pipe, in one namespace for all accounts.
- `current` must be a junction; the global npm layout differs (`{prefix}\node_modules`); Node
  refuses to run `.cmd` shims without a shell.

Left (ADR-125, points 2 to 10): Credential Manager, the folder ACL and its
`jaari doctor` check, the named pipe (another account must not write to it,
[THREAT_MODEL.md](THREAT_MODEL.md)), the scheduled task `\Jaari\daemon`, the PowerShell power hold
and battery reading, `node <script>` and System32 tools by full path, the npm layout and the junction,
and a Task Scheduler mode in `check-update.mjs`.
