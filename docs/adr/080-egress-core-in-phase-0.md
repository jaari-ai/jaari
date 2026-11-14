# ADR-080: Egress core in Phase 0: every outbound call goes through `@jaari/http` from the start

- **Status:** Accepted
- **Extended by:** [ADR-104](104-prompt-injection-defence-in-depth.md)
- **Date:** 2026-11-12

## Context
All network egress goes through `@jaari/http` (ADR-016, resolve, check, dial), but the roadmap
shipped it in Phase 4, while model providers, Telegram, speech APIs, and model downloads make
calls from Phase 0 (OQ-68).

The core is small: OpenMausBot's address check and checked dial are about 170 lines
(`refs/openmausbot/electron/egress-addresses.mjs`, `device-egress.mjs`, commit `b802268`).
`@earendil-works/pi-ai` takes an injected `fetch` for provider calls
(`refs/pi/packages/ai/src/types.ts`, commit `469d865`); WebSocket transports do not use it, and
some adapters (Google Vertex and Gemini) refuse a custom one.

## Decision
**Split `@jaari/http`.** Phase 0 ships the core: resolve, check, dial; the one address-class
table (ADR-016); and the `direct` provider. Phase 4 adds the `owner-exit` provider and
per-capability host allowlists. Phase 6 adds the browser's SOCKS5 listener and the other pool
providers (ADR-053).

**Every outbound call from Jaari's own processes uses the core from Phase 0.** Model providers
get it through pi-ai's `fetch` option; Telegram, speech APIs, and download helpers use the same
`fetch`. A lint rule refuses direct use of `fetch`, `node:http`, `node:https`, `node:net`,
`node:tls`, and `undici` outside `@jaari/http`, and a test checks the rule.

**An adapter that cannot use the injected `fetch` stays off** until it can (WebSocket
transports, adapters that refuse a custom `fetch`). `jaari doctor` names each one.

**Local model servers the owner runs** (Ollama, LM Studio, llama.cpp, in Compose or not) are
outside Jaari's egress. Jaari reaches each only on the loopback or local endpoint listed in
config, which counts as an owner-allowed host in the address table. Their own model
downloads are their own traffic.

**Containers that work on untrusted input for Jaari** (SearXNG, the browser, the code sandbox)
get the container egress proxy when the first of them ships, not later. The proxy uses the same
address-class table.

## Alternatives rejected
Raw `fetch` until Phase 4 (breaks the rule, and later code must be found and rewritten);
blocking every network call until Phase 4 (no model provider in Phases 0 to 3); a global
`undici` dispatcher (does not cover every client, and hides the route from review).

## Amendments
- **ADR-104:** the core scans outbound URLs and bodies for the canary and the session fence id, blocks a hit, writes an audit row, and alerts the owner. (Provenance holds on `web.fetch` and `web.search` arguments are decided at the tool call, before the gate, not in the core.)

## Consequences
_TODO: fill in as implementation reveals them._
