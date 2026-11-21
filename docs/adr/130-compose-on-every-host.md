# ADR-130: Docker Compose on every host as built: a socket probe, the data in a named volume where the host's folder cannot hold the socket, and a root step that only sets its owner

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
ADR-128 made Docker Compose the main install on every host: Linux, macOS, and Windows. On Linux the
engine shares the host's own file system. On macOS and Windows it runs Linux in a virtual machine
(Docker Desktop, or another engine) and shares the host's folders into it. A probe on Docker Desktop
for macOS (2026-11-21) showed the exact limit of such a shared folder: a file keeps mode `600` and a folder mode `700`, but setting a
socket's mode fails with `EINVAL`. The chat socket must be private (ADR-021), so only the data
folder, which holds it, has to move. Inside the container, `jaari init` sees Linux in both cases, so
the platform cannot tell a shared folder from a Linux one. A new volume belongs to root, and Docker
copies the image folder's owner and mode into a volume each time it is mounted empty (ADR-127).

## Decision
1.  **`jaari init` tests the Jaari folder.** It makes a socket there, sets its mode to `600`, and
    removes it. When the mode cannot be set, `compose.yaml` keeps the data in a named volume, `data`.
    Otherwise the data stays in `./data`, as before, so an install on Linux does not change. The test
    is about the folder, not the engine, so it holds for any engine with Compose on any host, and for
    a WSL 2 folder on Windows, which is a Linux file system. A socket
    that cannot be made at all (a path too long) tells nothing, and the folder stays.
2.  **Every mount of the volume uses `nocopy`:** the daemon, `admin`, and the step below.
3.  **A one-off `data` step gives the volume to the owner's account.** It runs from the same image as
    root, with only the `CHOWN` and `FOWNER` rights, no network, a read-only root file system, and
    `no-new-privileges`. It runs `chown <uid>:<gid>` and then `chmod 700` on the data folder, and
    nothing else. The daemon and `admin` start only after it ends well
    (`service_completed_successfully`). It runs at every start, so a volume that something else
    changed gets its owner back.
4.  **The config, the credentials, and `compose.yaml` stay in the Jaari folder on the host.** Their
    modes hold there, and the owner edits them as before.

## Alternatives rejected
- **A named volume everywhere:** an install on Linux would leave its `./data` behind, and the owner
  would lose a folder that is easy to back up.
- **The chat socket in a `tmpfs` of the daemon's container:** `admin` runs in another container, so
  `admin rollback` could not see that the daemon is running, and it could restore over open stores.
- **A probe by platform, or a variable the guide sets:** inside the container both systems are
  Linux, and a variable the owner can forget gives a daemon that cannot start.
- **A step the owner runs once by hand:** the guide gets longer, and a recreated volume would need it
  again.

## Consequences
- Where the data is in the volume (macOS, and a folder shared from Windows), it is not visible in Finder or Explorer. `docker compose run --rm admin …`
  reaches it. Backup (Phase 3) must read the volume (ADR-128).
- Docker creates an empty `data` folder in the Jaari folder on the host, where the `admin` service
  mounts the volume. Nothing is written there.
- `docker compose down --volumes` deletes the data where it is in the volume. The guide uses it only to remove Jaari.
- Compose mounts `config.jsonc` as one file. An editor that writes a new file, such as `sed -i`,
  is seen only after `docker compose up --wait --force-recreate`.
- Shown on Docker Desktop for macOS on 2026-11-21: `scripts/check-update.mjs --docker` (the probe
  chose the volume, and the update and its way back pass), and an install with a key file (healthy,
  `admin doctor` passes, the socket `600` and the data folder `700`, both owned by the owner's account).
  Not shown on Windows.
- Amends ADR-127 (Compose is for every host, not Linux only; the data volume) and ADR-128 (point 1 as
  built: any engine with Compose, not only Docker Desktop).
