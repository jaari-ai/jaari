# ADR-080: Egress core in Phase 0: every outbound call goes through `@jaari/http` from the start

- **Status:** Accepted
- **Extended by:** [ADR-104](104-prompt-injection-defence-in-depth.md), [ADR-120](120-prompt-injection-floor-as-built.md), [ADR-124](124-update-as-built.md)
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

- **ADR-120:** the scan is an option of `createEgress`; the egress for model calls runs without it, because the prompt holds the canary and the fence id. The scan reads the URL, the headers, and the body before any connection opens.
- **ADR-124:** `jaari update` reaches npm and GitHub through `@jaari/http`. `@sigstore/tuf` is a
  dependency for the roots it carries; its network client is never called.

## Consequences
- **Roadmap 0.15 (2026-11-16):** built on Node's `fetch` and an undici `Agent` (ADR-113).
- A name may return some refused addresses: the core dials the first address that passed and
  never a refused one (OpenMausBot refuses the whole connection instead; learning/14). This keeps
  `localhost` working with one allowed loopback address.
- The daemon's own ports are refused on every address that is not public, even when allowed.
  The machine's own interface addresses form a `this-machine` class, treated like loopback.
- The lint rule also refuses `node:http2`, `node:dgram`, and the `WebSocket` and `EventSource`
  globals, which are network clients too. `globalThis.fetch` and `global.fetch` are caught; an
  alias such as `const g = globalThis; g.fetch` is not.
- A refusal is an `EgressRefused` error, the `cause` of the `TypeError` that `fetch` throws.
- An allow entry can be `name:port` (port required), such as `ollama:11434`: a Compose service
  gets a new address on each start. It allows the loopback, this-machine, or private addresses that
  name resolves to, for that name and port only; metadata, link-local, reserved addresses and the
  daemon's own ports stay refused.
- Listening is not egress. The lint rule allows the server names of `node:http`, `node:https`
  (`createServer`, `Server`, `IncomingMessage`, `ServerResponse`) and `node:net` (`createServer`,
  `Server`, and the parsers `isIP`, `isIPv4`, `isIPv6`) everywhere, for the daemon's local socket (ADR-021) and the hook listener (ADR-073).
  Client names stay refused. Roadmap 0.8 (2026-11-17): one file, `apps/cli/src/socket.ts`, may
  import `createConnection`, and it refuses anything but an absolute path, so `jaari chat` reaches
  only the daemon's Unix socket; a lint test checks that every other file still refuses it.
- Roadmap 0.5 (2026-11-16): the daemon builds the allow list from every model provider with a
  `baseUrl` in config, as `host:port`, so the owner's local model servers pass the check.
