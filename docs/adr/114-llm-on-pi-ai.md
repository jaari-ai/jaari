# ADR-114: `@jaari/llm` on pi-ai 1.5.0: keys only from `secretRef`, the usage log in `node:sqlite`, refusals stop until categories are mapped

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
Roadmap 0.7 builds `@jaari/llm` on `@earendil-works/pi-ai` (ADR-001, ADR-011). Reading pi-ai 1.5.0
(`refs/pi/packages/ai`, commit in `refs/INDEX.md`; learning/15) showed four things the ADRs did not
settle:
- Built-in providers fall back to environment variables and ambient credential files when no key
  is passed, which ADR-018 and ADR-079 forbid for keys.
- A request that ends in `error` with no `start` event never reached the model; one with `start`
  was accepted (ADR-016 point 4 needs that line).
- pi-ai maps Anthropic's `refusal` to `stopReason: "error"`, keeps `rawStopReason` and the
  explanation, and drops the refusal category. ADR-011's off-limits categories (impersonation,
  CAPTCHA solving) therefore cannot be told apart, and no document maps provider categories to them.
- ADR-032 puts the usage log in SQLite without choosing a library.

## Decision
- **pi-ai 1.5.0, pinned exactly** (1.5.1 and 1.5.2 were inside the 7-day release age, ADR-043).
  Its install scripts in `@google/genai` (prints "no-op") and `protobufjs` (a version warning) are
  reviewed and denied in `allowBuilds`.
- **Keys only from `secretRef`.** `createModels` gets an auth context with no environment variables
  and no files. A built-in provider must set `apiKey`; it is resolved just before each call and
  passed per request (ADR-007).
- **Providers from config.** A built-in pi-ai provider loads its own factory; an entry with `api`
  and `baseUrl` becomes a custom provider through `createProvider`. Every request gets the egress
  `fetch` (ADR-080, ADR-113).
- **Local** means a custom endpoint whose `baseUrl` host is `localhost`, a loopback, private, or
  this-machine address, or a name with no dot (a Compose service). A local-only role whose chain
  reaches any other model is a config error at start (ADR-011, ADR-019).
- **Accepted** means the stream emitted `start`. An unpinned role moves to the next model only when
  the provider never accepted the request; an accepted failure stops, since it may have cost
  tokens. The main role uses only its first model; its outage failover is the session's (ADR-019).
- **Refusals stop and are reported in every role** until OQ-93 maps refusal categories. This
  amends ADR-011 and ADR-085, which send a refusal in an unpinned role to the next model: without
  categories, an off-limits request would be passed on too. Refusals are detected from
  `rawStopReason` (`refusal`, `content_filter`, `SAFETY`, `PROHIBITED_CONTENT`), never as errors.
- **The usage log is SQLite through `node:sqlite`**, built into Node 26 (SQLite 3.54.1 with FTS5):
  one `usage` row per call with time, role, provider, model, tokens, cost, latency, and outcome.
  Later SQLite stores (ADR-023) use the same module.

## Alternatives rejected
- **`better-sqlite3`:** mature, but a native addon with an install script and a binary per platform.
- **Next model on every refusal, as ADR-011 is written:** passes off-limits requests on.
- **Mapping Anthropic's raw refusal categories now** through pi-ai's raw-event hook: a mapping chosen
  without data from real refusals.

## Consequences
- The Phase 0 exit criterion "in a child it moves to the next model" now reads "in a role that is
  not pinned it stops and is reported, until OQ-93".
- Custom endpoints get fixed limits (32k context, 4k output, text only) until `jaari llm eval`
  reads them (roadmap 1.9).
- A provider adapter that refuses the injected `fetch` fails before `start`, so an unpinned role
  moves on; `jaari doctor` naming such adapters (ADR-080) arrives with 0.12.
