# Jaari: State

Last updated: 2026-11-10

Goal: a self-hosted personal agent like the commercial ones, run on a VPS, a remote server,
home hardware, or a laptop (ADR-017). Phases are a soft plan (ADR-020).

## Decided (41 ADRs)
- Identity and publishing: `jaari.org`, GitHub org `jaari-ai`, MIT licence (ADR-010, 014). npm
  and PyPI names are not yet secured; checklist in [guides/namespaces.md](guides/namespaces.md).
- Core design: Pi agent loop, pnpm monorepo, git-backed Markdown memory, canonicalize and
  audit, local-profile browser with takeover, digest-bound approvals, `secretRef` secrets,
  persona dials, open-instinct as shell and openinstinct as spec (ADR-001 to 009).
- Models and web: role/tier routing with a pinned main session, outage failover, and
  local-only defaults decided at init; web search, fetch ladder, and browser (ADR-011, 012,
  019). Vault providers are Proposed until OQ-29 is verified (ADR-013).
- Hosting: one daemon on a VPS, remote server, home hardware, or laptop; capabilities
  installed where they run; placement rule and egress pool with owner exit nodes; the
  overlay network is the owner's choice (ADR-030)
  (ADR-015, 017).
- Safety: OpenMausBot hardening (dispatch re-check, chained audit, resolve-check-dial egress,
  secret scrubbing, owner hold; ADR-016); one capability vocabulary, deny-all gate and
  keychain secrets from Phase 0, approval expiry (ADR-018).
- Plan: soft phases, corrected blockers, deferred scope (ADR-020).

## Research and process
- Instinct, Pally, Muse, Grok Bot, ChatGPT Work, and the open-source clones: [00-research.md](00-research.md).
- Learning notes: [07 computer use](learning/07-computer.md), [08 egress and takeover](learning/08-egress-identity-and-takeover.md), [09 OpenMausBot](learning/09-openmausbot.md),
  [10 open questions review](learning/10-open-questions-review.md) (a proposed recommendation
  per open question from the references; not yet accepted),
  [11 Pally](learning/11-pally.md) (second commercial reference; borrow list and alternatives,
  not yet accepted).
- Docs conflict audit (2026-11-10): ten conflicts recorded, accepted, and folded into ADR-017
  to ADR-020; the docs were realigned to them.
- Docs are hand-maintained Markdown (conventions in DEVELOPMENT.md); `scripts/merge_docs.py`
  builds one context file for AI discussions; reference tooling is `scripts/refs.sh`; root
  build config is scaffolded; no packages exist yet.

## Now
Phase 0: Foundation. Nothing is built; the first items are in [ACTION_PLAN.md](ACTION_PLAN.md).

## Open questions
37 open. See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
