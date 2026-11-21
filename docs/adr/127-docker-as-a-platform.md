# ADR-127: Docker as a platform: a health check, `up --wait` instead of a pause, a local image check, and Compose on Linux hosts only

- **Status:** Accepted
- **Extended by:** [ADR-128](128-docker-first.md), [ADR-129](129-snapshot-on-version-change.md)
- **Date:** 2026-11-20

## Context
The owner asked on 2026-11-20 that every fix and recommendation cover Docker as well as Linux, macOS,
and Windows. Under Compose the image is the version (ADR-123, ADR-124 point 14). The `compose.yaml`
that `jaari init` writes has no health check, and the install guide says "wait a few seconds for the
daemon" before `docker compose run --rm admin doctor`: the same guess about the machine as the
15-second wait that undid a good update on a busy Mac (ADR-124, Consequences). An image update has
the same gap: `docker compose up -d`, then `admin doctor` at once.

The Compose 5.6 documentation: `docker compose up --wait` waits for the services to be "running or
healthy" and implies detached mode; `--wait-timeout` sets the limit in seconds. A service is healthy
only when it has a health check. `scripts/check-release.sh` found that Docker on macOS cannot set the
mode of a socket in a folder shared from the host, so the data folder cannot be a bind mount there.

## Decision
1.  **The daemon service has a health check:** `jaari doctor` inside the daemon container, which
    already holds the command, the config, the data, and the secrets. Settings: `interval` 30 s,
    `timeout` 20 s, `retries` 3, `start_period` 120 s, `start_interval` 2 s. During the first two
    minutes a failed check does not count, and the check runs every 2 seconds, so a fast start is
    healthy at once and a slow one has two minutes, as with launchd (ADR-124 Consequences) and
    Windows (ADR-125). `start_interval` needs Docker Engine 25 or later. On a slow host the owner
    raises `start_period` in `compose.yaml`; `jaari init` keeps an edited file and writes the new one
    beside it (ADR-123, point 6).
2.  **The guide and `jaari init` say `docker compose up --wait --wait-timeout 180`,** never "wait a
    few seconds". `--wait-timeout` is the owner's override, as `--wait` is for `jaari update`; it
    should be longer than `start_period`. Then `admin doctor` runs against a daemon that answers. For an image update, a
    failed `up --wait` is the sign to go back: the old tag, `admin rollback --yes`, and `up --wait`.
3.  **Compose is for Linux hosts.** On macOS and Windows, Jaari is installed with npm (ADR-125).
    Docker Desktop on those systems runs the Linux image in a virtual machine, where a bind-mounted
    data folder cannot hold the chat socket with its mode. It serves the local image check below,
    with the data in a volume inside the virtual machine, and it is not a supported install.
4.  **The local check covers the image (ADR-126).** `scripts/check-update.mjs --docker` builds two
    local images from two packed tarballs, tagged `ghcr.io/jaari-ai/jaari:0.0.0-check.1` and `.2` as
    the file that `jaari init` writes names them (no registry, no push), starts the first with the file that `jaari init` writes, runs the image
    update as the guide does (change the tag, `up --wait`, `admin doctor`), then the way back with
    the old tag and `admin rollback`. It runs on the owner's machine, on Linux Docker and on Docker
    Desktop, where the data folder is a volume inside Docker's Linux machine. There is no CI job.
5.  **Every ADR that adds a host-facing feature states its behaviour on Linux, macOS, Windows, and
    Docker.**

## Alternatives rejected
- **A longer pause in the guide:** still a guess; `--wait` waits exactly as long as needed.
- **`docker compose up -d` and a loop around `admin doctor`:** the health check gives Docker the same
  knowledge, and `docker compose ps` and `restart` policies can then use it.
- **Supporting Compose on Docker Desktop:** the socket and the owner-only modes need a Linux file
  system that the host shares, which Docker Desktop does not give.
- **A separate health endpoint in the daemon:** a port, or one more command; `jaari doctor` already
  checks that the daemon answers and that its files are private.

## Amendments
- **ADR-128:** Compose on Docker Desktop, with the data folder in a named volume, is a supported install on macOS and Windows (roadmap 0.21); point 3 no longer holds.
- **ADR-129:** the way back under Compose restores the latest snapshot when `admin rollback --list` shows it by the new version (OQ-96 resolved).

## Consequences
- Roadmap 0.20 builds the health check, the guide change, and the Docker mode of the local check.
- Each health check starts Node once every 30 seconds inside the container.
- Amends ADR-123 (the health check in `compose.yaml`; Compose for Linux hosts) and ADR-124 (the image
  update waits with `up --wait`).
