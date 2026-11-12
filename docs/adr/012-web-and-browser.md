# ADR-012: Web search, fetch, and browser as separate pluggable tools

- **Status:** Accepted
- **Extended by:** [ADR-016](016-openmausbot-hardening.md), [ADR-017](017-self-hosted-anywhere.md), [ADR-019](019-model-pinning-and-local-only-defaults.md), [ADR-048](048-browser-surface-and-adapters.md), [ADR-049](049-fetch-ladder-and-lightpanda.md)
- **Date:** 2026-11-05

## Decision
`@jaari/web` provides `web.search` (SearXNG default, Brave fallback, Tavily/Exa plugins) and `web.fetch` (http+readability → Lightpanda → Chromium → hosted reader; Firecrawl-compatible API as the scraper contract). Interaction stays in `@jaari/computer` via Playwright MCP or Stagehand primitives inside Jaari's loop, against the local profile or any remote CDP endpoint. All web content passes the tool-less reader role.

## Alternatives rejected
Single all-in-one vendor; browser-use as the browser agent (owns its loop, bypasses per-action gating); cloud browser by default; LLM-vendor native search (lock-in).

## Amendments
- **ADR-017:** The "local profile" default is placed by the placement rule and reaches the network through the egress pool; the SOCKS5 gate of ADR-016 is the only route out.
- **ADR-016:** `@jaari/http` egress is resolve, check, dial (point 5).
- **ADR-019:** accepts this ADR (point 4).
- **ADR-048:** the interaction layer is one neutral surface with pluggable browser adapters; Playwright MCP and Stagehand are adapters, not the layer.
- **ADR-049:** fetch rungs are pluggable; Lightpanda is optional and off by default, so the default ladder is http + readability, then Chromium, then a hosted reader.

## Consequences
_TODO: fill in as implementation reveals them._
