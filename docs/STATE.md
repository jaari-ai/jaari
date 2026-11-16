# Jaari: State

Last updated: 2026-11-16

Goal: a self-hosted personal agent like the commercial ones, run on a VPS, a remote server,
home hardware, or a laptop (ADR-017). Phases are a soft plan (ADR-020).

## Decided (113 ADRs, all Accepted)
The index is [adr/README.md](adr/README.md). By area:
- Identity, licence, process: `jaari.org`, GitHub org `jaari-ai`, MIT; one contact address,
  DCO, lockstep releases, hardened supply chain; registry accounts on `hello@jaari.org`
  (ADR-010, 014, 043, 106, 107); Dependabot weekly updates into `develop`. npm `jaari`, the `@jaari` org, and PyPI `jaari` are
  secured (0.0.0, roadmap 0.4); checklist in [guides/namespaces.md](guides/namespaces.md).
- Core design: Pi agent loop with one persistent main session, pnpm monorepo, open-instinct as
  shell and openinstinct as spec; package homes; one manifest per package in `package.json`;
  reference repos pinned; Node 26 LTS minimum; the manifest validated with TypeBox and checked
  before any package code runs; the daemon–node contract as JSON messages; workspace packages read as source
  through the `@jaari/source` condition (ADR-001, 002, 009, 065, 083, 084, 086, 105, 108, 109, 110,
  111).
- Hosting: one daemon on a VPS, remote server, home hardware, or laptop; capabilities installed
  where they run; nodes over a pinned link; the owner's choice of overlay; install, update,
  and laptop rules; the overlay binding in Phase 2 and the node link in Phase 6; the sandbox
  under Compose (ADR-015, 017, 030, 056, 057, 058, 082, 088, 094).
- Channels and the owner: CLI, web panel, and Telegram in v1, email as input only; pairing and
  one active channel; typed prompts; the owner panel; one owner per Jaari (ADR-021, 022, 035,
  044, 067); a paired MCP client is not a channel (ADR-101).
- Memory: git-backed Markdown, canonicalize and daily audit, structured records and FTS5
  search, context assembly, single writer, capture evidence, forgetting, files and photos,
  sensitive content following routing, binary files outside git (ADR-003, 004, 023, 024, 026,
  029, 038, 047, 066, 074, 078, 093, 100).
- Persona and proactive work: two dials and a monitor, notifications and digests, routines,
  skills, onboarding, voice notes, prompt versioning, learning from outcomes (ADR-008, 033,
  037, 042, 060, 061, 064, 070, 089).
- Safety: digest-bound approvals, `secretRef` secrets and vault providers, OpenMausBot
  hardening, one capability vocabulary with a deny-all gate from Phase 0, standing grants,
  shadow mode, kill switch and limits, outside lineage, threat model, no payments in v1,
  prompt-injection defences (ADR-006, 007, 013, 016, 018, 031, 040, 050, 068, 069, 072, 075,
  079, 081, 090, 092, 095, 096, 104, 112).
- Models: role and tier routing, a pinned main session, local-only defaults decided at init,
  local-model qualification, a monthly budget, refusals in the pinned session (ADR-011, 019,
  045, 046, 085).
- Web and computer use: search, fetch ladder, neutral browser surface with adapters,
  commitment classifier, browser worker, egress pool, signed-agent identity, takeover, egress
  core in Phase 0 on Node's `fetch` and undici, owner accounts on any host with home sites via the owner exit, the web
  budget (ADR-005, 012, 048, 049, 051, 052, 053, 054, 055, 080, 098, 099, 102, 113).
- Operations: job engine, backup and restore, encryption at rest, observability, degraded mode
  (ADR-025, 027, 028, 032, 059); safety pieces ship with what they protect; retention of
  receipts and the action log (ADR-087, 097).
- Extension points: MCP servers, code execution, capability packages, inbound triggers,
  external control surface, subscription CLI engines, OAuth broker, mailbox, personal data
  (ADR-034, 036, 039, 062, 063, 071, 073, 076, 077); engine runs; no GitHub, npm, or PyPI
  integrations (ADR-091, 103).
- Plan: soft phases and v1 scope; behaviour evals (ADR-020, 041).

## Research and process
- Instinct, Pally, Muse, Grok Bot, ChatGPT Work, and the open-source clones: [00-research.md](00-research.md).
- Learning notes: [07 computer use](learning/07-computer.md), [08 egress and takeover](learning/08-egress-identity-and-takeover.md), [09 OpenMausBot](learning/09-openmausbot.md),
  [10 open questions review](learning/10-open-questions-review.md), [11 Pally](learning/11-pally.md),
  [12 browser placement](learning/12-browser-placement.md), and [13 prompt injection](learning/13-prompt-injection-and-system-prompts.md) (their recommendations fed ADR-021
  to ADR-104; some were changed or rejected by the ADR).
- Docs conflict audit (2026-11-10): ten conflicts recorded, accepted, and folded into ADR-017
  to ADR-020.
