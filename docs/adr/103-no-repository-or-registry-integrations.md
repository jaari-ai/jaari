# ADR-103: No GitHub, npm, or PyPI integrations; `repo.write` and `publish` are reserved

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
INTEGRATIONS.md and the roadmap (item 5.1) listed agent-facing GitHub, npm, and PyPI
integrations behind the gated `repo.write` and `publish` capabilities, with no ADR on what Jaari
may push or publish (OQ-91). The owner decided there is no use case for them.

## Decision
**Not a feature.** Jaari has no agent-facing GitHub, npm, or PyPI integration in v1. Item 5.1 is
removed.

**Reserved names.** `repo.write` and `publish` stay in the vocabulary as reserved, like `pay`
(ADR-040): no executor exists, a request for them fails closed, and they stay never grantable
(ADR-072).

**Coding work.** A subscription CLI engine's result is applied to its workspace with
`files.write` (ADR-077); pushing it anywhere is the owner's own act.

**Unchanged.** The project's own identity and release process (ADR-010, ADR-043); email
(ADR-021, ADR-063); browser commitment classes that include posting on a website (ADR-051).

## Alternatives rejected
Designing push and publish rules for a feature with no use case.

## Consequences
_TODO: fill in as implementation reveals them._
