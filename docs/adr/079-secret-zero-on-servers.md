# ADR-079: Secret zero on a server: a `host-credential` provider fed by the service manager

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-013 keeps secret zero (the bootstrap credential that opens only Jaari's dedicated vault,
ADR-050) in the OS keychain, and Phase 0 ships only an `os-keychain` provider (ADR-018). The
first hosting target is a VPS (ADR-017) installed with Compose (ADR-056). A headless Linux
server and a container have no OS keychain, so the daemon could start there only with a
development-only provider (OQ-67).

The reference projects do not use a keychain on a server: gajae-way keeps one file per
credential and also reads Kubernetes secret mounts (`refs/gajae-way/docs/deployment.md`,
commit `34cbd15`); open-instinct keeps tokens in a `secrets/` folder at mode 0600 and API keys
in environment variables (`refs/open-instinct/docs/ARCHITECTURE.md`, commit `2e5e71b`).

## Decision
**One production provider, `host-credential`, for hosts without a keychain.** It reads secret
zero from a file that the service manager hands to the daemon at each start:
- **systemd** (`jaari service install`): `LoadCredentialEncrypted=` with `systemd-creds` is the
  default when the host supports it; the file is encrypted on disk, and sealed to the TPM when
  the host has one. Otherwise `LoadCredential=` with a root-only file.
- **Compose**: a top-level `secrets:` entry in the `compose.yaml` that `jaari init` writes,
  mounted read-only at `/run/secrets/jaari-secret-zero`.

**Checks at start.** `host-credential` refuses to start if the file is readable by group or
others, lies inside the Jaari data directory, or is in the backup set. `jaari doctor` reports
which form is in use: encrypted, TPM-sealed, or plain. It is not the development `file`
provider, and `doctor` does not warn about it.

**Unattended restart works:** the service manager supplies the file again at each start. An
owner who wants a manual unlock after every reboot uses the passphrase-unlocked data folder
(`docs/guides/securing-your-install.md`).

**`os-keychain` stays** where a keychain exists: macOS, and Linux desktops with Secret Service.
**Environment variables are never used for secret zero**: they reach child processes, `/proc`,
and `docker inspect`. `env` stays development-only (ADR-018).

**Left over.** Root on the host can read the file, as it can read a keychain on a running
host. The damage is limited to the dedicated vault (ADR-050).

## Alternatives rejected
The development `file` provider in production (no permission or location checks, and `doctor`
warns about it); environment variables; Docker Swarm secrets (Jaari's install is plain
Compose); a passphrase typed at every start as the default (no unattended restart).

## Consequences
_TODO: fill in as implementation reveals them._