- Documentation audit (2026-11-12): docs, ADR links, open questions, and the roadmap
  reconciled; 25 new open questions recorded and decided on 2026-11-12 and 2026-11-13
  (ADR-079 to ADR-103). Report:
  [audits/documentation-reconciliation.md](audits/documentation-reconciliation.md); map of the
  docs: [audits/documentation-index.md](audits/documentation-index.md).
- Docs are hand-maintained Markdown (conventions in DEVELOPMENT.md); `scripts/merge_docs.py`
  builds one context file for AI discussions; reference tooling is `scripts/refs.sh`.

## Built
Nothing runs yet. No app exists under `apps/`.
- `@jaari/capabilities` (0.9, delivered 2026-11-16): the 29 capability names with their
  classes; the `jaari` manifest checked with TypeBox, closed to unknown names, kinds, and fields
  (ADR-108); the built-in loader, which checks every
  manifest before it imports any package and refuses start on any failure (ADR-109); and the
  daemon–node contract with an in-process host that passes on only declared secrets and scrubs
  their values from every result (ADR-110, ADR-016).
  Other workspace packages import it through the `@jaari/source` condition (ADR-111). 
- `@jaari/gate` (0.10, delivered 2026-11-16): the deny-all stub. `createGate` builds the
  in-process host and keeps it; read-class capabilities run, every other class is refused before
  the executor starts. It decides on a checked copy of the request and passes on that same copy.
  A lint rule refuses `createInProcessHost` outside the gate (ADR-018).
- `@jaari/secrets` (0.11, delivered 2026-11-16): `parseRef` and `resolveRef` for bare
  `secretRef:<name>` handles (names cannot leave a directory; vault handles wait for 3.3), the
  `os-keychain` provider through `@napi-rs/keyring`, read only and loaded on first use (ADR-112),
  the `host-credential` provider with its owner-only and outside-the-data-directory checks
  (ADR-079), and `scrub` of exact values and their common encodings (ADR-016). 
- `@jaari/http` core (0.15, delivered 2026-11-16): the address-class table (metadata, loopback,
  link-local, reserved, this-machine, private, public; IPv4 inside IPv6 forms unwrapped), the
  owner's allow list (addresses, ranges, or `name:port` for Compose services) and the daemon's own ports, and `createEgress(policy).fetch`: Node's `fetch`
  with an undici `Agent` whose connector resolves, checks, and dials only a checked address
  (ADR-113). A lint rule, checked by a test, refuses other network clients (ADR-080). Next: 0.7,
  `@jaari/llm`, then 0.5, the daemon, which also decides how the daemon runs under plain Node
  (ADR-111).
- Monorepo scaffolding (0.1, 2026-11-16): root `package.json` and `pnpm-lock.yaml`, pnpm
  supply-chain settings in `pnpm-workspace.yaml` (exact pins, 7-day release age, install
  scripts off with the `allowBuilds` allowlist), and allowlisted ESLint (with the TypeScript
  parser), TypeScript, and Vitest config. `pnpm check` runs lint, typecheck, and tests. Each
  package sets its own output directory (`dist/`, ignored by git).
  Runtime moved to Node 26 LTS (ADR-105): `engines` `>=26`, `@types/node` 26.6.6, target
  ES2024, pnpm 12.18.0; other dev tools are already at the newest version past the 7-day age.
- `.github/workflows/release.yml` and the `python/` name-holder package exist. `python/`
  matches [guides/namespaces.md](guides/namespaces.md) section 6.2 and builds a wheel and an
  sdist locally (checked 2026-11-13); the release workflow published PyPI `jaari` 0.0.0
  (2026-11-16, roadmap 0.4).
- CI (0.2, 2026-11-16): `.github/workflows/ci.yml` runs lint, typecheck, tests, the licence
  check (`scripts/check-licenses.mjs`), and `merge_docs.py --check` on every pull request,
  plus a DCO sign-off check and a gitleaks history scan. The tier-1 smoke test comes with the
  daemon in 0.5 (ADR-041).
- [THREAT_MODEL.md](THREAT_MODEL.md) is written (ADR-069).
- Process files (0.3, 2026-11-16): `SECURITY.md` (private reporting, 7-day acknowledgement,
  scope) and `CONTRIBUTING.md` (pull requests to `develop`, DCO, reference code, AI use), as
  set in ADR-043.

## Now
Phase 0: Foundation, in progress (0.1 to 0.4 delivered). Per-item status, needs, and exit criteria are in
[ROADMAP.md](ROADMAP.md); the ordered next steps are in [ACTION_PLAN.md](ACTION_PLAN.md).
No open question blocks Phase 0.

## Scheduled checks that ADRs defer
- Phase 1: measure the candidate local models (ADR-045).
- Start of Phase 3: check 1Password plan eligibility and limits on a real account (ADR-050).
- Phase 5: verify each provider's OAuth redirect and device-flow rules (ADR-062).
- Phase 6: review the task-scoped origin rule from the browser action log (ADR-052, ADR-099).
- When each CLI engine adapter is built: check and record the provider's terms (ADR-077).
- On an outside trigger: Web Bot Auth registration for individuals (ADR-054); `pi-durable`
  leaving Experimental (ADR-025, ADR-065).

## Open questions
1 open. OQ-92 (package platforms) blocks Phase 6. See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
