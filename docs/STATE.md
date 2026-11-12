# Jaari: State

Last updated: 2026-11-12

Goal: a self-hosted personal agent like the commercial ones, run on a VPS, a remote server,
home hardware, or a laptop (ADR-017). Phases are a soft plan (ADR-020).

## Decided (84 ADRs, all Accepted)
The index is [adr/README.md](adr/README.md). By area:
- Identity, licence, process: `jaari.org`, GitHub org `jaari-ai`, MIT; one contact address,
  DCO, lockstep releases, hardened supply chain (ADR-010, 014, 043). npm and PyPI names are
  not yet secured; checklist in [guides/namespaces.md](guides/namespaces.md).
- Core design: Pi agent loop with one persistent main session, pnpm monorepo, open-instinct as
  shell and openinstinct as spec (ADR-001, 002, 009, 065).
- Hosting: one daemon on a VPS, remote server, home hardware, or laptop; capabilities installed
  where they run; nodes over a pinned link; the owner's choice of overlay; install, update,
  and laptop rules (ADR-015, 017, 030, 056, 057, 058).
- Channels and the owner: CLI, web panel, and Telegram in v1, email as input only; pairing and
  one active channel; typed prompts; the owner panel; one owner per Jaari (ADR-021, 022, 035,
  044, 067).
- Memory: git-backed Markdown, canonicalize and daily audit, structured records and FTS5
  search, context assembly, single writer, capture evidence, forgetting, files and photos
  (ADR-003, 004, 023, 024, 026, 029, 038, 047, 066, 074, 078).
- Persona and proactive work: two dials and a monitor, notifications and digests, routines,
  skills, onboarding, voice notes, prompt versioning, learning from outcomes (ADR-008, 033,
  037, 042, 060, 061, 064, 070).
- Safety: digest-bound approvals, `secretRef` secrets and vault providers, OpenMausBot
  hardening, one capability vocabulary with a deny-all gate from Phase 0, standing grants,
  shadow mode, kill switch and limits, outside lineage, threat model, no payments in v1
  (ADR-006, 007, 013, 016, 018, 031, 040, 050, 068, 069, 072, 075, 079, 081).
- Models: role and tier routing, a pinned main session, local-only defaults decided at init,
  local-model qualification, a monthly budget (ADR-011, 019, 045, 046).
- Web and computer use: search, fetch ladder, neutral browser surface with adapters,
  commitment classifier, browser worker, egress pool, signed-agent identity, takeover
  (ADR-005, 012, 048, 049, 051, 052, 053, 054, 055).
- Operations: job engine, backup and restore, encryption at rest, observability, degraded mode
  (ADR-025, 027, 028, 032, 059).
- Extension points: MCP servers, code execution, capability packages, inbound triggers,
  external control surface, subscription CLI engines, OAuth broker, mailbox, personal data
  (ADR-034, 036, 039, 062, 063, 071, 073, 076, 077).
- Plan: soft phases and v1 scope; behaviour evals (ADR-020, 041).

## Research and process
- Instinct, Pally, Muse, Grok Bot, ChatGPT Work, and the open-source clones: [00-research.md](00-research.md).
- Learning notes: [07 computer use](learning/07-computer.md), [08 egress and takeover](learning/08-egress-identity-and-takeover.md), [09 OpenMausBot](learning/09-openmausbot.md),
  [10 open questions review](learning/10-open-questions-review.md) and [11 Pally](learning/11-pally.md)
  (their recommendations fed ADR-021 to ADR-078; some were changed or rejected by the ADR).
- Docs conflict audit (2026-11-10): ten conflicts recorded, accepted, and folded into ADR-017
  to ADR-020.
- Documentation audit (2026-11-12): docs, ADR links, open questions, and the roadmap
  reconciled; 25 new open questions recorded. Report:
  [audits/documentation-reconciliation.md](audits/documentation-reconciliation.md); map of the
  docs: [audits/documentation-index.md](audits/documentation-index.md).
- Docs are hand-maintained Markdown (conventions in DEVELOPMENT.md); `scripts/merge_docs.py`
  builds one context file for AI discussions; reference tooling is `scripts/refs.sh`.

## Built
Nothing runs yet. No package exists under `packages/` or `apps/`.
- Root config files exist as allowlist placeholders (`pnpm-workspace.yaml`, `tsconfig*.json`,
  `eslint.config.js`, `vitest.config.ts`). There is no root `package.json`; the TypeScript
  ESLint parser, an output directory, and ignore rules come with the Phase 0 scaffolding.
- `.github/workflows/release.yml` and the `python/` name-holder package exist. `python/` does
  not match [guides/namespaces.md](guides/namespaces.md) section 6.2 (no `README.md`, no
  `LICENSE`, module at `src/__init__.py`), so the release build is expected to fail until it
  is fixed. No CI workflow exists.
- [THREAT_MODEL.md](THREAT_MODEL.md) is written (ADR-069).

## Now
Phase 0: Foundation, not started. Per-item status, needs, and exit criteria are in
[ROADMAP.md](ROADMAP.md); the ordered next steps are in [ACTION_PLAN.md](ACTION_PLAN.md).
Two open questions should be decided before Phase 0 work: OQ-86, OQ-90.

## Scheduled checks that ADRs defer
- Phase 1: measure the candidate local models (ADR-045).
- Start of Phase 3: check 1Password plan eligibility and limits on a real account (ADR-050).
- Phase 5: verify each provider's OAuth redirect and device-flow rules (ADR-062).
- Phase 6: review the task-scoped origin rule from logs (ADR-052).
- When each CLI engine adapter is built: check and record the provider's terms (ADR-077).
- On an outside trigger: Web Bot Auth registration for individuals (ADR-054); `pi-durable`
  leaving Experimental (ADR-025, ADR-065).

## Open questions
19 open. See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
