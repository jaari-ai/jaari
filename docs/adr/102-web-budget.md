# ADR-102: Web budget: a monthly limit for paid web services, then self-hosted only until the reset

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
ADR-046 leaves search and fetch cost to "the separate `web` budget", and ADR-053 counts paid
egress against it, but no ADR defined it; only the example config gave values (OQ-89). Every paid
web service has a free self-hosted fallback: SearXNG for search, direct fetch and a local browser
for pages (ADR-049), and `direct` egress.

## Decision
**Default.** `jaari init` suggests $10 a month for the hybrid and api-only presets and $0 for
local-only; the owner sets it. It is separate from the model budget (ADR-046); both show in the
Usage view (ADR-067).

**What counts.** Paid search APIs (Brave, Serper, Tavily, Exa), hosted fetch and scraping
(Firecrawl Cloud), hosted browser providers (per minute), and paid egress (residential and mobile,
per GB, ADR-053). Self-hosted services and `direct` egress cost $0. Every paid call is recorded in
the usage log (ADR-032).

**Warnings.** One digest line at 50% and one at 80% (ADR-046, from Phase 2).

**At 100%: self-hosted only until the reset, automatically.** Paid rungs and providers are
skipped; SearXNG, direct fetch, the local browser, and `direct` egress continue. One notice offers
"raise the budget for this month" (an ADR-035 prompt). Where no free fallback exists (search with
no SearXNG configured, a session on a hosted browser provider), the call fails with a clear notice
and never runs on paid services. Config: `"onExceeded": "self-hosted-only"`.

## Alternatives rejected
Asking before switching, as the model budget does (nothing breaks while a free fallback exists);
one shared budget for models and web (different providers and fallbacks).

## Consequences
_TODO: fill in as implementation reveals them._
