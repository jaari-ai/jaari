# ADR-042: Prompt versioning: versioned prompt files, locked safety prompts, a per-turn fingerprint, propose-and-approve persona edits

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Two kinds of prompt.**
- *Built-in prompts* ship with Jaari: the system prompt, role prompts (reader, canonicalize,
  curiosity, and the others in LLM.md), and tool descriptions. They are files in the repository
  (`packages/*/prompts/*.md`), each with a version line, and change with releases.
- *The owner's persona and rules* (`ops/persona.md`, `ops/rules/`) live in the memory
  repository and are versioned by memory git (ADR-026); nothing extra is needed.

**Overrides, with a locked core.** The owner may override a built-in prompt by placing a file at
`ops/prompts/<name>.md` in the memory repository. The safety and system prompts are locked and
cannot be overridden or edited from memory: the core system prompt's safety section, the
`reader` role prompt, the untrusted-content fencing, the approval and prompt wording (ADR-035),
and the capability and tool descriptions. A locked prompt changes only with a Jaari release. An
override file for a locked prompt is refused at load with a line in `jaari doctor`.

**Tracing.** Each turn logs a prompt fingerprint in the event and usage logs (ADR-032): the
SHA-256 of the assembled Stable layer (ADR-024) plus the hash and version of every prompt file in
it. The audit row of every effectful action carries the same fingerprint, so any action can be
traced to the exact prompt in force.

**Rollback.** `jaari prompt history <name>` and `jaari prompt revert <name> <version>` cover
the persona, rules, and overrides through the single memory writer (ADR-026). `jaari prompt
--layers` shows what is in force and its versions.

**Upgrades.** Release notes show changes to built-in prompts. When the owner has overridden a
prompt whose built-in changed, the override is kept and Jaari says so once, shows the change, and
offers to merge.

**Jaari's own edits are proposals.** Jaari may propose changes to its persona or rules (for
example after learning a preference); each arrives as a diff for the owner to approve (ADR-035
prompt) and is never applied silently. Learned settings that are data rather than prompt text
(ADR-033 urgency) stay visible and reversible in the panel.

**Testing.** A test keeps the tool list and Stable layer byte-identical across a session's turns
so the prompt cache is not broken by accident (OQ-44). Prompt changes can be compared on
recorded turns with `jaari replay` (ADR-041) before they apply.

Borrowed: per-run hashes of the prompt files in use from openinstinct `persona/soul.ts`
(behaviour only); Pi's transcript recording the prompt in force at each turn.

## Alternatives rejected
Prompts compiled into code without a version (changes cannot be traced); overrides for every
prompt including the safety core (a memory edit or an injected write could weaken the reader
role or fencing); Jaari applying edits to its own persona or rules without approval; a separate
prompt store outside memory git (two histories to reconcile).

## Consequences
_TODO: fill in as implementation reveals them._
