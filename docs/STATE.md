# Jaari: State

Last updated: 2026-11-21

Goal: a self-hosted personal agent like the commercial ones, run on a VPS, a remote server,
home hardware, or a laptop (ADR-017). Phases are a soft plan (ADR-020).

## Decided (127 ADRs, all Accepted)
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
  under Compose (ADR-015, 017, 030, 056, 057, 058, 082, 088, 094). The daemon runs on Linux,
  macOS, and Windows; Windows (on request) as a per-user scheduled task with a named pipe and
  Credential Manager (ADR-125). The update is tested from local builds, not releases (ADR-126). Under Docker the daemon has a health
  check and starts with `up --wait` (ADR-127). Docker is the main install on every system and the checks run
  on local Docker; a real host (launchd, systemd, Windows) is optional until the owner confirms it, tracked in
  [HOSTS.md](HOSTS.md) (ADR-128).
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
  079, 081, 090, 092, 095, 096, 104, 112, 120).
- Models: role and tier routing, a pinned main session, local-only defaults decided at init,
  local-model qualification, a monthly budget, refusals in the pinned session; pi-ai 1.5.2 with keys
  only from `secretRef` and the usage log in `node:sqlite` (ADR-011, 019, 045, 046, 085, 114).
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
  to ADR-104; some were changed or rejected by the ADR); [14 egress core](learning/14-egress-core.md) and
  [15 pi-ai](learning/15-pi-ai.md) were written while building 0.15 and 0.7 (ADR-113, ADR-114);
  [16 pi-agent-core](learning/16-pi-agent-core.md) while building 0.5; [17 owner commands](learning/17-owner-commands.md)
  for ADR-116; [18 owner replies](learning/18-owner-replies.md) for ADR-117.
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
The owner can talk to the daemon through `jaari chat` on its local socket (0.8).
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
  (ADR-113). A lint rule, checked by a test, refuses other network clients (ADR-080). 
- `@jaari/llm` (0.7, delivered 2026-11-16): on pi-ai 1.5.0, 1.5.2 since 2026-11-19 (ADR-114). The `llm` config section checked with
  TypeBox (local-only roles that reach an API fail at start); providers from config with keys only
  from `secretRef`; role chains with the main role pinned; a move down the chain only when the
  provider never accepted the request; refusals read from the raw stop reason and, until OQ-93,
  stopped and reported; the usage log in SQLite through `node:sqlite` (ADR-114). The egress core now
  tries each checked address in turn.
- `@jaari/core` (first half of 0.5, 2026-11-16): the persistent main session on pi-agent-core 1.5.0, 1.5.2 since
  2026-11-19.
  The transcript and the pause flag in SQLite; one serial queue; steering; "pause", "stop now", and
  "resume" handled by code; the step limit, the stall guard, and the sleep-aware watchdog; compaction
  through the `summarize` role; the event log as NDJSON (ADR-031, ADR-032, ADR-065).
  `@jaari/llm` gained `stream` for the main session.
- `apps/daemon` (second half of 0.5, 2026-11-16): `startDaemon` refuses to start when secret zero or
  any model key cannot be read (ADR-079), then wires egress, the model router, and the main session;
  `jaari-daemon` runs from built `dist/` files (ADR-115). The tier-1 smoke test boots it on the
  scripted provider in CI, and CI starts the built daemon once with `--check` (ADR-041).
- Owner commands (2026-11-16, ADR-116): code reads "stop", "wait", "hold on", and the other brake
  words in the owner's languages, with OpenMausBot's stop-word rule; a stop word pauses and a
  repeated one stops the turn.
- Owner replies (2026-11-17, ADR-117): a reply to an earlier message is a pointer resolved by
  code from Jaari's own record, inside the one main session; it can widen a brake and answer one
  approval like a tap. The contract fields and the `message_ref` table shipped with 0.8.
