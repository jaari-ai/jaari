# ADR-005: Computer use on a pinned local Chromium profile with takeover

- **Status:** Accepted
- **Extended by:** [ADR-015](015-control-plane-and-nodes.md), [ADR-016](016-openmausbot-hardening.md), [ADR-017](017-self-hosted-anywhere.md), [ADR-048](048-browser-surface-and-adapters.md), [ADR-055](055-takeover-transport.md), [ADR-098](098-owner-accounts-on-any-host.md)
- **Date:** 2026-11-05

## Decision
Browser and desktop actions run against a pinned local Chromium profile on the owner's network. Logins, CAPTCHA, and 2FA are handed to the owner via desktop takeover. Docker and Firecracker are optional isolated backends.

## Alternatives rejected
Cloud browser by default (CAPTCHA/2FA walls, as Instinct hit); storing site passwords for the agent.

## Amendments
- **ADR-017:** "Local" means the owner's network identity, not necessarily the daemon's machine: the profile runs on home hardware, an owner node, or through an owner exit node. A datacenter browser does anonymous work only.
- **ADR-015:** the pinned profile runs where the capability is installed (daemon host or an owner node); takeover and the live view belong to the host that runs the screen.
- **ADR-016:** takeover is a hold owned by the owner (point 7).
- **ADR-048:** browser backends are pluggable adapters behind one neutral surface.
- **ADR-055:** each adapter declares its takeover transport; one panel view shows it.
- **ADR-098:** a signed-in browser may run on a datacenter host or an enabled third-party
  provider; a dedicated profile, never the owner's own, still holds.

## Consequences
_TODO: fill in as implementation reveals them._
