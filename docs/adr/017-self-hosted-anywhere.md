# ADR-017: Self-hosted anywhere: VPS, remote server, or home hardware; placement rule and egress pool

- **Status:** Accepted
- **Extended by:** [ADR-030](030-overlay-network-and-sizing.md)
- **Date:** 2026-11-10

## Decision
**Goal.** Jaari is the self-hosted counterpart of the commercial personal agents (Instinct, Muse, Grok Bot, ChatGPT Work): always reachable, works while the owner's phone is off, drives a browser, and asks before acting. The owner runs it on hardware they control. **Three supported targets, one daemon, one codebase** (ADR-015): (1) a VPS or remote server; (2) home hardware (mini PC, NAS, Raspberry Pi-class box, an always-on desktop); (3) a laptop (supported, but work pauses while it sleeps). The target is configuration (`jaari init` asks), never a different build. "Local-first" is retired as a slogan; the principle is *self-hosted, owner-controlled data*. **Placement rule.** A capability that acts as the owner's logged-in identity (a browser signed in to the owner's accounts, desktop control) runs where the owner's network identity is: on home hardware, on an owner device installed as a node, or on any host through an owner exit node. A browser on a datacenter host does anonymous work (`web.fetch` escalation, research, accounts the agent owns). This keeps ADR-005's intent (the owner's cookies and residential IP, no CAPTCHA wall) while allowing a VPS daemon. **Egress pool.** `@jaari/http` and the browser's SOCKS5 listener (ADR-016) pick an egress provider per session by policy. Providers, in order of trust: (a) `owner-exit`: a Tailscale, Headscale, or WireGuard exit node on hardware the owner controls (home box, laptop, Pi); (b) `direct`: the host's own address; (c) `mobile`: the owner's 4G/5G dongle on a Pi; (d) `residential-proxy`: a commercial provider, behind a provider interface with a documented sourcing check. **Rotation.** Rotation is for anonymous traffic only, and the pool may mix owner exit nodes with residential proxies. Traffic on the owner's accounts is pinned: one account, one stable owner exit node (or direct from home hardware), with failover only to another owner node and a notice, never to a rotating or datacenter address (impossible-travel flags). If no owner exit is up, an owner-account session refuses and tells the owner; it never falls back silently. A VPS browser may send only an owner-set list of home sites through an owner node and everything else direct (OQ-32). Tailscale is the default overlay for node links, the owner panel, and exit nodes; Headscale and plain WireGuard are documented alternatives; no public ports. Stealth browsers, solver farms, and hosted agent browsers stay out of the default path.

## Alternatives rejected
VPS as the only target (a datacenter browser meets the CAPTCHA and 2FA walls documented in learning/08); home hardware as the only target (not everyone has an always-on box or a stable uplink); rotating residential proxies for the owner's own accounts (fraud flags); a project-run cloud VM per owner (not self-hosted); one build per target.

## Amendments
- **ADR-030:** The overlay is the owner's choice (Tailscale, Headscale, WireGuard, Cloudflare
  private network, custom) and can be changed later. `owner-exit` also accepts a SOCKS5 or HTTP
  proxy (for example sing-box). New egress class `vpn` (for example Cloudflare WARP) serves
  anonymous traffic only.

## Consequences
_TODO: fill in as implementation reveals them._
