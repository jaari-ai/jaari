# ADR-108: The package manifest is validated with TypeBox; kind names and capability classes

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
ADR-071 lists the fields of the `jaari` manifest and ADR-084 puts it in `package.json`, but
neither picks how the manifest is checked at runtime, the exact strings for `kind`, or the shape
of every field. Roadmap 0.9 needs all three. A manifest read from disk is untrusted input, so the
check must be a runtime validator, not only a TypeScript type.

## Decision
- **Validator.** `@jaari/capabilities` defines the manifest schema with TypeBox (`typebox`, MIT).
  The schema is JSON Schema, and the TypeScript type is derived from it, so the two cannot drift.
  Pi already uses TypeBox for its tool schemas (ADR-001), so Jaari has one schema style.
  `parseManifest()` returns `{ ok, manifest }` or `{ ok: false, errors }` and never throws.
- **Closed objects.** Every object in the schema refuses unknown fields. A misspelt or unknown
  field fails closed, as unknown names and kinds do (ADR-071).
- **Kind names.** `capability`, `channel`, `browser-adapter`, `fetch-rung`, `egress-provider`,
  `mailbox-provider`, `vault-provider`, and `cli-engine` (ADR-071, ADR-077). A new kind takes an
  ADR.
- **Kind sections.** A kind's section is required for that kind and refused for every other
  (ADR-084). Only `channel` has a section today.
- **Capability classes.** The code uses the classes of the SECURITY_MODEL.md table: `read`,
  `gated`, `policy` (`llm.escalate`), `reserved` (`publish`, `repo.write`, `pay`), and
  `takeover`. The vocabulary lives in `packages/capabilities/src/vocabulary.ts`; it and the table
  change together, and a test fails when their names or classes differ.
- **Field shapes.** `egress` entries are exact lowercase hostnames, with no scheme, port, IP
  literal, or wildcard. `secrets` are dotted lowercase names. A sidecar is either an image pinned
  by `@sha256:` digest or a binary with its SHA-256 and size, and each has an SBOM path.
- **Deferred.** The ADR-071 fields `config` and `health` are not in the schema yet. They are added
  with the loader (roadmap 0.9), when the first built-in package defines how they run. Until then
  a manifest that has them fails closed.

## Alternatives rejected
- **Zod 4.** Its API and errors are friendlier, but it would be a second schema style next to Pi's
  TypeBox, and JSON Schema is an export from it, not its native form.
- **Hand-written checks.** No dependency, but more code at a trust boundary, and the type can
  drift from the checks.
- **`kind` as free text.** A typo would load as an unknown kind; ADR-071 requires fail closed.

## Consequences
- TypeBox's `Compile` generates validator code with `new Function`. It runs only on our own
  schema, never on manifest data.
