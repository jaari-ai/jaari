# ADR-088: Overlay binding and panel TLS in Phase 2, node link in Phase 6, panel views with their features

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-020 placed the overlay in Phase 7 before later ADRs relied on it. The Phase 2 panel is
served only over the overlay with TLS (ADR-067), and four of its views need Phase 3 parts.
`owner-exit` (Phase 4) and takeover (Phase 6) need an overlay route; remote nodes (Phase 6)
need the node link, a WebSocket across the overlay (ADR-058), placed in Phase 7 (OQ-72).
Security never depends on the overlay (ADR-030): Jaari binds to loopback and one chosen private
interface, authenticates devices itself, and serves TLS. This ADR changes when parts ship.

## Decision
**Overlay split.** Phase 2: bind to loopback and one chosen private interface; TLS with a
certificate from `tailscale serve` or a local one Jaari creates; the modes Tailscale (default),
Headscale, and Custom (which covers an existing WireGuard interface); a `jaari doctor` check.
Phase 7: WireGuard peer-config generation, Cloudflare Zero Trust, and sizing per target.

**Panel views ship with their features** (ADR-067's own rule). Phase 2: Home, Memory,
Settings, Usage, and Activity from the event log with the "why" view. Phase 3: Approvals and the
audit part of Activity with the real gate; secret entry with the vault work.

**Secrets before the panel page.** `jaari secret set <name>` takes the value through a masked
CLI prompt into `os-keychain` or `host-credential`. Until the secret-entry page exists, the
ADR-081 notice points to this command.

**Node link** moves to Phase 6 with remote nodes. Multi-device state and host migration stay in
Phase 7.

`owner-exit` and takeover depend on the Phase 2 overlay binding; Tailscale exit nodes are built
in.

## Alternatives rejected
All overlay modes in Phase 2 (WireGuard generation and Cloudflare are not needed by the panel);
the panel waiting for Phase 7; showing an Approvals view before approvals exist.

## Consequences
_TODO: fill in as implementation reveals them._
