# ADR-071: Capability packages: one package format for every pluggable part, a checked manifest, third-party packages in their own process, updates that notify

- **Status:** Accepted
- **Extended by:** [ADR-077](077-subscription-cli-engines.md), [ADR-084](084-package-manifest-location-and-channel-section.md), [ADR-096](096-per-process-secret-lifetime.md)
- **Date:** 2026-11-12

## Decision
**One package format for every pluggable part.** Capability executors, channels, browser
adapters (ADR-048), fetch rungs (ADR-049), egress providers (ADR-053), mailbox providers
(ADR-063), and vault providers (ADR-013) are npm packages. Each declares a `jaari` manifest with
a `kind` field and implements that kind's interface. One install, update, and trust pipeline
covers all of them. Skills stay `SKILL.md` files (ADR-060) and MCP servers stay MCP config
(ADR-034); each gets a generated manifest so the same rules apply.

**Manifest schema**, defined in `@jaari/capabilities` in Phase 0 and validated at load:

| Field | Meaning |
|---|---|
| `id`, `version`, `kind` | What the package is |
| `interfaceVersion`, `minJaari` | Which interface it implements; the oldest Jaari it supports |
| `provides` | Vocabulary names only (ADR-018); a package never adds a name, which takes an ADR and a Jaari release |
| `hosts`, `provider`, `platforms` | `daemon` or `node`; provider; OS and CPU |
| `permissions` | OS permissions, for example macOS screen recording or accessibility (ADR-057) |
| `sidecars` | Image digest, or binary SHA-256 and size, with an SBOM; no runtime self-update |
| `egress` | Hosts it needs; `@jaari/http` allows only those |
| `secrets` | `secretRef` names it needs (ADR-007) |
| `config`, `health` | Config schema; health check |

Policy reads capability flags from the manifest, never from package names. An unknown name or
kind fails closed.

**Sources.** Built-ins live in the monorepo and release in lockstep with Jaari (ADR-043).
Third-party packages come from npm with provenance (trusted publishing). A local path is for
development only, and `jaari doctor` warns about it. Every install is pinned by exact version and
integrity hash in `ops/capabilities.lock`.

**Install.** `jaari capability install <package>` or the panel (ADR-067) shows one confirm prompt
(ADR-035) summarising what the package provides, its permissions, sidecars, hosts it talks to,
and secrets. A new package starts in shadow mode (ADR-068). A missing OS permission is found by
the health check and shown in `jaari doctor` and the panel.

**Isolation.** Built-ins run in the daemon process. Third-party packages always run in their own
process with only what their manifest declares; container isolation follows in Phase 7.

**Updates.** Built-ins follow Jaari releases (ADR-056). Third-party updates notify and never
install automatically, and the 7-day minimum release age applies (ADR-043). An update that
changes `provides`, `permissions`, `egress`, or `secrets` shows the difference and asks again.

**Phasing.** Phase 0: the schema and the in-process loader for built-ins, with every executor
going through the daemon-node contract (ADR-015). Phase 4: third-party packages from npm, with
the reader role and sandbox. Phase 6: installing packages on nodes.

Borrowed: pinned native sidecars with SHA-256, size, an SBOM, and no runtime self-update, and
policy keyed on capability flags rather than package names, from OpenMausBot
(`third_party/cua-driver/`, `server/browser-engine-release.ts`; learning/09); unknown skills
failing closed from gajae-way `subsession/src/skills.ts` (design only).

## Alternatives rejected
A separate package format per adapter kind; manifests that can add vocabulary names; policy keyed
on package names; third-party packages in the daemon process; automatic third-party updates;
unpinned installs; git URLs as a package source.

## Amendments
- **ADR-077:** adds the `CliEngine` package kind.
- **ADR-084 (resolves OQ-85):** the manifest is the `jaari` key of `package.json`, read before
  any package code runs; kind-only fields go in a section named after the kind (`channel`).
- **ADR-096:** a third-party package's declared secrets live for its process lifetime under the
  ADR-096 conditions.

## Consequences
_TODO: fill in as implementation reveals them._
