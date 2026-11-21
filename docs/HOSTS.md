# Jaari: Hosts

Docker is the one install that covers every host: Linux, macOS, and Windows run the same Linux image
with Compose, and every check runs there (ADR-128). Bare metal, where Jaari runs from npm under the
system's own service manager, is for later: this file keeps what each system needs and what was
found, so that the work can start from it when the owner asks for a host. Then its list below becomes
a roadmap item, and once its checks pass on the owner's machine it is marked confirmed here, with the
date and the evidence (ADR-128, point 4).

## Docker: every host

| Host | Docker | Notes | Shown |
|---|---|---|---|
| Linux | Docker Engine 25 or later with Compose | The data in `./data` in the Jaari folder | `check-release.sh` in CI on every pull request; the Phase 0 exit ([audits/phase-0-exit.md](audits/phase-0-exit.md)) |
| macOS | Docker Desktop | The data in a named volume (ADR-130) | 2026-11-21: `check-release.sh`, `check-update.mjs --docker` with the way back (ADR-129), and an install with a key file |
| Windows | Docker Desktop, commands in a WSL 2 shell | In the WSL file system the data stays in `./data`; in a folder shared from Windows, `jaari init` picks the volume | Not run yet |

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

Open:
- [ ] Run `check-release.sh` and `check-update.mjs --docker` on Docker Desktop for Windows.
- [ ] A chat with a real model key under Compose (`docker compose exec jaari jaari chat`).

## Bare metal: for later

The code that exists stays and its unit tests run: launchd, systemd, the npm install, and `jaari
update` with the launcher. Nothing in a phase waits for it.

### macOS, launchd

Needs: macOS on Apple silicon or Intel, Node 26 and npm, the login keychain for `os-keychain`.

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

Needs: systemd with `systemd-creds` (ADR-122), Node 26 and npm, a TPM for credentials bound to the
machine (optional, `jaari doctor` reports it, ADR-123).

Found:
- The unit file, its quoting, and `systemd-creds` were built from the documentation and tested with
  fakes; they have never run on a real host (ADR-122, Consequences).
- `jaari update` does not stop or start a systemd service; the owner does (ADR-124, point 10).

Left: `jaari service install` with encrypted credentials on a real host; a systemd mode in
`check-update.mjs`, which covers launchd only; `jaari update`, its undo, and `jaari rollback` under
systemd.

### Windows, scheduled task

Needs: Windows 11 or Windows 10 22H2, x64 or arm64, Node 26 and npm (ADR-125, point 1).

Found (from the Node.js and npm documentation, ADR-125):
- Unix file modes do not exist there: `chmod` changes only the write bit, so the owner-only checks
  need the folder's ACL, and `host-credential` is refused.
- The chat must be a named pipe, in one namespace for all accounts.
- `current` must be a junction; the global npm layout differs (`{prefix}\node_modules`); Node
  refuses to run `.cmd` shims without a shell.

Left: all of roadmap 0.19 (ADR-125, points 2 to 10): Credential Manager, the folder ACL and its
`jaari doctor` check, the named pipe (another account must not write to it,
[THREAT_MODEL.md](THREAT_MODEL.md)), the scheduled task `\Jaari\daemon`, the PowerShell power hold
and battery reading, `node <script>` and System32 tools by full path, the npm layout and the junction,
and a Task Scheduler mode in `check-update.mjs`.
