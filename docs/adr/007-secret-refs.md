# ADR-007: Secrets are referenced, never shown to the model

- **Status:** Accepted
- **Extended by:** [ADR-016](016-openmausbot-hardening.md), [ADR-096](096-per-process-secret-lifetime.md)
- **Date:** 2026-11-05

## Decision
Config and tools carry `secretRef:<name>` handles. Only executors resolve them, just before the call. Secrets never enter prompts, logs, or memory.

## Alternatives rejected
Env vars passed to tools the model controls; secrets in the prompt.

## Amendments
- **ADR-016:** secret hygiene (point 6): resolved values are scrubbed by exact value and credentials are named by typed target ids.
- **ADR-096 (resolves OQ-80):** a separate long-running process may hold its declared secrets
  while it runs, under the ADR-096 conditions; in-process executors keep the per-call rule.

## Consequences
_TODO: fill in as implementation reveals them._
