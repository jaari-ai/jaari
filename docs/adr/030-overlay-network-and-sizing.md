# ADR-030: Bring your own overlay network; security does not depend on it; reference sizing

- **Status:** Accepted
- **Extended by:** [ADR-073](073-inbound-triggers.md), [ADR-088](088-overlay-panel-and-node-link-phasing.md)
- **Date:** 2026-11-10

## Decision
**Overlay is the owner's choice, at `jaari init` and at any time after.** Jaari needs three
things from the network: owner devices reach the daemon privately, nodes reach the daemon, and
the daemon can route through an owner exit node (ADR-017). Supported modes:
- **Tailscale** (default for a new install): panel HTTPS through `tailscale serve`; exit nodes
  built in.
- **Headscale**: the same clients with a self-hosted coordinator.
- **WireGuard** (first-class): bind to an existing interface, or let `jaari init` generate peer
  configs for the host, devices, and nodes. The owner picks which.
- **Cloudflare Zero Trust private network**: reached through the WARP client and a tunnel's
  private routing, with no public hostname.
- **Custom** (for example sing-box): the owner gives the address and interface to bind to.

The mode, interface, and generated or existing configs are set in config and changed with
`jaari network` or the panel; a change takes effect after a daemon restart and `jaari doctor`
checks it.

**Security does not depend on the overlay.** Whatever the mode, Jaari binds only to loopback
and the chosen private interface (never `0.0.0.0` or a public hostname); authenticates devices
and nodes at the application level (ADR-022 device tokens, the daemon's pinned key), so a
misconfigured overlay does not grant access; and serves the panel over TLS (certificate from
Tailscale, Cloudflare, or a local one Jaari creates). No public ports: Telegram uses long
polling (ADR-021); inbound webhooks are ADR-073.

**Egress (amends ADR-017).** The `owner-exit` provider accepts a WireGuard peer or a SOCKS5 or
HTTP proxy address, so a sing-box router works as an exit. A new provider class, `vpn`, covers
consumer VPN egress such as Cloudflare WARP: its addresses are treated like datacenter or VPN
addresses, so it serves anonymous traffic only and never sessions on the owner's accounts.

**Reference sizing** (estimates until measured; `jaari doctor` reports actual use):

| Profile | Runs | CPU | RAM | Disk |
|---|---|---|---|---|
| Minimal | Daemon, SQLite, git; API models; no browser | 1 vCPU | 1–2 GB | 10 GB |
| Standard | Plus SearXNG and a browser | 2 vCPU | 4 GB | 20–40 GB |
| Local small model | Plus a 3–8B model (LLM.md) | 4+ vCPU | 12–16 GB | 40 GB+ |
| Local medium model | See LLM.md | | | |

## Amendments
- **ADR-073:** the hook listener alone may be made public through an opt-in exposure adapter
  (Tailscale Funnel, Cloudflare Tunnel, or custom), offered when a webhook is created; the
  panel, API, and nodes stay off public ports.

## Alternatives rejected
Tailscale as the only overlay (excludes owners who run WireGuard, sing-box, or Cloudflare);
relying on the overlay for authentication (one misconfiguration exposes the daemon); a public
tunnel or reverse proxy for the panel and nodes (a public door); WARP or other consumer VPN
egress for owner-account sessions (datacenter-like reputation and location flags).
- **ADR-088:** Phase 2 ships the binding, TLS, and the Tailscale, Headscale, and Custom modes;
  WireGuard peer generation, Cloudflare Zero Trust, and sizing ship in Phase 7.

## Consequences
_TODO: fill in as implementation reveals them._
