# ADR-009: open-instinct as the shell, openinstinct as a spec

- **Status:** Accepted
- **Extended by:** [ADR-020](020-soft-phases-and-v1-scope.md), [ADR-037](037-voice.md)
- **Date:** 2026-11-05

## Decision
Policy and network shell come from `open-instinct`. Runtime semantics from `openinstinct` are re-implemented from behavior only; no code is copied because its license is ambiguous.

## Alternatives rejected
Fork either project wholesale; copy openinstinct code.

## Amendments
- **ADR-020:** "Policy and network shell" means capability tagging, principal resolution, grants, and the hosting shell. Trust tiers, peers, payments, and voice are deferred.
- **ADR-037:** voice notes and the `stt` and `tts` roles are in v1; only live calls stay deferred.

## Consequences
_TODO: fill in as implementation reveals them._
