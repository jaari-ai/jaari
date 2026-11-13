# ADR-060: Skills: SKILL.md playbooks in the memory repo, loaded on demand, third-party skills scanned and pinned, procedures offered as skills

- **Status:** Accepted
- **Extended by:** [ADR-071](071-capability-packages.md)
- **Date:** 2026-11-11

## Decision
**Format.** Agent Skills `SKILL.md`: frontmatter (`name`, `description`, optional `requires`
capabilities), a body, optional files. Limits: 64 KB per file, folder depth 3.

**Where skills live.** Built-ins in the Jaari repository, versioned like prompts (ADR-042). The
owner's skills and installed third-party skills in the memory repository under
`ops/skills/<name>/` (git history and rollback, ADR-026), with `ops/skills.lock` recording each
skill's source and SHA-256. `ops/rules` stays for rules, which are always loaded; skills are
procedures loaded when needed.

**Loading.** The Stable layer (ADR-024) holds only the index (name and description), so it changes
only on install or enable; the body is loaded on demand with `skill.load(name)`.

**Installing third-party skills.** `jaari skill add <url|path>`, or Jaari suggests one. The text is
scanned (base64 blobs, piped shell installs, invisible Unicode, instruction-override phrases); the
`reader` role summarises what it does and what it needs; it installs disabled, and the owner
enables it in one prompt showing the summary and scan results. It is pinned by hash: any change
disables it until approved again (as MCP, ADR-034). Third-party skills arrive once the reader role
exists (Phase 4).

**A skill is never a permission.** Its tool calls are still gated; bundled scripts run in the
sealed sandbox (ADR-036); it cannot override locked prompts (ADR-042) or grants. On a name clash
the built-in wins; the owner can disable a built-in to use their own.

**Procedural memory.** After Jaari completes a new multi-step task, or after the owner corrects how
it did one, it offers once to save the procedure as a skill. Never for one-off questions. The offer
is a diff the owner approves (ADR-042). When a saved skill later goes wrong and the owner corrects
it, Jaari proposes an edit to that skill.

**Exports.** `jaari skill export` scrubs secrets and owner data.

**Phasing.** Built-in and owner skills in Phase 2; third-party skills in Phase 4.

Borrowed: index in the prompt and body on demand, size and depth limits, and built-ins winning a
clash from open-instinct `server/src/skills.ts` and Pi `coding-agent/docs/skills.md`; the registry
idea from gajae-way `memory/registry.ts` (design only); install scanning and export scrubbing from
OpenMausBot (learning/09).

## Alternatives rejected
Skills loaded in full into every prompt (cache churn and context cost); skills as a permission
boundary; third-party skills enabled on install; unpinned skill text; saving procedures as skills
without approval; the owner's skill silently replacing a built-in.

## Amendments
- **ADR-071:** skills stay `SKILL.md` files and get a generated package manifest, so the same install and trust rules apply.

## Consequences
_TODO: fill in as implementation reveals them._
