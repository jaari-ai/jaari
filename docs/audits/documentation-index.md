# Documentation index

Written by the documentation audit of 2026-11-12. This file is a map: where each topic lives,
which file is the authority for it, and how current it is. It is a navigation aid. It is not
an authority; when it disagrees with an ADR or a design doc, that file wins. Update it when a
doc is added, moved, or changes role.

Status words: **current** (matches the accepted ADRs as of the audit), **current, with open
points** (matches, but an open question touches it), **historical** (a dated record; corrected
only with a pointer), **generated** (written by a script).

## Authority order

1. Accepted ADRs in `docs/adr/`, read with their `Extended by` and `Amendments` lines. A later
   ADR wins over an earlier one where it says so.
2. Subsystem design docs (`ARCHITECTURE.md`, `SECURITY_MODEL.md`, `LLM.md`, `WEB.md`,
   `MEMORY.md`, `PERSONA.md`, `INTEGRATIONS.md`, `THREAT_MODEL.md`): they summarise the ADRs
   and must agree with them.
3. Plan docs (`ROADMAP.md`, `ACTION_PLAN.md`, `STATE.md`, `OPEN_QUESTIONS.md`).
4. Guides, learning notes, and the two historical captures: context, never authority.
5. `refs/`: other projects, read-only. They never override a Jaari decision.

## Root files

