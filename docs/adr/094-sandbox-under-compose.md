# ADR-094: Under Compose the sandbox is bubblewrap inside a hardened daemon container

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
The default VPS install runs the daemon in a Compose container, and the sandbox never gets the
Docker socket (ADR-056). ADR-056 left "a rootless Podman sidecar or gVisor" to implementation,
and the daemon container's own hardening was undecided (OQ-70). OpenMausBot runs bubblewrap
boxes inside its own container with shipped seccomp and AppArmor profiles, `cap_drop: ALL` plus
a minimal set, `no-new-privileges`, and an install-time probe that prints the exact fix
(`refs/openmausbot/connector/Dockerfile`, `connector/src/host.ts`, commit `b802268`; design
only). Bubblewrap is already ADR-036's Linux backend without a container runtime.

## Decision
**Backend under Compose.** Bubblewrap inside the daemon container. No Docker socket, no sidecar,
no container API for the daemon.

**Daemon container**, as written by `jaari init` in `compose.yaml`: a shipped seccomp profile
that allows only the namespace calls bubblewrap needs; the AppArmor profile where the host has
AppArmor; `cap_drop: ALL` plus the minimal capability set; `no-new-privileges`; a read-only root
filesystem, a non-root user, `tmpfs` for `/tmp`; process and memory limits; only the data volume
and the secret-zero file (ADR-079) mounted.

**Boxes** follow ADR-036: a sealed box has no network; a box that needs network gets one whose
only route is the loopback proxy into `@jaari/http`; the ADR-036 limits apply.

**Checks.** An install-time probe starts a throwaway box, and `jaari doctor` prints the exact fix
on failure; the ADR-036 boot self-check runs at every start. If either fails, code execution
stays off.

**Outside Compose** ADR-036 is unchanged. gVisor is an optional stronger backend, decided with
Firecracker in Phase 7.

## Alternatives rejected
A rootless Podman sidecar (gives the daemon a container-creating API); gVisor as the default
(needs a host runtime install); mounting the Docker socket (ADR-056 rejects it).

## Consequences
_TODO: fill in as implementation reveals them._
