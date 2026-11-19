# ADR-112: The `os-keychain` provider reads the keychain through `@napi-rs/keyring`

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
ADR-018 and ADR-079 put an `os-keychain` provider in Phase 0 (roadmap 0.11) for hosts that have a
keychain: macOS, and Linux desktops with Secret Service. Node has no built-in keychain API, so the
provider needs either a library or the platform's own command-line tools.

## Decision
- **One dependency, `@napi-rs/keyring` (MIT), pinned exactly.** It binds Rust's `keyring` crate
  through Node-API and ships prebuilt binaries as one optional package per platform, so it has no
  install script and needs no `allowBuilds` entry (ADR-043). It covers macOS Keychain, Secret
  Service, and Windows Credential Manager with one API.
- **Read only in Phase 0.** The provider calls `new AsyncEntry(service, name).getPassword()` with
  service `jaari`. `null` means the entry is missing; a rejection means the keychain is locked or
  absent, which `health()` reports. Writing secrets arrives with `jaari secret set`.
- **Loaded on first use.** The provider imports the module dynamically, so a host that uses
  `host-credential` (ADR-079) never loads native code.

## Alternatives rejected
- **The platform's command-line tools** (`security find-generic-password -w` on macOS,
  `secret-tool lookup` on Linux) through `execFile`: no dependency and no native code, but one
  branch per platform, `libsecret-tools` as an extra host package, and no Windows support.
- **`keytar`:** archived by its maintainers.

## Consequences
- Native code from a third party is in the supply chain. Dependabot proposes updates; each one
  waits out the 7-day release age like any other package.
- CI never talks to a real keychain: the tests replace the module with `vi.mock`. The first real
  read is a manual check on a macOS host.
- Roadmap 0.6 (2026-11-17): the provider also writes, with `AsyncEntry.setPassword`, for
  `jaari secret set` only (ADR-118). Executors still only read.
