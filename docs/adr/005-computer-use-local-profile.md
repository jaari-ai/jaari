# ADR-005: Computer use on a pinned local Chromium profile with takeover

- **Status:** Accepted
- **Extended by:** [ADR-015](015-control-plane-and-nodes.md), [ADR-016](016-openmausbot-hardening.md), [ADR-017](017-self-hosted-anywhere.md)
- **Date:** 2026-11-05

## Decision
Browser and desktop actions run against a pinned local Chromium profile on the owner's network. Logins, CAPTCHA, and 2FA are handed to the owner via desktop takeover. Docker and Firecracker are optional isolated backends.

## Alternatives rejected
Cloud browser by default (CAPTCHA/2FA walls, as Instinct hit); storing site passwords for the agent.

## Amendments
- **ADR-017:** "Local" means the owner's network identity, not necessarily the daemon's machine: the profile runs on home hardware, an owner node, or through an owner exit node. A datacenter browser does anonymous work only.

## Consequences
_TODO: fill in as implementation reveals them._
