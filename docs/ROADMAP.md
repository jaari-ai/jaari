# Jaari: Roadmap

The goal: a self-hosted personal agent in the shape of the commercial ones (always
reachable, remembers, works in the background, drives a browser, asks before it acts), run
by the owner on a VPS, a remote server, home hardware, or a laptop (ADR-017).

**Phases are a soft plan (ADR-020).** They say what to build roughly first, not what is
forbidden before. An item can start in any phase once its *needs* are met, and a phase is
never "closed" by a calendar. This file carries the per-item status;
[STATE.md](STATE.md) gives the summary.

## How to read this file

- **Item IDs** (`0.1`, `3.4`) are stable. Do not renumber; add the next number.
- **Needs** are what must be true **before that item ships**: an earlier item, or an open
  question from [OPEN_QUESTIONS.md](OPEN_QUESTIONS.md).
- **Status** is one of:

  | Status | Meaning |
  |---|---|
  | Planned | Designed in the ADRs; no code |
  | In progress | Some of the work exists in the repo |
  | Implemented | Code exists; the exit criteria are not yet shown to pass |
  | Verified | The exit criteria that cover it pass, with the evidence linked |
  | Blocked | Cannot ship as placed until the named open question is decided |
  | Delivered | A document deliverable that exists |

  A written design is never "Implemented", and "Verified" needs a passing check.
- **Exit criteria** are the pass conditions that the ADRs already state for the phase's items.
  A phase exits when every item in it is Verified and every exit criterion passes. Review
  [THREAT_MODEL.md](THREAT_MODEL.md) at each phase exit (ADR-069).
- **Placement** marks an item whose ADR states no phase; it is placed where its dependencies
  put it.

Current position: **Phase 0, not started.** No package exists; no gate has passed.

## Phase 0: Foundation

Purpose: a daemon that starts, talks on the CLI, calls a model, and refuses every gated
effect. Entry: none.

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 0.1 | Monorepo scaffolding: root `package.json`, lockfile, pnpm supply-chain settings | 002, 043 | none | In progress (root config files exist as placeholders; no `package.json`) |
| 0.2 | CI on every pull request: lint, typecheck, tests, tier-1 smoke test, DCO check, gitleaks, licence check | 041, 043 | 0.1 | Planned |
| 0.3 | Project process files: `SECURITY.md`, `CONTRIBUTING.md` | 043 | none | Planned |
| 0.4 | Namespaces and release: secure the npm and PyPI names, the `python/` pointer package, the release workflow ([guides/namespaces.md](guides/namespaces.md)). Placement | 010 | none | In progress (`release.yml` and `python/` exist; `python/` does not match the guide; names not secured) |
| 0.5 | `apps/daemon` and `@jaari/core`: agent loop on Pi and the persistent main session (session, serial queue, transcript, steering, compaction thresholds). Placement; pause, emergency stop, steps per turn, stall guard, watchdog, event log | 001, 065, 031, 032, 087 | 0.1, 0.7, 0.8 | Planned |
| 0.6 | Config loader and `jaari init` (asks for the target). Later init steps appear as their features ship | 017, 019, 056 | 0.1 | Planned |
| 0.7 | `@jaari/llm`: providers, tiers, roles, fallback chains, refusal classification, usage log | 011, 019, 085, 032, 087 | 0.1, 0.15 | Planned |
| 0.8 | `ChannelAdapter` contract and the shared contract suite, typed prompts, the CLI channel, and the ingress secret scrub | 021, 035, 081, 084 | 0.5, 0.9 | Planned |
| 0.9 | `@jaari/capabilities`: manifest schema (the `jaari` key of `package.json`, with kind sections), built-in loader, daemon–node contract | 015, 018, 071, 084 | 0.1 | Planned |
| 0.10 | Deny-all `@jaari/gate` stub | 018 | 0.9 | Planned |
| 0.11 | `@jaari/secrets` resolver with the `os-keychain` and `host-credential` providers | 007, 013, 018, 079 | 0.1 | Planned |
| 0.12 | Install, manual update with a local pre-update snapshot, rollback, and migrations; `jaari doctor` (checks are added as their features ship) | 056, 032, 082 | 0.5 | Planned |
| 0.13 | Laptop sleep and wake: detection, power assertion, battery pause, network re-probe (catch-up is 1.4) | 057, 082 | 0.5 | Planned |
| 0.14 | `ownerId` in the data model | 044 | 0.5 | Planned |
| 0.15 | `@jaari/http` core: resolve, check, dial; the address-class table; the `direct` provider; the lint rule against other network clients | 016, 053, 080 | 0.1 | Planned |

