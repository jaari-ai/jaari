# ADR-084: The package manifest lives in `package.json`; channels add a `channel` section; a shared contract suite

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-071 gives every pluggable package one checked `jaari` manifest but does not say where it
lives. ARCHITECTURE.md defined a separate `ChannelManifest` as a property of the adapter object,
so the host learnt it only by running the plugin's code. The plugin guide cited a contract-test
harness that was not designed (OQ-85). gajae-way keeps its rule checks in a CI-only conformance
package (`refs/gajae-way/packages/conformance`, commit `34cbd15`).

## Decision
**Location.** Every ADR-071 package declares its manifest under the `jaari` key of its
`package.json`. It is static JSON: the host reads and checks it before it runs any package code,
and npm's integrity hash and provenance cover it.

**Kind sections.** Fields that only one kind needs go in a section named after the kind. A
channel's section is `channel`: `capabilities`, `identity`, `prompts`, `maxMessageChars`. `id`
and `version` come only from the shared part.

**Adapter.** `ChannelAdapter` has no `manifest` property. The host passes the checked manifest
in the `ChannelContext`. `ctx.secrets.get` accepts only the names in `secrets`; `@jaari/http`
allows only the hosts in `egress` (ADR-071).

**Contract suite.** `@jaari/channels/contract` exports a Vitest suite. A plugin runs it from its
own tests with its adapter and a fake of its transport. It checks: the manifest validates; start
and stop work, including on abort; `send` is idempotent on `idempotencyKey`, and an `ambiguous`
receipt is passed through; a fresh cursor anchors at the current position and replays nothing;
an undeclared secret name is refused; the plugin imports none of the forbidden packages. It
ships in Phase 0 with the CLI channel, the first adapter to pass it.

## Alternatives rejected
A separate `jaari.json` file (a second file that the integrity hash and tooling must also
cover); a manifest returned by plugin code (the host must run untrusted code before checking
it); a separate `ChannelManifest` object next to the package manifest (two sources for `id` and
`version`).

## Consequences
_TODO: fill in as implementation reveals them._
