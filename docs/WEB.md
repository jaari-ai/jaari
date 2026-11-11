# Jaari: Web search, fetch, and browser (ADR-012)

Three tools, three provider interfaces. Code picks backends and escalates on measurable
signals; the model calls `web.fetch` to read and asks for `browser.*` only to interact.

| Tool | Self-hosted default | Hosted options |
|---|---|---|
| `web.search` | SearXNG (separate AGPL container, JSON enabled) | Brave (fallback), Serper, Tavily, Exa |
| `web.fetch` | http + readability → (Lightpanda, optional, off by default; ADR-049) → local Chromium | Jina Reader, Firecrawl Cloud |
| `browser.*` | Pluggable adapters (ADR-048): headful on the host virtual desktop or an owner node, Playwright MCP or Stagehand on the local pinned profile | Any remote CDP: Steel, Kernel, Browser Use, Browserbase, Hyperbrowser; custom adapters, including anti-detect ones |

## Where the browser runs (ADR-017)
- Placement rule: a browser signed in to the owner's accounts runs on home hardware, on an owner
  device installed as a node, or on any host through an owner exit node (Tailscale, Headscale,
  WireGuard). A browser on a VPS or other datacenter host does anonymous work only.
- Egress pool: `owner-exit` (WireGuard peer or SOCKS5/HTTP proxy such as sing-box), `direct`,
  `mobile`, `residential-proxy`, `vpn` (WARP and similar; anonymous only, ADR-030). Rotation is for
  anonymous traffic and may include owner exit nodes; owner-account sessions are pinned to one
  owner node and refuse when none is up.

## Rules
- Fetch escalates on: 403, 429, challenge page, < ~500 chars of text, JS-required.
- Rungs are pluggable adapters; a domain that keeps needing a higher rung starts there for 30
  days; at most once a month Jaari suggests turning Lightpanda on or off from the usage log
  (ADR-049).
- Scraper contract is the Firecrawl API: self-hosted Firecrawl, CRW, or Firecrawl Cloud is
  a URL swap.
- Browser runs inside Jaari's loop so the gate sees every action; browser-use (own loop)
  only as an isolated child, if ever.
- Disable `browser_run_code_unsafe`. Enforce origins at the egress proxy, not in the tool.
- Every browser adapter runs the same neutral surface and picks its exit from the egress pool;
  fingerprint spoofing only in an owner-enabled adapter, with a warning before it is used on a
  signed-in owner profile (ADR-048).
- The browser's only route out is the `@jaari/http` SOCKS5 gate (resolve, check, dial;
  ADR-016). Saved logins are filled by the executor; the model never sees the value, and
  screenshots stop while a filled secret is on the page.
- A browser on a VPS may send an owner-set list of home sites through an owner node and
  everything else direct (OQ-32 holds the remaining pool details).
- Search queries are sensitive: `curiosity` and `canonicalize` use SearXNG only.
- AGPL/SSPL services (SearXNG, Firecrawl, CRW, Lightpanda, Browserless) run as separate
  processes; never vendor their code into Jaari packages.
- Every call logs tool, backend, ladder step, cost, outcome to the usage ledger.

## Presets
| Preset | Search | Fetch | Browser |
|---|---|---|---|
| local-only | SearXNG | http → (Lightpanda) → Chromium | pinned profile on the daemon host (home hardware or laptop) |
| hybrid (default) | SearXNG → Brave | http → (Lightpanda) → Chromium → Jina | pinned profile where the owner's identity is (home box or owner node, or any host through an owner exit node); remote CDP or host browser for anonymous background work |
| api-only | Brave or Tavily | Jina or Firecrawl Cloud | hosted CDP (anonymous work only) |

Config: see `jaari.config.example.jsonc`, section `web`.