Exit criteria:
- The tier-1 smoke test boots the daemon on the scripted engine in CI on every pull request,
  with no API calls (ADR-041).
- Through the gate stub, every gated capability refuses and read-class ones run (ADR-018).
- A manifest with an unknown name or kind fails closed (ADR-071), and is checked before any
  package code runs (ADR-084).
- The CLI channel passes the shared channel contract suite (ADR-084).
- `jaari doctor` warns when an `env` or `file` secret provider is in use (ADR-018).
- On a host without a keychain, the daemon starts unattended with `host-credential`, and refuses
  to start when the credential file is readable by others, in the data directory, or in the
  backup set (ADR-079).
- `SECURITY.md`, `CONTRIBUTING.md`, the DCO check, gitleaks, the licence check, and the pnpm
  settings are in the repo (ADR-043).
- Every record carries an `ownerId` (ADR-044).
- A scripted refusal in the main session ends the turn with one notice and no model change; in a
  child it moves to the next model (ADR-085).
- A clock gap over 2 minutes is detected as sleep (ADR-057).
- A binary older than its data refuses to start (ADR-056).
- "stop now" aborts the running turn and "pause" survives a restart; a turn stops at 25 steps
  (ADR-031, ADR-087).
- `jaari update` takes a local snapshot before the swap and rolls back automatically when
  `jaari doctor` fails after it (ADR-056, ADR-082).
- A key, token, labelled password, or Luhn-valid card number in an owner message is replaced
  with `[secret removed: <kind>]` before the transcript and the daily log are written, and a
  commit hash is left alone (ADR-081).
- Every outbound call goes through `@jaari/http`: the lint rule fails on a direct `fetch`,
  `node:http`, `node:https`, `node:net`, `node:tls`, or `undici` import elsewhere, and the
  address-class tests deny metadata, link-local, and the daemon's own ports (ADR-016, ADR-080).

No open question blocks this phase.
Gate status: not passed.

## Phase 1: Memory

Purpose: Jaari remembers, recalls, and tidies its memory on a schedule. Entry: 0.5, 0.7.

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 1.1 | Memory repo, single writer, write path; pre-write secret scan of derived facts and files | 003, 026, 028, 081, 087 | 0.5 | Planned |
| 1.2 | Structured records, `records.query`, FTS5 search; sensitivity marking by type and rules | 023, 093 | 1.1 | Planned |
| 1.3 | Context assembly; session orientation and re-injection from state | 024, 065 | 1.2 | Planned |
| 1.4 | Job engine; catch-up after sleep (in `@jaari/core`); job-tree abort | 025, 057, 082, 086, 031, 087 | 0.5, 0.13 | Planned |
| 1.5 | Routines: object, schedule and one-shot triggers, `jaari routine`, run history with job receipts, caps; code steps and one tool-less model step; no proactive delivery (in `@jaari/core`) | 064, 086, 089 | 1.4, 1.11 | Planned |
| 1.6 | Canonicalize every 6 hours, with its privacy bounds | 004, 047 | 1.1, 1.4, 1.9 | Planned |
| 1.7 | Daily audit | 004 | 1.1, 1.4 | Planned |
| 1.8 | Capture evidence | 074, 081 | 1.1, 0.8 | Planned |
| 1.9 | Local-model qualification and the `jaari llm eval` qualification fixtures | 019, 045 | 0.7 | Planned |
| 1.10 | Correct and forget (erase is 3.9). Placement | 029 | 1.1 | Planned |
| 1.11 | Monthly LLM budget with the 100% prompt; spike alerts | 046, 031, 087 | 0.7, 0.8 | Planned |
| 1.12 | Nightly local snapshot of memory, SQLite, and config (last 7) | 027, 082, 087 | 1.1, 0.12 | Planned |

Exit criteria:
- A scheduled routine with nothing new makes no model call and posts nothing; a run with a
  change writes one job receipt to its run history (ADR-064, ADR-089).
