# ADR-115: The daemon runs from built `dist/` files under plain Node; the smoke test and a CI start check prove both paths

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
ADR-111 left one question for roadmap 0.5: workspace packages import `./x.js` files that exist only
after a build, so the daemon cannot run its TypeScript source under plain Node. Node 26 strips types
at load time, but it does not map `./x.js` to `./x.ts`.

## Decision
- **Build, then run `dist/`.** `pnpm -r build` compiles every package with `tsc`, and the daemon runs as
  `node apps/daemon/dist/main.js`. Workspace dependencies resolve through their `default` export to
  their own `dist/`. An installed Jaari runs the same way (ADR-056).
- **Tests stay build-free.** Typecheck and Vitest keep reading source through the `@jaari/source`
  condition (ADR-111). The tier-1 smoke test (ADR-041) boots `startDaemon` from source on pi-ai's
  scripted provider.
- **CI also starts the built daemon.** After the tests, CI builds every package and runs
  `jaari-daemon --check` on `apps/daemon/smoke.config.json`: every part starts and stops, with no
  network call. This catches what the source-only tests cannot: a missing `exports` entry, a
  `.ts`-only import, or a package that does not build.

## Alternatives rejected
- **Run the source with Node's type stripping:** every relative import in every package would change
  to `.ts`, plus `rewriteRelativeImportExtensions` for the build; development would run a different
  file set than an install.
- **The `tsx` loader:** a new dependency in the supply chain (ADR-043) for what a build already does,
  and development would again differ from an install.

## Consequences
- A local run needs `pnpm -r build` first; a stale `dist/` can hide a change until the next build.
- `--check` is the seed of the daemon's part of `jaari doctor` (roadmap 0.12).