| Path | Purpose | Status | Leans on |
|---|---|---|---|
| `README.md` | Overview, design table, docs list, contributor start, lineage | current | ADR-001 to 020, 030, 048, 049 |
| `AGENTS.md` | Rules for coding agents, layout, docs workflow, reference licences, architecture rules | current | ADR-002, 009, 014, 016, 071, 072, 075 |
| `CLAUDE.md` | Claude Code specifics; imports `AGENTS.md` | current | ADR-002 |
| `NOTICE`, `LICENSE` | Third-party notices (no derived files yet); MIT | current | ADR-014, 016 |
| `jaari.config.example.jsonc` | Example owner config | current, with gaps (no `channels`, `owner.phones`, `homeSites`, speech roles; budget figure; see report D-07) | ADR-017, 019, 046, 049, 053 |
| `pnpm-workspace.yaml`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts` | Allowlist placeholders for the build | placeholders; no root `package.json` | ADR-002 |
| `.github/workflows/release.yml`, `CODEOWNERS`, `dependabot.yml` | Tag-triggered PyPI release; workflow owners; action updates | exists, never run; no CI workflow | ADR-010, 043 |
| `python/` | PyPI name-holder package | does not match `docs/guides/namespaces.md` section 6.2 (report D-06) | ADR-010 |
| `scripts/refs.sh` | Clones, locks, and indexes `refs/` | current; pins each reference to a full sha; `bump` moves pins (ADR-083) | ADR-002 |
| `scripts/merge_docs.py` | Builds `JAARI_CONTEXT.md`; `--check` validates links, ADR tables, OQ ids and counts | current | none |
| `JAARI_CONTEXT.md` | Merged copy of the docs for AI discussions | generated, untracked; never edit | none |

## Plan and status

| Path | Purpose | Status |
|---|---|---|
| `docs/STATE.md` | Summary: what is decided, what is built, what is next, scheduled checks | current |
| `docs/ROADMAP.md` | Phases 0 to 8 and Later: items with IDs, needs, status, exit criteria, blocking questions | current |
| `docs/ACTION_PLAN.md` | Ordered next steps; a copy of the ADR table | current |
| `docs/OPEN_QUESTIONS.md` | 7 open (OQ-81 to OQ-91); 84 resolved with ADR links; original wording | current |

## Subsystem designs

| Path | Topic it is the home of | Status | Main ADRs |
|---|---|---|---|
| `docs/ARCHITECTURE.md` | Principles, v1 non-goals, package table, channel contract, identity binding, trust boundaries | current | 003, 005 to 008, 011, 015 to 018, 021, 022, 035, 044, 071, 075 |
| `docs/SECURITY_MODEL.md` | Approval gate, secrets and vault, capability vocabulary, approval card, Phase 0 floor, untrusted content, egress, owner hold, pause and limits, encryption, MCP, code execution | current | 006, 007, 013, 016, 018, 028, 031, 034, 036, 050, 072, 075, 079 |
| `docs/THREAT_MODEL.md` | Actor, attack, control, left-over table; "not protected against" list | current | 069 and the ADRs each row cites |
| `docs/LLM.md` | Routing layers, roles, local model sizing, presets | current | 011, 019, 037, 045, 046, 065, 066, 078, 085 |
| `docs/WEB.md` | Search, fetch ladder, browser placement, presets | current (repeats the egress pool that SECURITY_MODEL.md owns) | 012, 016, 017, 030, 048, 049, 053 |
| `docs/MEMORY.md` | Memory layout and lifecycle | current, with open points (OQ-87) | 003, 004, 023, 024, 026 to 029, 038, 047, 074 |
| `docs/PERSONA.md` | Dials, curiosity, interruption scoring, routine rules | current | 008, 031, 033, 064 |
| `docs/INTEGRATIONS.md` | Project identity assets; integrations summary | current, with open points (OQ-91) | 010, 039, 062, 063 |
| `docs/DEVELOPMENT.md` | `refs/` handling, commands, docs conventions, ADR template, threat-model rule | current | 002, 020, 069, 083 |

## Decisions

`docs/adr/README.md` is the index of the 96 ADRs (all Accepted). By topic:

| Topic | ADRs |
|---|---|
| Core, licence, process | 001, 002, 009, 010, 014, 043, 044, 083, 086 |
| Hosting, nodes, install | 015, 017, 030, 056, 057, 058, 082, 088, 094 |
| Channels, owner, panel | 021, 022, 035, 067, 070, 076 |
| Memory | 003, 004, 023, 024, 026, 029, 038, 047, 066, 074, 078, 093 |
| Persona and proactive work | 008, 033, 037, 042, 060, 061, 064, 089 |
| Gate, secrets, safety | 006, 007, 013, 016, 018, 031, 040, 050, 068, 069, 072, 075, 079, 081, 090, 092, 095, 096 |
| Models | 011, 019, 045, 046, 065, 077, 085 |
| Web, browser, egress | 005, 012, 048, 049, 051, 052, 053, 054, 055, 080 |
| Operations | 025, 027, 028, 032, 059, 087 |
| Extension points and integrations | 034, 036, 039, 062, 063, 071, 073, 084, 091 |
| Plan and evals | 020, 041 |

ADRs whose text is changed in part by a later ADR (read the `Amendments` section first):
001, 002, 005, 006, 007, 009, 011, 012, 013, 014, 015, 016, 017, 018, 019, 020, 021, 022, 023,
024, 025, 027, 028, 029, 030, 031, 032, 034, 035, 036, 038, 039, 046, 048, 049, 050, 051, 053,
055, 056, 057, 058, 060, 061, 062, 063, 064, 065, 066, 067, 071, 072, 074, 077, 078, 081. ADR-038's
title still says "sensitive files local-only"; ADR-078 replaced that rule.

## Guides, learning notes, history

| Path | Purpose | Status |
|---|---|---|
| `docs/guides/namespaces.md` | Owner runbook: secure npm and PyPI names, GitHub hardening, release | current; `python/` and private vulnerability reporting are follow-ups (report D-06, D-08) |
| `docs/guides/securing-your-install.md` | Owner-facing storage and encryption trade-offs | current; does not yet cover revocation, the panel passkey, or document routing |
| `docs/guides/channel-plugins.md` | Plugin author guide | current |
| `docs/learning/07-computer.md`, `08-egress-identity-and-takeover.md` | Studies of 2026-11-09 | historical, with a "since decided" pointer |
| `docs/learning/09-openmausbot.md` | OpenMausBot study at commit `b802268` | historical; basis of ADR-016 |
| `docs/learning/10-open-questions-review.md`, `11-pally.md` | Recommendations per question; Pally study | historical, with a "since decided" pointer; some items have no ADR position (report section 6) |
| `docs/learning/README.md` | Learning-log index and format | current |
| `docs/00-research.md`, `docs/01-merge-plan.md` | Research capture; original merge reasoning | historical; corrected by pointer only |
| `docs/audits/documentation-reconciliation.md` | Report of the 2026-11-12 audit, with the evidence ledger | dated record |

## Topics described in more than one file

| Topic | Home | Also described in |
|---|---|---|
| ADR table | `docs/adr/README.md` | `docs/ACTION_PLAN.md` (deliberate copy; the check keeps them equal) |
| Egress pool | `docs/SECURITY_MODEL.md` (Egress) | `docs/WEB.md`, `docs/ARCHITECTURE.md` (`@jaari/http` row) |
| Capability vocabulary | `docs/SECURITY_MODEL.md` (Capabilities) | ADR-018 lists the first names; later ADRs add names |
| Channel contract | `docs/ARCHITECTURE.md` (Channels) | `docs/guides/channel-plugins.md` (skeleton) |
| Per-item status | `docs/ROADMAP.md` | `docs/STATE.md` (summary only) |

## Reference repos (`refs/`, not part of the project docs)

Checked on 2026-11-12: each repo is at the commit in `refs/INDEX.md` and its licence file
matches the table in `AGENTS.md`. The roughly 12,800 files were not read in bulk; every `refs/` path
that the docs cite exists.

| Ref | Commit | Licence | Use |
|---|---|---|---|
| `open-instinct` | `2e5e71b` | MIT | Reuse with attribution |
| `openinstinct` | `213120c` | none found | Behavioural spec only |
| `gajae-way` | `34cbd15` | AGPL-3.0 | Design reference only |
| `pi` | `469d865` | MIT | Agent loop; reuse with attribution |
| `openmausbot` | `b802268` | Apache-2.0; `enterprise/` source-available | Design reference |

These commits are pinned in `scripts/refs.sh` (ADR-083). No binary documents exist in the
project tree.