- The three ADR-023 fixtures pass: the exact balance of a budget with 20 expenses; an
  appointment found from a related question seven days later; the bill, the appointment
  change, and the frequent contact's reply surfaced from 200 mixed messages.
- Invented-fact cases are rejected by the capture checks (ADR-074).
- A canonicalize pass that would delete more than 20% of a profile file is held (ADR-047).
- A half-done write intent is completed, found by its mutation id, or quarantined, never
  deleted (ADR-026).
- After a restart, a safe step reruns once and an unsafe step that had started is never rerun
  (ADR-025).
- At 100% of the monthly budget, one prompt offers the three choices, and background roles wait
  until the owner answers (ADR-046, ADR-087).
- A derived fact that contains a secret is blocked before the write (ADR-028, ADR-087).
- After sleep, each missed job runs once, at most 5 on wake, oldest first (ADR-057, ADR-082).
- Qualification records pass rate, tokens per second, and time to first token per model
  (ADR-045).

No open question blocks this phase.
Gate status: not passed.

## Phase 2: Persona and owner surfaces

Purpose: the dials, proactive messages that earn the interruption, and the first channels
beyond the CLI. Entry: Phase 1 memory and the job engine.

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 2.1 | Dials and monitor; repeated-failure and 7-day quiet rules | 008, 031, 087 | 0.5 | Planned |
| 2.2 | Curiosity from the gap queue | 008 | 1.6, 2.1 | Planned |
| 2.3 | Quiet hours, notification ledger, digests, delivery; automatic patch installs in quiet hours; 50% and 80% budget lines; routine delivery and reminders, marked late after sleep | 033, 056, 082, 046, 087, 064, 089 | 2.1, 0.12, 1.5 | Planned |
| 2.4 | Prompt versioning | 042 | 0.5 | Planned |
| 2.5 | Replay harness and golden threads | 041 | 0.2 | Planned |
| 2.6 | Skills: built-in and owner (third-party is 4.10) (in `@jaari/core`) | 060, 086 | 1.1 | Planned |
| 2.7 | Owner authentication: device registry, `jaari pair`, `jaari devices`. Placement | 022 | 0.8 | Planned |
| 2.8 | Telegram channel. Placement; loop breaker for other bots | 021, 031, 087 | 0.8, 2.7 | Planned |
| 2.9 | Owner panel: Home, Memory, Settings, Usage, Activity from the event log (Approvals, audit, and secret entry with 3.1 and 3.3) | 067, 088 | 2.7, 2.12 | Planned |
| 2.10 | Onboarding | 070 | 2.6; OQ-83 | Planned |
| 2.11 | Voice notes and optional spoken replies (in `@jaari/llm`) | 037, 086 | 0.8 | Planned |
| 2.12 | Overlay binding and panel TLS: loopback plus one private interface; Tailscale, Headscale, and Custom modes; `jaari doctor` check | 030, 088 | 0.5 | Planned |

Exit criteria:
- A routine result reaches the owner only through the ledger: in the digest by default, at once
  when urgent or asked for (ADR-064, ADR-089).
- Tier-1 "quiet" scenarios pass: quiet hours, the 7-day rule, the outbox duplicate window, only
  the main session speaks (ADR-041).
- An override file for a locked prompt is refused at load, with a line in `jaari doctor`
  (ADR-042).
- The tool list and the stable prompt layer stay byte-identical across a session's turns
  (ADR-042).
- Pairing codes are single use, last 10 minutes, and lock out after 5 wrong tries (ADR-022).
- The panel loads no third-party scripts and shows untrusted content as plain text (ADR-067).
- The daemon listens only on loopback and the chosen private interface, never `0.0.0.0`, and
  serves the panel only over TLS (ADR-030, ADR-088).
- Onboarding asks at most one gap question a day (ADR-070).
- A conditional spoken answer to an approval is refused and asked again (ADR-037).

Open questions that block this phase: OQ-83.
Gate status: not passed.

## Phase 3: Safety

