# ADR-053: Egress pool: pluggable providers, one connection baseline, sticky anonymous rotation, home sites suggested from the vault

- **Status:** Accepted
- **Extended by:** [ADR-071](071-capability-packages.md), [ADR-080](080-egress-core-in-phase-0.md), [ADR-098](098-owner-accounts-on-any-host.md)
- **Date:** 2026-11-11

## Decision
**Providers are pluggable adapters** in `@jaari/http`, with a manifest: class (`owner-exit`,
`direct`, `vpn`, `residential-proxy`, `mobile`), transport (WireGuard peer, SOCKS5, HTTP CONNECT),
exit IP and country reporting, cost per GB (counted against the `web` budget, ADR-046), and a
sourcing note. A generic SOCKS5 or HTTP proxy adapter (URL plus `secretRef` credentials) covers
any residential or mobile provider; v1 has no vendor-specific proxy code.

**One baseline for every connection.**
- DNS answers validated and pinned per connection; no private or LAN addresses unless the target
  is the owner's own.
- Each redirect re-checked as a new request, never followed blindly.
- A secret bound to one origin and one header.
- 15 s timeout; responses 64 KiB by default and 1 MiB at most, with per-capability overrides
  (`web.fetch` up to 10 MiB; files follow ADR-038).

**Routing.**
- Owner-account sessions are pinned to one owner exit; when it is down they refuse and notify
  once (ADR-017).
- Home sites go through an owner node, which re-checks each connection itself (ports 80 and 443,
  never its own LAN); everything else leaves direct.
- Anonymous traffic is sticky per task (one exit for the whole task) and rotates between tasks; on
  403, 429, or a challenge page it moves to the next enabled class (direct, then vpn, then
  residential or mobile), in step with the fetch ladder (ADR-049).

**Health.** Every 5 minutes a light probe through each provider records exit IP, country, and
latency; three failed probes take it out of rotation. A change of an owner exit's public IP or
country is reported once, since signed-in sessions may be challenged.

**Residential and mobile providers are opt-in.** `jaari init` does not push them; the provider
guide lists known options with their sourcing pages (Oxylabs, Decodo, IPRoyal, Webshare) as
information. They serve anonymous traffic only, never owner accounts.

**4G or 5G dongle:** a guide, not code: a Raspberry Pi with a modem runs sing-box (SOCKS5) and
joins the overlay (ADR-030) as a node with a `mobile` exit.

**Home-sites list.**
```jsonc
"homeSites": [
  { "match": "*.mybank.com", "via": "node:home-mini-pc" },
  { "match": "mail.google.com" }   // default owner exit
]
```
`jaari init` and the panel suggest entries from the login URLs in Jaari's vault items (ADR-050);
the owner confirms the list.

**Phasing.** `direct` and `owner-exit` in Phase 4 for fetch and Phase 6 for the browser; `vpn`,
residential, and mobile in Phase 6, all opt-in.

Borrowed: the connection baseline from openinstinct `assistant-work/http-effects.ts` and
`http-policy.ts` (behaviour only); the home-sites split and its measured cost of routing all
traffic home from OpenMausBot (learning/09); provider and dongle options from learning/08.

## Alternatives rejected
Routing all traffic through the owner's home (1.7 to 30 times slower, learning/09); per-request
rotation (breaks site sessions); residential proxies for owner accounts (logins from strange
places trip fraud checks); vendor-specific proxy integrations in v1; a hand-written home-sites
list with no suggestions.

## Amendments
- **ADR-071:** egress providers are capability packages with a checked manifest.
- **ADR-080:** the `direct` provider ships in Phase 0 with the egress core; `owner-exit` stays
  Phase 4. The container egress proxy ships with the first container that works on untrusted
  input (SearXNG, browser, or sandbox).
- **ADR-098:** owner-account sessions are no longer pinned to an owner exit; only home sites
  are, and the list ships with a default of data-centre-hostile sites.

## Consequences
_TODO: fill in as implementation reveals them._
