# ADR-006: Approval gate with digest binding

- **Status:** Accepted
- **Extended by:** [ADR-016](016-openmausbot-hardening.md), [ADR-018](018-capability-vocabulary-and-phase-0-floor.md), [ADR-072](072-standing-grants.md), [ADR-092](092-pinned-jobs.md)
- **Date:** 2026-11-05

## Decision
Every external effect or payment is a proposed action serialized to canonical JSON and hashed (SHA-256). The owner approves that digest; the executor recomputes it and refuses on mismatch. Approvals are single-use and expire. Decisions go to `audit.jsonl`. No LLM is involved in approving.

## Alternatives rejected
Model self-approval; approval by free-text summary (summary can differ from action).

## Amendments
- **ADR-018:** Approvals expire after 15 minutes by default (5 for `email.send` and `publish`); the short code is only a lookup of the digest; no amount tolerance.
- **ADR-072:** standing grants are pre-approved exact-match keys checked by code; each action
  still has its own digest and audit row naming the grant. Resolves the single-use conflict.
- **ADR-016:** re-check at dispatch and a hash-chained audit log (points 1 and 3).
- **ADR-092:** a pinned job is the one approval that repeats, for one exact digest.

## Consequences
_TODO: fill in as implementation reveals them._