Purpose: replace the deny-all stub with the real gate, and add the controls that make
effects and long-running work safe. Entry: Phase 0 gate stub; the threat model exists.
These items check each other at dispatch, so the gate, audit log, pause, shadow mode, and
grants land together.

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 3.1 | Real gate: digests, approvals, expiry, re-check at dispatch, the "unreadable" rule; approvals that expired during sleep are asked again; the Approvals view and the audit part of Activity | 006, 016, 018, 057, 082, 088 | 0.10; OQ-79 | Planned |
| 3.2 | Hash-chained `audit.jsonl` | 016 | 3.1 | Planned |
| 3.3 | Vault providers (Bitwarden, 1Password), the one-time-code ladder, the panel's secret-entry page, and the 1Password check on a real account | 013, 050, 088 | 0.11 | Planned |
| 3.4 | Web budget (the LLM budget is 1.11, the usage log 0.7) | 046 | 1.11; OQ-89 | Planned |
| 3.5 | Lowering a capability's permission stops the turn using it (the other ADR-031 limits ship with 0.5, 1.4, 2.x, and 4.1) | 031, 087 | 3.1 | Planned |
| 3.6 | Standing grants | 072 | 3.1 | Planned |
| 3.7 | Backup, restore, and the monthly drill; the ADR-027 bundle replaces the local pre-update and nightly snapshots | 027, 082, 087 | 1.1, 3.2; OQ-87 | Planned |
| 3.8 | Encryption at rest: encrypted remotes, `jaari memory purge` (the pre-write scan is 1.1, the ingress scrub 0.8) | 028, 087 | 1.1 | Planned |
| 3.9 | Erase. Placement | 029 | 3.1, 1.10; OQ-87 | Planned |
| 3.10 | Shadow mode | 068 | 3.1 | Planned |
| 3.11 | Degraded mode | 059 | 3.5 | Planned |
| 3.12 | Crash drills with the real gate | 041 | 3.1, 0.2 | Planned |
| 3.13 | Threat model document | 069 | none | Delivered ([THREAT_MODEL.md](THREAT_MODEL.md)); reviewed at each phase exit |

Exit criteria:
- No effect runs without a matching digest; sealed runs do not ask (ADR-041 tier 1).
- An action whose audit row cannot be written does not run (ADR-016).
- Crash drills: kill and restart at seven points; no possibly accepted action is submitted
  twice (ADR-041).
- The restore drill restores the latest snapshot into a temporary folder, checks `git fsck`,
  SQLite `integrity_check`, and the audit hash chain, and reports "backup verified" (ADR-027).
- `jaari doctor` exits non-zero when any check fails (ADR-032).
- Each degraded state is a tier-1 scenario: provider down, node down, disk full, vault
  unreachable (ADR-059).
- Budget warnings fire at 50% and 80% (ADR-046).
- 1Password plan eligibility and limits are checked on a real account (ADR-050).

Open questions that block this phase: OQ-79, OQ-87, OQ-89.
Gate status: not passed.

## Phase 4: Background work

Purpose: children, the web, untrusted content, and sandboxed code. Entry: the Phase 3 gate
and audit log.

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 4.1 | Children and receipts; child limits and child abort; routine model steps run as children | 011, 061, 031, 087, 089 | 1.4; OQ-81 | Planned |
| 4.2 | `llm.escalate` | 011 | 4.1 | Planned |
| 4.3 | `reader` role and outside lineage | 075 | 0.7 | Planned |
| 4.4 | `owner-exit` provider and per-capability host allowlists on the `@jaari/http` core | 016, 053, 080 | 0.15, 2.12 | Planned |
| 4.5 | `web.search` and `web.fetch` with pluggable rungs; watcher triggers on web pages | 012, 049, 064, 089 | 4.3, 4.4, 4.13 | Planned |
| 4.6 | Optional Web Bot Auth signing for HTTP | 054 | 4.4 | Planned |
| 4.7 | First sandbox backend | 034, 036 | OQ-70 | Blocked (OQ-70: backend under Compose not chosen) |
| 4.8 | MCP client, local servers sandboxed (in `@jaari/mcp`) | 034, 086 | 4.3, 4.7; OQ-80 | Planned |
| 4.9 | Code execution; routine script steps; pinned jobs | 036, 064, 089, 092 | 3.6, 4.7 | Planned |
| 4.10 | Third-party skills and third-party packages | 060, 071 | 4.3 | Planned |
| 4.11 | Headless CLI commands | 076 | 0.5 | Planned |
| 4.12 | Subscription CLI engines for sandboxed children (interface in `@jaari/core`; each engine is a package) | 077, 086, 091 | 4.1, 4.7 | Planned |
| 4.13 | Container egress proxy on the same address-class table, shipped with the first container that works on untrusted input (SearXNG, browser, sandbox) | 053, 080 | 0.15 | Planned |

