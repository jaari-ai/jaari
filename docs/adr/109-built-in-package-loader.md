# ADR-109: The built-in loader checks every manifest first; `health` is a method; `config` is inline JSON Schema

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
ADR-108 left the manifest fields `config` and `health` for the loader (roadmap 0.9). The kind
interfaces already have a health method (`ChannelAdapter.health()` in ARCHITECTURE.md,
`VaultProvider` `health` in ADR-013), and `jaari doctor` collects those results (ADR-032,
ADR-086). The loader must check a manifest before any package code runs (ADR-084).

## Decision
- **`health` is not a manifest field.** Each kind's interface has a health method; `jaari doctor`
  and the panel call it. A manifest with a `health` field fails closed.
- **`config` is an inline JSON Schema** for the package's part of the owner config, with
  `"type": "object"` at the top. It is static and covered by npm's integrity hash, so the host can
  check the owner's config without running package code. The config loader (roadmap 0.6) checks
  values against it.
- **Loader.** `loadBuiltins(names, resolve)` in `@jaari/capabilities`:
  1. finds each package's root `package.json` with Node's `module.findPackageJSON`, which runs no
     package code;
  2. checks its `jaari` manifest (ADR-108), that `jaari.version` equals the package's `version`,
     and that no two packages share an `id`;
  3. only when every package passes, imports each one by the URL that `resolve` returns.
  `resolve` is the caller's `(s) => import.meta.resolve(s)`, so names resolve from the caller, not
  from `@jaari/capabilities`. The check and the import both use it, so they cannot reach two
  different copies of a package.
- **Any failure refuses start.** Built-ins release in lockstep with Jaari (ADR-043), so a bad
  built-in manifest is a broken release. The loader reports every problem at once and imports
  nothing.

## Alternatives rejected
- **`health` as static settings** (interval, timeout): nothing uses them yet, and the method
  already does the check.
- **`config` as a path to a schema file:** a second file for the host to find and trust.
- **Skip a failing built-in and load the rest** (ADR-059 "hold only the broken part"): kinder,
  but it hides a broken release. Third-party packages (Phase 4) may need this; decide then.

## Consequences
- `module.findPackageJSON` is "Stability 1.1, Active development" in Node 26. Node 26 throws
  `ERR_MODULE_NOT_FOUND` for a missing bare name, although the docs say it returns `undefined`;
  the loader handles both.
- `import.meta.resolve` follows a package's `exports` but does not check that the file exists, so
  the loader checks the entry file in the same pass as the manifest, before any import.
- A package whose import throws is reported by name (`<name>: import failed: <message>`) in the same
  `PackageLoadError`. Its top-level code, and that of the packages imported with it, has run by
  then; the daemon still refuses to start.
- Roadmap 0.6 (2026-11-17): the config loader shipped without the check of a package's own
  section, because no package declares a `config` schema yet; the check arrives with the first
  one (roadmap 2.8, ADR-118).
