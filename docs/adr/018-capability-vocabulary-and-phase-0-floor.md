# ADR-018: Capability vocabulary, `@jaari/capabilities`, and the Phase 0 safety floor

- **Status:** Accepted
- **Extended by:** [ADR-034](034-mcp-servers.md), [ADR-039](039-personal-data.md)
- **Date:** 2026-11-10

## Decision
**1. One vocabulary.** The capability table in SECURITY_MODEL.md is the only list of names the model can ask for: `web.search`, `web.fetch`, `browser.read`, `browser.act`, `browser.submit`, `computer.use`, `shell`, `files.read`, `files.write`, `email.read`, `email.send`, `repo.write`, `publish`, `pay`, and `llm.escalate`. Each has a class: read, gated (effectful), or takeover. `pay` is reserved: no executor exists in v1 (OQ-19). A capability manifest's `provides` lists only these names. Host kind (`daemon` or `node`) and provider (`local-profile`, `remote-cdp`, `macos`, `xvfb`) are manifest fields, never part of a name. ADR-015's examples map as: `browser.local` is `browser.*` with provider `local-profile` on a node; `browser.remote` is `browser.*` with provider `remote-cdp`; `desktop.macos` is `computer.use` with provider `macos`; `files` is `files.read` and `files.write`. **2. Package.** `@jaari/capabilities` owns the manifest schema, the loader, and the daemon-node contract; `apps/node` is a host for it. Schema details, signing, and sidecars stay OQ-50. **3. Gate from day one.** `@jaari/gate` exposes its dispatch entry point in Phase 0 as a deny-all stub: every gated capability refuses, read-class ones run. No executor can be written around the gate, and Phase 3 replaces the stub with digests, approvals, and the audit chain. Third-party skills install disabled until the `reader` role exists. **4. Secrets from day one.** Phase 0 ships the `secretRef` resolver and an `os-keychain` provider (ADR-013 keeps secret zero there anyway). Bitwarden and 1Password land with the vault work. `env` and `file` providers are for development; `jaari doctor` warns when one is in use. Plaintext keys in config are never an interim. **5. Approval card.** The short code the owner types or taps is only a lookup of the digest; there is no amount or parameter tolerance (a different action is a different digest and needs a new approval). Default expiry is 15 minutes, overridable per capability, with 5 minutes the default for `email.send` and `publish`. Expiry and the short code extend ADR-006.

## Alternatives rejected
Per-host capability names (`browser.local` as a gate class: the policy would depend on where code runs); a gate that arrives in Phase 3 with executors written before it; plaintext keys in config until the vault exists; an approval tolerance ("within 5%"), which is a second, weaker binding.

## Amendments
- **ADR-034:** The vocabulary gains `mcp.read` (read) and `mcp.act` (gated) for MCP tools
  that match no other name; server and tool are manifest fields.
- **ADR-039:** The vocabulary gains `calendar.freebusy` and `calendar.read` (read) and
  `calendar.write` (gated).

## Consequences
_TODO: fill in as implementation reveals them._
