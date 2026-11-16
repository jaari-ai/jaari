# ADR-105: Node 26 LTS is the minimum runtime; types and compile target follow it

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
The workspace (roadmap 0.1) required Node 22 or later, and ADR-056 named Node 22 for the npm
install. On 2026-11-16 Node 26 is the active LTS line (end of life April 2029), Node 24 is in
maintenance (April 2028), and Node 22 is in maintenance until April 2027, likely before v1. No
package exists yet, so moving the minimum costs nothing now.

The refs Jaari may reuse code from require Node `>=22.19.0` (`refs/pi` at `469d865`,
`refs/open-instinct` at `2e5e71b`) and use ES modules with `NodeNext`/`Node16` resolution, so
Node 26 stays inside their range.

## Decision
- **Runtime.** `engines.node` is `>=26`. Developers, CI, the npm install, and the release
  workflows use the Node 26 LTS line.
- **Types follow the minimum.** `@types/node` tracks the 26.x line, never a newer major than the
  minimum runtime, so the typecheck refuses APIs a supported Node lacks.
- **Compile target.** `target` is ES2024: the newest level both TypeScript 6.0 and Node 26 fully
  support. Raise it when the TypeScript pin moves (ADR-043 pins 6.0.x until typescript-eslint
  supports 7).
- **Reused code.** Code copied from `refs/pi` or `refs/open-instinct` (ADR-014) targets Node 22
  APIs; before copying, check it against the Node 23-26 removals.
- **Next move.** The minimum moves to the next even LTS line within six months of it entering
  active LTS, through a new ADR.

## Alternatives rejected
- Keep `>=22`: widest reach, but no newer APIs and an end of life before v1.
- `>=24`: already in maintenance; a second move would follow within a year.

## Amendments

## Consequences
- 2026-11-16: `@types/node` 26.6.6, `pnpm` 12.18.0 (the newest past the 7-day release age);
  `pnpm check` passes with an ES2024 + `node:util` probe.