Exit criteria:
- The sandbox self-check verifies no network, a read-only root, no home directory, and working
  limits; CI mutation tests remove one protection at a time and the check catches each
  (ADR-036).
- An `outside` run cannot settle approvals or use standing grants (ADR-075).
- MCP config and tool list are pinned; results are capped at 20 KB (ADR-034).
- The connection baseline holds: 15 s timeout, 64 KiB default and 1 MiB maximum response
  (ADR-053).
- Each CLI engine's provider terms are checked and recorded in a learning note (ADR-077).

Open questions that block this phase: OQ-70,
OQ-80, OQ-81.
Gate status: not passed.

## Phase 5: Integrations

Purpose: the owner's accounts and data sources. Entry: vault (3.3), `reader` role (4.3),
sandbox (4.7).

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 5.1 | GitHub, npm, and PyPI integrations | none (INTEGRATIONS.md) | 3.1; OQ-91 | Planned |
| 5.2 | Email as an input channel | 021 | 4.3 | Planned |
| 5.3 | OAuth broker, with bounded token rotation (in `@jaari/integrations`) | 062, 086, 090 | 3.3 | Planned |
| 5.4 | The agent's mailbox (in `@jaari/integrations`); watcher triggers on the inbox | 063, 086, 064, 089 | 3.3, 4.3 | Planned |
| 5.5 | Calendar, contacts, and file storage | 039 | 5.3; OQ-79 | Planned |
| 5.6 | Documents (in file store in `@jaari/memory`) | 038, 078, 086, 093 | 4.7; OQ-87 | Planned |
| 5.7 | Photo notes | 066 | 5.6 | Planned |
| 5.8 | Inbound triggers (in `apps/hooks`) | 073, 086 | 1.5, 4.3 | Planned |
| 5.9 | MCP server for paired desktop apps (in `@jaari/mcp`, `jaari mcp`) | 076, 086 | 2.7; OQ-88 | Planned |

Exit criteria:
- Each provider's OAuth redirect and device-flow rules are verified (ADR-062).
- `jaari doctor` checks SPF, DKIM, and DMARC for the agent's address (ADR-063).
- Hook deliveries: 256 KiB body cap, 10 requests a minute per hook, receipt written to disk
  before the 2xx response (ADR-073).
- The disk watch notifies at 80%, 90%, and 95% used (ADR-038).

Open questions that block this phase: OQ-79, OQ-87, OQ-88, OQ-91.
Gate status: not passed.

## Phase 6: Computer use

Purpose: Jaari drives a browser and a desktop under the placement rule. Entry: children
(4.1), egress (4.4), shadow mode (3.10), pairing (2.7).

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 6.1 | Neutral `browser.*`/`computer.*` surface and pluggable adapters, under the placement rule; local profile, owner exit node, remote CDP | 005, 017, 048 | 4.1; OQ-82 | Planned |
| 6.2 | Native Anthropic and Gemini toolsets as an `@jaari/llm` mapping | 048 | 6.1 | Planned |
| 6.3 | Browser SOCKS5 listener and owner-account pinning; opt-in `vpn`, `mobile`, and `residential-proxy` providers | 016, 017, 053 | 4.4 | Planned |
| 6.4 | Takeover | 055 | 6.1, 2.9, 2.12 | Planned |
| 6.5 | Commitment classifier | 051 | 6.1; OQ-83 | Planned |
| 6.6 | Browser worker child and task-scoped origins; the scope rule is reviewed from logs last | 052 | 6.1; OQ-83 | Planned |
| 6.7 | `computer.use` on a host virtual desktop | 015 | 6.1 | Planned |
| 6.8 | Remote nodes via `jaari capability install`; packages on nodes; the node link | 015, 058, 071, 088 | 2.7, 2.12 | Planned |
| 6.9 | macOS permission matrix | 057 | 6.8 | Planned |
| 6.10 | Web Bot Auth signing in the browser | 054 | 6.1, 4.6 | Planned |

Exit criteria:
- The classifier ships only when it catches every commitment in the recorded real-flow pages
  (ADR-051).
- A takeover link is single use and expires in 10 minutes; after 3 failed takeovers on the
  same step Jaari stops and tells the owner (ADR-055).
