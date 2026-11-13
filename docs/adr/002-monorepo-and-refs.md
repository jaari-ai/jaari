# ADR-002: pnpm TypeScript monorepo with read-only refs/

- **Status:** Accepted
- **Extended by:** [ADR-083](083-pinned-reference-commits.md)
- **Date:** 2026-11-05

## Decision
Single pnpm workspace (`packages/*`, `apps/*`). Reference repos live in `refs/`, excluded via `.git/info/exclude`, made read-only at the OS level, and denied to coding agents. ESLint, Vitest, and TSConfig use allowlists so `refs/` is never built, linted, or tested.

## Alternatives rejected
Git submodules (pollute history); vendoring references (licensing risk); denylists only (one missed glob pulls refs/ into the build).

## Amendments
- **ADR-083 (resolves OQ-84):** each reference is pinned to a full sha in `scripts/refs.sh`;
  `sync` re-applies the pins and only `scripts/refs.sh bump` moves one.

## Consequences
_TODO: fill in as implementation reveals them._
