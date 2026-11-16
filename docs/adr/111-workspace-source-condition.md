# ADR-111: Workspace packages resolve to their TypeScript source through the `@jaari/source` export condition

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
Each workspace package's `exports` points at its build output in `dist/`, which is ignored by git
and never built by CI. `pnpm check` runs lint, typecheck, and tests without a build step. A probe
package that imported `@jaari/capabilities` failed both: TypeScript with "Cannot find module", and
Vitest with "Failed to resolve entry". The gate stub (roadmap 0.10) is the first package that
imports another, so every later package would hit this.

## Decision
- **One custom export condition.** Each workspace package lists `"@jaari/source": "./src/index.ts"`
  first in `exports["."]`, before `types` and `default`. A custom condition is a name in `exports`
  that a tool follows only when configured to; Node and npm consumers ignore it and use `dist/`.
- **Only the checking tools use it.** The root `tsconfig.json` (typecheck only, `noEmit`) sets
  `"customConditions": ["@jaari/source"]`. `vitest.config.ts` sets
  `ssr.resolve.conditions: ["@jaari/source", "import", "default"]`: Vitest's Node environment
  resolves through the SSR settings, and the list replaces the defaults, so `import` and `default`
  stay in it.
- **Package builds do not use it.** `tsconfig.base.json` and each package's `tsconfig.json` leave
  the condition out, so a package build reads its dependencies' `dist/` types and never pulls their
  source into its own `rootDir`.

## Alternatives rejected
- **Build every package before typecheck and tests:** slower `pnpm check`, an ordering to keep
  right in CI and locally, and stale `dist/` folders that hide errors.
- **TypeScript project references (`tsc -b`):** builds in dependency order, but adds a
  `references` list to every package to maintain, and Vitest still needs a build or a condition.
- **`exports` pointing at `src/` for everyone:** Node cannot run the published package, because
  the source imports `./x.js` files that exist only after a build.

## Consequences
- A new package copies the `exports` shape of `packages/capabilities/package.json`; DEVELOPMENT.md
  and AGENTS.md say so.
- When the daemon runs under plain Node (roadmap 0.5), it needs a build step or the same condition
  (`node --conditions=@jaari/source`); decided by ADR-115: build, then run `dist/`.
