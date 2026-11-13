# ADR-001: Agent loop built on Pi

- **Status:** Accepted
- **Extended by:** [ADR-077](077-subscription-cli-engines.md)
- **Date:** 2026-11-05

## Decision
`@jaari/core` runs its agent loop on Pi; `@jaari/llm` wraps `@earendil-works/pi-ai` (the old `@mariozechner/pi-ai` package is deprecated). Pi supplies multi-provider access, OpenAI-compatible local servers, mid-session model handoff (best-effort), and per-call token/cost accounting.

## Alternatives rejected
Own loop from scratch (slow, re-solves provider quirks); heavyweight agent frameworks (own the loop, hard to gate per action).

## Amendments
- **ADR-077:** sandboxed children may run on a subscription CLI engine with its own loop; the main session stays on Pi.

## Consequences
_TODO: fill in as implementation reveals them._