- Channels (0.8, 2026-11-17): `@jaari/channels` holds the `ChannelAdapter` contract, the inbound
  schema (closed: no field for quoted text), and the contract suite (`@jaari/channels/contract`,
  ADR-084). Ingress runs one order: shape, sender (only a channel the daemon vouches for is the
  owner until pairing, 2.7), duplicate, secret scrub (ADR-081), owner command (ADR-116), reply
  pointer from `message_ref` (ADR-117), prompt answer (ADR-035), then the main session. Delivery
  splits long text, quotes only by code, records each confirmed id, and retries at 5, 25, and 125 s;
  an ambiguous send is never retried. The CLI channel listens on `jaari.sock` (mode 0600) in the
  data folder with NDJSON and a version hello; `apps/cli` adds `jaari chat`, which numbers
  messages and reads `>N text` as a reply. Open prompts live in memory until the gate (Phase 3).
  Next: a second and a third pre-release, to show an update between two published versions.
- Config (0.6, 2026-11-17, ADR-118): one JSONC file, `~/.jaari/config.jsonc`, with a schema version
  and a closed top level, read through `@jaari/core/config`; the daemon refuses an invalid or
  newer config and names each problem. `jaari init` asks for the target, where secrets are kept,
  and one model provider, and keeps the owner's comments when it runs again. `jaari secret set
  <name>` reads a value with no echo into the OS keychain or the credentials folder (mode 0600).
  Not built yet: `jaari config`, the `compose.yaml`, LLM presets (1.9), and the per-package
  config check (2.8).
- Owner id and versioned stores (0.14, 2026-11-17, ADR-119): `jaari init` writes a random
  `owner.id` once; the daemon refuses to start without it. `session.db` and `usage.db` open
  through `openDatabase`, which runs forward-only migration steps (one transaction each), refuses
  a store newer than the binary or owned by another id, and records the owner. Every row has
  `owner_id` and every event line has `ownerId`; existing data migrates on first start.
- Update (0.18, 2026-11-19, ADR-124): `jaari update` verifies a release offline (checksum, npm
  registry signature, publish attestation, and SLSA provenance from this repository's release
  workflow at the version's tag), installs it into `~/.jaari/versions`, stops the daemon,
  snapshots, switches the `current` link, runs `jaari-daemon --check` and `jaari doctor`, and
  undoes the version and the data on a failure. The npm commands are launchers that follow
  `current`. `jaari rollback` swaps the version back, `jaari uninstall` removes the app, and the
  release workflow publishes notes as a GitHub release. Released 2026-11-20 as `v0.1.0-beta.2`
  on npm `next` (SLSA provenance) and `ghcr.io/jaari-ai/jaari:0.1.0-beta.2`, the first version
  with `jaari update`. Its first notes listed every pull request since #1, because `beta.1` has no
  GitHub release; they were made again from `v0.1.0-beta.1`. Shown 2026-11-20 on macOS under
  launchd: `jaari update` from `v0.1.0-beta.2` (npm install) to `v0.1.0-beta.3` showed the notes,
  verified the release, took a `pre-update` snapshot, linked `current` to `versions/0.1.0-beta.3`,
  and the daemon came back with `jaari doctor` healthy. Not shown yet: the same under systemd, and
  `jaari rollback` after a real update.
- Release (0.17, 2026-11-18, ADR-123): `scripts/pack-release.mjs` makes the one npm package, with
  the internal packages and a shrinkwrap inside, and `docker/Dockerfile` makes the image from it.
  `release.yml` stages the npm version for approval with 2FA, and pushes a signed amd64 and arm64
  image to GHCR. `jaari init` writes `compose.yaml` on a server. CI proves the tarball and, on
  Linux, the generated Compose file. First release 2026-11-19: `v0.1.0-beta.1` on npm `next`
  (`latest` stays `0.0.0`) and `ghcr.io/jaari-ai/jaari:0.1.0-beta.1`, both signed.
- Local install commands (0.12, 2026-11-17, ADR-122): `jaari doctor` (levels `ok`, `info`,
  `warn`, `FAIL`; exit 1 only on `FAIL`), `jaari config <step>`, `jaari service install`
  (a launchd user agent; a systemd unit with `systemd-creds`), and `jaari rollback`. The daemon
  snapshots the stores and the config into `data/snapshots` before it migrates a store (last
  two kept). `openDatabase` makes each store 0600. The owner ran the launchd agent and `doctor`
  on a Mac (2026-11-17); the systemd path has not run on a real Linux host.
- Laptop host (0.13, 2026-11-17, ADR-057, ADR-121): `createPowerWatch` in `@jaari/core` ticks
  every 30 seconds and emits `power.wake` (a gap over 2 minutes on either clock),
  `power.source`, `power.battery.low` (once per battery cycle), `power.hold.failed`, and
  `network.change`; the daemon writes them to the event log. While a turn runs, the daemon holds
  off idle sleep with `caffeinate` or `systemd-inhibit`, by the `power.stayAwake` choice that
  `jaari init` asks on a laptop. No native helper, no owner notice, and nothing reconnects yet.
  The owner's Mac test (2026-11-17) saw the lid-close sleep and the unplugging.
- Prompt-injection floor (0.16, 2026-11-17, ADR-104, ADR-120): `@jaari/core` holds the locked
  safety section (`packages/core/prompts/safety.md`, version 1), `fence()` and `defuse` with the
  fence-escape corpus and a test that removes one `defuse` step at a time, the reply marker
  filter, and `createMarkers` (the install's canary from `session.db`, a fence id that is new at
  every start, and the leak scan). `@jaari/http` scans the URL, headers, and body of a request
  when the egress is built with `scan`; the daemon's model egress has none. Delivery filters and
  scans every outgoing message and every prompt before it opens. A hit writes `leak.blocked`
  and the owner is told. Not built yet: harness notes on the reply line and the compaction
  summary, and the per-turn prompt fingerprint (all 1.3); no tool calls `fence()` or the
  scanned egress before Phase 4.
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
Phase 0: Foundation, gate passed on 2026-11-20: items 0.1 to 0.18 are Verified (0.3, documents, Delivered), and the 19 exit
criteria pass with the evidence in [audits/phase-0-exit.md](audits/phase-0-exit.md). Not shown yet, and not an exit
criterion: an install and `jaari update` under systemd, and `jaari rollback` after a real update. Reopened the same day for two items the
owner added: 0.19, Windows as a host (ADR-125), and 0.20, testing `jaari update` from local builds
instead of releases (ADR-126). On 2026-11-21 the owner made Docker the main install and test target (ADR-128): 0.21
(Compose on Docker Desktop) joined the gate, and 0.19 is On request, with each host's tasks in [HOSTS.md](HOSTS.md).
0.20 and 0.21 are Implemented: the daemon copies the data when a new version starts (ADR-129), and on Docker Desktop the data is in a named volume (ADR-130). Docker covers every host; bare metal is kept as notes for later in [HOSTS.md](HOSTS.md), with the open Docker runs (Windows, a chat with a real model). Next: the Phase 0 gate review; then Phase 1 (Memory), from item 1.1. Per-item status, needs, and exit criteria are in
[ROADMAP.md](ROADMAP.md); the ordered next steps are in [ACTION_PLAN.md](ACTION_PLAN.md).
No open question blocks Phase 0 or Phase 1.

## Scheduled checks that ADRs defer
- Phase 1: measure the candidate local models (ADR-045).
- Start of Phase 3: check 1Password plan eligibility and limits on a real account (ADR-050).
- Phase 5: verify each provider's OAuth redirect and device-flow rules (ADR-062).
- Phase 6: review the task-scoped origin rule from the browser action log (ADR-052, ADR-099).
- When each CLI engine adapter is built: check and record the provider's terms (ADR-077).
- On an outside trigger: Web Bot Auth registration for individuals (ADR-054); `pi-durable`
  leaving Experimental (ADR-025, ADR-065).

## Open questions
3 open. OQ-92 (package platforms) blocks Phase 6; OQ-93 (refusal categories) blocks 4.1; OQ-95 (a model reading owner messages) blocks 4.5. OQ-96 (the way back under Compose) was resolved on 2026-11-21 (ADR-129). See [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
