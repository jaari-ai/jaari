# ADR-043: Project process: one contact address, DCO without a CLA, lockstep releases, hardened supply chain

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**One public contact address: `hello@jaari.org`.** It is the address for security reports,
conduct reports, and general mail; the project publishes no other addresses. The private
`registry@jaari.org` recovery inbox for registry accounts (`docs/guides/namespaces.md`) is not
public and is unchanged.

**Security disclosure (`SECURITY.md`).**
- Report through GitHub private vulnerability reporting first, or by email to `hello@jaari.org`
  with "security" in the subject.
- Acknowledgement within 7 days; a fix or advisory aimed for within 90 days.
- In scope: the gate and digests; secret handling; reader-role or fencing bypass; sandbox escape
  (ADR-036); channel or panel authentication bypass; the update and release chain.
- Out of scope: attacks that need the owner's machine already compromised; a model saying
  something wrong without crossing the gate; third-party MCP servers and skills; configuration
  the owner chose (for example turning off local-only reading).
- During 0.x only the latest release receives fixes.

**Contributions (`CONTRIBUTING.md`).**
- DCO sign-off (`git commit -s`), enforced by a CI check; no CLA.
- Pull requests target `develop`; docs changes pass `python3 scripts/merge_docs.py --check`.
- Code from the references only under ADR-014 and ADR-016 (licences, `NOTICE`).
- AI-assisted contributions are allowed; the person signing off is responsible for them.

**Versioning and releases.**
- Lockstep: every `@jaari/*` package and the PyPI `jaari` name share one version, cut by one
  release script. No changesets.
- SemVer, `0.x` until v1; a minor bump may break during 0.x.
- Breaking config or memory-format changes ship with a migration (`jaari doctor --fix`) and a
  release-notes line.
- Releases only through `.github/workflows/release.yml` and its protected environment
  (ADR-010); `CHANGELOG.md` is generated from pull request titles by the release script.

**Supply chain.**
- Dependencies pinned exactly, with the lockfile committed.
- pnpm `minimumReleaseAge` of 7 days.
- Install scripts off, with an allowlist (`onlyBuiltDependencies`).
- Actions pinned to commit SHAs.
- gitleaks on every pull request.
- A licence check against the ADR-014 allowlist.
- npm provenance through trusted publishing.

**When.** `SECURITY.md`, `CONTRIBUTING.md`, the DCO check, gitleaks, the licence check, and the
pnpm settings land with the Phase 0 scaffolding.

Borrowed: the disclosure and contribution layout from Pi `SECURITY.md` and `CONTRIBUTING.md`;
gitleaks configuration from open-instinct `.gitleaks.toml`.

## Alternatives rejected
A CLA (friction for contributors; MIT does not need one); changesets (the packages ship
together, so independent versions add work without benefit); a separate `security@` address
(the owner wants one inbox); ranged dependency versions and unrestricted install scripts (the
main supply-chain attack paths).

## Consequences
_TODO: fill in as implementation reveals them._