- Native toolsets are enabled per route only when the Phase 6 fixtures show a gain (ADR-048).
- The task-scope origin review is done from the logs (ADR-052).

Open questions that block this phase: OQ-82, OQ-83.
Gate status: not passed.

## Phase 7: Hardening

Purpose: stronger isolation, more network modes, and moving hosts. Entry: Phase 4 sandbox.

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 7.1 | Firecracker sandbox backend | 036 | 4.7 | Planned |
| 7.2 | Container isolation of host capabilities and third-party packages | 015, 071 | 4.10 | Planned |
| 7.4 | WireGuard peer-config generation, Cloudflare Zero Trust, and sizing per target | 030, 088 | 2.12 | Planned |
| 7.5 | Multi-device state and host migration ("multi-device state" has no ADR; the node link is 6.8) | 058, 088 | 6.8 | Planned |
| 7.6 | Observability: opt-in traces and the raw tee (in `@jaari/core`) | 032, 086 | 3.4 | Planned |

Exit criteria: none documented in the ADRs. Define them before this phase starts.

No open question blocks this phase.
Gate status: not passed.

## Phase 8: Evals

Purpose: measure behaviour and learn from outcomes. Entry: receipts (4.1), usage log (3.4).

| ID | Item | ADRs | Needs | Status |
|---|---|---|---|---|
| 8.1 | Live behaviour tests (tier 3, opt-in) | 041 | 2.5 | Planned |
| 8.2 | Remaining `jaari llm eval` fixtures beyond qualification (1.9) | 045 | 1.9 | Planned |
| 8.3 | Learned router experiment | none (LLM.md) | 3.4 | Planned |
| 8.4 | Learning from outcomes: reflections and promotions | 061 | 4.1 | Planned |

Exit criteria:
- An LLM judge is used only for tone and never gates CI (ADR-041).
- The gate, approval rules, grants, security settings, and locked prompts never learn from
  outcomes (ADR-061).
- None documented for the learned router experiment.

Gate status: not passed.

## Later (after v1)

Live calls and a phone number (ADR-037, ADR-063); payments rail (`pay` is reserved, ADR-040);
face recognition, image similarity search, and albums (ADR-066); WhatsApp and iMessage
channels (ADR-021); a multi-owner instance (ADR-044); embeddings (ADR-023); Windows
(ADR-057); a node relay (ADR-058); trust tiers and the agent network (non-goals for v1,
ADR-020).

## Egress in steps

The `@jaari/http` core with the address-class table and `direct` in Phase 0, used by every
outbound call (ADR-080); `owner-exit`, per-capability allowlists, and the container egress proxy
in Phase 4; the browser's
SOCKS5 listener, owner-account pinning, and the opt-in `vpn`, `mobile`, and
`residential-proxy` providers (anonymous traffic only) in Phase 6 (ADR-053).

## Changes from the earlier roadmap (2026-11-12 audit)

- The one-row-per-phase table became one section per phase with item IDs, needs, status, and
  exit criteria. Phase numbers are unchanged.
- Moved to match an ADR: `jaari llm eval` qualification fixtures from Phase 8 to Phase 1
  (ADR-019, ADR-045); `mobile` and `residential-proxy` providers from Phase 7 to Phase 6, with
  `vpn` added (ADR-053).
- Added, with the phase the ADR states: CI and the tier-1 smoke test (0.2), crash drills (3.12),
  receipts (4.1), third-party packages (4.10), browser signing (6.10), container isolation (7.2).
- Added where no ADR states a phase (marked *Placement*): `apps/daemon` and `@jaari/core`
  (0.5), namespaces and release (0.4), correct and forget (1.10), owner authentication (2.7),
  Telegram (2.8), erase (3.9). Email input (5.2) follows ADR-021.
- The threat model is marked Delivered (3.13).
- The phase conflicts the audit left open are all decided since (ADR-080 to ADR-089).
- Decided since the audit: the egress core moved to Phase 0 as 0.15, and the container egress
  proxy moved from 7.3 to 4.13 (ADR-080). Catch-up moved from 0.13 to 1.4, and automatic patch
  installs to 2.3 (ADR-082). Safety pieces moved to the phase of what they protect (ADR-087).
  The overlay binding moved to 2.12 and the node link to 6.8; panel views ship with their
  features (ADR-088). Routine delivery and reminders moved to 2.3 (ADR-089).
