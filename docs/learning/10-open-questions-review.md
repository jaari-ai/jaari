# 10 — Open questions review: a recommendation per question, from the references

Studied 2026-11-10: every open question in [OPEN_QUESTIONS.md](../OPEN_QUESTIONS.md) against
the code and docs of the five references at their pinned commits (`refs/INDEX.md`):
`refs/open-instinct` (`2e5e71b`, MIT), `refs/openinstinct` (`213120c`, no licence, behaviour
only), `refs/gajae-way` (`34cbd15`, AGPL, design only), `refs/pi` (`469d865`, MIT), and
`refs/openmausbot` (`b802268`, already covered in [09-openmausbot.md](09-openmausbot.md)).

> Since decided (2026-11-12): every question reviewed here has an ADR (ADR-021 to ADR-078; see
> the *Resolved* table in OPEN_QUESTIONS.md). Most recommendations were adopted or sharpened;
> some were changed or rejected by the ADR (for example OQ-03, OQ-15, OQ-30, OQ-51). The text
> below is the record of the proposals as written.

**Status: proposals.** Nothing here is decided. The *Leaning* column in OPEN_QUESTIONS.md is
unchanged; each row below says whether the recommendation keeps, sharpens, or changes it.
Mechanisms from openinstinct and gajae-way are described in Jaari's own words and must be
re-implemented, never copied (ADR-009, ADR-014). Constants were read in code unless marked
*docs only*.

The test applied to every recommendation ("the soul of the project"): single owner and
self-hosted; the model proposes and deterministic code disposes; memory a human can read and
fix; reuse Pi instead of rebuilding it; cheapest capable option first; a proactive message
must earn the interruption.

## 1. What the references do (the findings that move decisions)

- **Pi already ships much of the runtime Jaari planned to design.** `pi-agent-core` has
  `beforeToolCall` / `afterToolCall` hooks (where the gate attaches), steering, and abort.
  `pi-ai` has a scripted `fauxProvider`, usage and cost accounting, retry that honours
  `retry-after`, a typed local classifier (`llama-cpp-classify`), and server-side threads.
  `pi-mcp` is a full MCP client with a 20 KB result cap (`MCP_OUTPUT_MAX_BYTES`).
  `pi-telemetry` is a span and metric contract with no exporter. `pi-codemode` runs
  model-written JS in a QuickJS VM whose only capability is the injected tools.
- **`pi-durable` implements most of the scheduler leaning** (SQLite, task tree, a checkpoint
  per step, a per-tool `replay: "safe" | "unsafe"` flag recorded before execution, restart
  limit 5), but its README marks it **Experimental**, it owns the agent loop itself, and it
  has no cron, time zones, or missed-run policy.
- **Pi provides no** permission system, fallback chain, budget cap, cron, stall guard, OS
  sandbox, secrets vault, reader role, or computer-use toolset. Those stay Jaari's.
- **openinstinct confirms the runtime semantics Jaari cites**, with numbers: compaction at 50%
  after a turn settles (`COMPACT_AT_PERCENT`), 4 concurrent children and 16 live, a 300 s
  inactivity watchdog, an outbox retry ladder of 5 s, 25 s, 125 s, a durable pause flag, one
  catch-up run per monitor at start, and "only the main session messages the owner".
- **gajae-way's memory engine uses no index at all**: every search scans the Markdown and
  ranks with BM25 (tags weighted 3x, linked notes added at 0.3x). Writes go through an
  intent row, the file, a commit with a mutation-id trailer, then a receipt.
- **open-instinct has the most reusable edges**: the owner claim code, "email is never the
  owner", a webhook receiver with a durable inbox, the takeover state protocol, the prompt
  layers inspector, the onboarding skill, and a threat table with an explicit "not protected
  against" list.
- **Nobody solves** encryption at rest, consequential clicks, memory capture evidence
  (except OpenMausBot), shadow mode, capability packages, local-model quality, or LLM budgets.

## 2. Why they do it that way

| Failure prevented | Mechanism | Where |
|---|---|---|
| An index that drifts from the files | No index: scan and rank | `refs/gajae-way/packages/gateway/src/memory/retrieve.ts` (`searchMemory`) |
| A memory write lost or doubled by a crash | Intent row, file, commit with trailer, receipt; quarantine, never delete | `refs/gajae-way/packages/gateway/src/memory/closure.ts` |
| A tool re-run after a crash sends twice | Intent recorded before `execute()`; rerun only if declared safe | `refs/pi/packages/durable/src/harness/tool.ts` |
| A turn resent when it had started | A send stamp written just before the prompt is handed over | `refs/gajae-way/docs/runbooks/gajaeway-v1.md` (*docs only*) |
| A flood of stale runs after downtime | One catch-up run per monitor, the rest counted as skipped | `refs/openinstinct/daemon/src/monitors/scheduler.ts` (`catchUp`) |
| Background code texting the owner | Reports go to the main session as an internal turn that may stay silent | `refs/openinstinct/docs/architecture.md`, `daemon/src/delivery/service.ts` |
| Forged owner email | Mail from the owner's address is a lower principal and cannot settle approvals | `refs/open-instinct/packages/core/src/principal.ts` |
| A guessed pairing code | Min 8 chars, expiry, 10 tries, constant-time compare, stripped before the model, single use | `refs/open-instinct/packages/core/src/owner-claim.ts` |
| A webhook lost between receipt and run | Receipt written to disk before the acknowledgement; HMAC over id, timestamp, body | `refs/open-instinct/packages/inkbox/src/inbox.ts`, `signature.ts` |
| A sleeping laptop tripping the watchdog | Watchdog caps the budget added per check | `refs/gajae-way/packages/gateway/src/liveness-watchdog.ts` |
| macOS grants lost on update | Keep the daemon binary's identity; re-probe permissions every 5 s | `refs/openinstinct/daemon/src/install/plist.ts`, `bootstrap/probes.ts` |
| An oversized tool result | Middle cut at 20 KB, full text saved aside | `refs/pi/packages/mcp/src/output-limit.ts` |

## 3. Recommendations

Verdict: **Keep** (the leaning stands), **Sharpen** (same direction, now concrete), **Change**
(differs from the leaning), **Decide** (the leaning was "undecided").

### A. Blocking soon

| OQ | Recommendation | Borrowed from | Verdict |
|---|---|---|---|
| 01 Channels | CLI and the web panel first, then Telegram as the one mobile messenger (an `account` identity with a pairing code). An adapter is an outbox plus a parser returning `InboundMessage`. WhatsApp and Signal after v1. | open-instinct `packages/inkbox/src/channel.ts` (adapter shape) | Sharpen |
| 02 Owner authentication | One place mints owner authority (ingress). Pairing by a claim code with open-instinct's limits. Email is never the owner. Device tokens stored hashed and revocable per token; no reference has revocation, so that part comes from OpenMausBot. Cursor anchors at the newest message, never replays. | openinstinct `owner-turn.ts`; open-instinct `owner-claim.ts`, `principal.ts`; learning/09 | Sharpen |
| 03 Memory retrieval | Start with scan-and-rank BM25 behind a `memory.search` tool: tag weighting, linked-note expansion, axis priority. No index to keep in sync. Add SQLite FTS5 as a cache behind the same interface only when a scan gets slow; embeddings stay optional. | gajae-way `memory/retrieve.ts` (design only) | Change (was FTS5 first) |
| 04 Context assembly | A deterministic assembler built on Pi's `section()` / `prepareRequest`, with a per-section budget Jaari adds. After start, reload, or compaction the first turn gets a bounded orientation block (about 6,000 chars: tail of the map, today, else yesterday). Ship `jaari prompt --layers`. | openinstinct `persona/orientation.ts`; open-instinct `core/src/prompt.ts` (`describePromptLayers`); Pi `durable` README | Sharpen |
| 05 Scheduler | Jaari's own small SQLite queue, not `pi-durable` while it is Experimental, but with its contract: intent recorded before a tool runs and a per-tool `replay` flag. Cron per job in an IANA zone, a DST gap skipped, each slot claimed once, one catch-up run plus a skipped count, retries at 0, 10 min, 1 h, 4 h, 12 h. Keep the boundary narrow so `pi-durable` can replace it later. | Pi `durable/src/harness/tool.ts`; openinstinct `monitors/scheduler.ts`; gajae-way `monitors/triggers/cron.ts` | Sharpen |
| 06 Concurrent memory writes | Single writer with the closure ladder: intent row, write the file, commit with a mutation-id trailer, mark receipted; an index lock leaves the intent retryable; unrecoverable intents are quarantined. The commit stages the whole repo so hand edits join history. | gajae-way `memory/closure.ts` (design only) | Sharpen |

### B. Before daily use

| OQ | Recommendation | Borrowed from | Verdict |
|---|---|---|---|
| 07 Backup and restore | All three stores, plus a journaled restore that keeps the live data under `pre-restore-<id>/`, can be aborted before install, and returns typed exit codes. The scripted restore test runs it. Pushing memory to a remote is Jaari's own addition. | gajae-way `ops/backup.ts`, `ops/restore.ts` | Sharpen |
| 08 Encryption at rest | No reference encrypts. Recommend: plain Markdown on the host (rely on disk encryption, files 0600), `age` encryption for the remote and for backups, and a deliberate `jaari memory purge` that rewrites history only for a leaked secret. | none (own call) | Decide |
| 09 Forgetting and retention | Supersede, never silently delete: daily capture stays append-only and decisions carry a `supersedes` link. `forget` is an explicit owner command that redacts the text and adds the fact to a forgotten list. Operational rows (deliveries, receipts) pruned after 7 days. | gajae-way `memory/registry.ts`; openinstinct `maintenance/retention.ts`; learning/09 | Decide |
| 10 Deployment | Compose with the agent bound to loopback, a named volume, and an entrypoint that drops root. Tailscale first. Updates run under a lease, keep the previous version, and flip atomically. | open-instinct `deploy/docker-compose.yml`, `entrypoint.sh`; gajae-way `docs/deployment.md` (*docs only*) | Sharpen |
| 11 Kill switch | Defaults: pause as a durable flag (scheduled work skipped, suppressed count reported on resume); 4 concurrent children, 16 live, 30 min child timeout; 300 s inactivity watchdog that is sleep-aware; after 2 failed turns, failure notices go to the log only; Pi's `maxTurns` for the step limit. Stall guard and spend-spike alert are Jaari's. | openinstinct `control/pause.ts`, `runtime-config.ts`; gajae-way `liveness-watchdog.ts`; Pi `durable` | Sharpen |
| 12 Observability | Use `pi-telemetry` as the contract and write one OpenTelemetry adapter. `jaari doctor` is a read-only gates command that exits non-zero. The raw provider tee uses Pi's `onPayload` / `onResponse`. `audit.jsonl` stays the record. | Pi `packages/telemetry`; gajae-way `ops/cycle.ts` (*docs only*) | Sharpen |
| 13 Notification delivery | Only the main session speaks: every child or routine report arrives as an internal turn that writes one line or stays silent. Outbox retries at 5 s, 25 s, 125 s with a 10-minute duplicate window; an uncertain send is never resent. Refusal notices capped at one per conversation per hour. ntfy optional. | openinstinct `delivery/service.ts`; open-instinct `core/src/notifier.ts` | Sharpen |

### C. Tools and plugins

| OQ | Recommendation | Borrowed from | Verdict |
|---|---|---|---|
| 14 MCP client and plugins | Use `pi-mcp` directly. An unknown tool is gated and owner-only by default; server annotations are never trusted; results capped at 20 KB. Config-hash grants as in the leaning. | Pi `packages/mcp`; open-instinct `apps/src/capabilities.ts` | Sharpen |
| 15 Code execution | In two steps. First `pi-codemode` (QuickJS, no network, only injected tools, still passes the gate hooks) for tool-orchestration scripts. A real shell later inside a container, with an environment allowlist that drops anything named like a key or token. | Pi `packages/codemode`; open-instinct `server/src/file-tools.ts` (`SHELL_ENV_ALLOWLIST`) | Sharpen |
| 16 Voice | Stay deferred. When it comes: a call always needs its own approval and can never use a standing grant; the spoken-consent grammar from OpenMausBot. | openinstinct `calls/`; open-instinct `docs/PERMISSIONS.md`; learning/09 | Keep |
| 17 Documents and files | Limits first: 10 attachments per message, 10 MB each, stored under hashed names, transient files kept 7 days. Extracted text is untrusted content for the reader role. No reference parses PDF or Office files; pick the parser when the first use case arrives. | open-instinct `inkbox/src/hydration.ts`; gajae-way `adapter-telegram/src/attachments.ts` | Decide (limits only) |
| 18 Personal data | Calendar first, over CalDAV directly (no hosted broker), split into three capabilities: free/busy, read, write. | open-instinct `apps/src/capabilities.ts` | Sharpen |
| 19 Payments rail | Keep "no payments in v1". If it ever ships: a deterministic spend check (per action, per day, ask above a threshold) summed from the audit log, and one-time cards. | open-instinct `core/src/policy.ts` (`checkSpend`) | Keep |

### D. Quality and process

| OQ | Recommendation | Borrowed from | Verdict |
|---|---|---|---|
| 20 Behaviour evals | Pi's `fauxProvider` is the scripted engine. Add a smoke test that boots the real daemon on it, crash drills that kill and restart at seven points, and the assertion that no possibly-accepted action is ever submitted twice. Scenarios and scorers are Jaari's. | Pi `ai/src/providers/faux.ts`; open-instinct `server/src/smoke.ts`; openinstinct `drills/runtime.ts`; gajae-way runbook | Sharpen |
| 21 Prompt versioning | Prompts as files with a version marker; the SHA-256 of every prompt file used is logged per run; Pi's transcript already records the prompt in force at each turn. | openinstinct `persona/soul.ts`; gajae-way `docs/monitors.md` (*docs only*); Pi `ai` README | Sharpen |
| 22 Project process | `security@jaari.org` plus GitHub private advisories, with an explicit out-of-scope list. DCO, no CLA. Lockstep versions and one release script instead of changesets. Exact-pinned dependencies, a minimum release age, `--ignore-scripts`, and gitleaks in CI. | Pi `SECURITY.md`, `CONTRIBUTING.md`, root README; open-instinct `.gitleaks.toml` | Change (was changesets) |
| 23 Multiple users | Single owner; keep a user id in the data model. Every reference is single-owner; open-instinct's tiers are the deferred household design (ADR-020). | all | Keep |

### E. From ADR-011 to ADR-013

| OQ | Recommendation | Borrowed from | Verdict |
|---|---|---|---|
| 24 Local model per target | No reference has evidence on local-model quality, and Pi's model metadata has no "supports tools" flag, so `jaari llm eval` is the only qualifier. Use Pi's `llama-cpp-classify` for the small-tier typed questions. | Pi `ai/src/types.ts`, `ai` README | Keep |
| 25 LLM budget | Keep the $30 placeholder. Pi supplies the accounting (including provider-billed cost and failed attempts); the cap and alerts are Jaari's, since no reference enforces one. | Pi `ai/src/types.ts` (`Usage`) | Keep |
| 26 Canonicalize privacy | Decided in shape by ADR-019. Add the bounds: at most 20 capture files and 64 KiB per pass, a 45-minute timeout, raw daily files hashed before and after (any change fails the pass), the model writes files and the daemon commits. Prompt wording changes the result, so it belongs in the fixtures. | openinstinct `memory/adapters/canonicalize.ts` | Sharpen |
| 27 Browser tool surface | Neutral `browser.*` / `computer.*` surface shaped like the vendor action set, attached to the gate through Pi's `beforeToolCall`, with tool execution set to sequential. Pi has no toolset support, which confirms the premise. | open-instinct `computer/src/schema.ts` (`ACTION_ENUM`); Pi `agent` README | Keep |
| 28 Lightpanda | No evidence in any reference. Ship it off by default and decide from fetch-ladder logs. | none | Keep |
| 29 Vault verification | No reference uses a vault. A vendor-docs check, as written. | none | Keep |
| 64 Accept ADR-013 | Unchanged: accept after OQ-29. | none | Keep |

### F. Computer use

| OQ | Recommendation | Borrowed from | Verdict |
|---|---|---|---|
| 30 Consequential browser actions | No reference solves it; open-instinct lists it as unprotected. Start strict: gate by verb (click, type, fill, select, press are all gated inside owner-account sessions), relax with page heuristics later, and treat "unreadable" as "ask". | openinstinct `browser/enforce.ts`; ADR-016 | Sharpen |
| 31 Screenshots as untrusted content | Gate plus egress as the boundary. As a floor, wrap everything untrusted in-band and strip inner tags, and say so in the tool description. Resize images with Pi's limits. | open-instinct `core/src/prompt.ts` (`wrapUntrusted`); Pi `ai` README | Keep |
| 32 Egress pool details | Baseline for every provider: no redirects followed, DNS answers validated and pinned per connection, a secret bound to one origin and one header, 15 s timeout, 64 KiB default and 1 MiB maximum response. The pool itself is ADR-017. | openinstinct `assistant-work/http-effects.ts`, `http-policy.ts` | Sharpen |
| 33 Signed-agent identity | No reference signs requests. Keep the leaning, at low priority. | none | Keep |
| 34 Takeover transport | Adopt the state protocol: a non-blocking request with a reason, the model polls status or waits at most 600 s, the owner ends it with Done or Failed, Failed means do not retry, agent actions are refused while the owner holds. Every browser call must target the agent's own profile. Transport stays CDP screencast. | open-instinct `computer/src/desktopd.ts`; openinstinct `browser/enforce.ts` | Sharpen |

### G. From the 2026 gap review

| OQ | Recommendation | Borrowed from | Verdict |
|---|---|---|---|
| 35 Install, update, migrate | Migrations run when a store opens; versioned records carry an optional `migrate(value, fromVersion)`; `jaari update` runs under a lease and keeps the previous version; `jaari doctor` is the gates command of OQ-12. | openinstinct `store/migrations.ts`; Pi `durable/src/documents.ts`; gajae-way `docs/deployment.md` (*docs only*) | Sharpen |
| 36 Laptop as host | Re-probe permissions every 5 s and attach or detach capabilities without a restart. Keep the binary's identity stable across updates. Never install under Documents, Desktop, or Downloads. Add a wake trigger for catch-up, since no reference detects sleep. | openinstinct `bootstrap/probes.ts`, `install/plist.ts`; gajae-way runbook (*docs only*) | Sharpen |
| 37 Multi-device state | No reference covers it. Keep the leaning; Pi's `RemoteExecutionEnv` (SSH daemon with a verified deploy) is a candidate for node execution. | Pi `packages/env` (*docs only*) | Keep |
| 38 Degraded mode | Write a send stamp just before a turn is handed to the provider: unstamped means it never started and may be requeued or failed over; stamped is reconciled and never resent. Pi's agent-level retry matches error text and is looser than ADR-016, so put Jaari's classifier in front of it. Keep the control surface up when the model is down. | gajae-way runbook (*docs only*); Pi `ai/src/utils/retry.ts`; openinstinct `bootstrap/states.ts` | Sharpen |
| 39 Skills and procedural memory | Agent Skills `SKILL.md` format, index in the prompt and body on demand; limits of 64 KB per file and depth 3; built-ins win a name clash; owner playbooks under `ops/rules`. A skill is never a permission boundary. Install stays gated and scanned (ADR-018). | open-instinct `server/src/skills.ts`; Pi `coding-agent/docs/skills.md`; gajae-way `memory/registry.ts` | Sharpen |
| 40 Learning from outcomes | A child's final report becomes a receipt of at most 1 KiB folded into the main session; failures and restart orphans always leave one. A reflection names the failure, the invariant learned, the next action, and a promotion target. Promotion needs the owner's confirmation, which is stricter than gajae-way. | openinstinct `children/receipts.ts`; gajae-way `monitors/propagate.ts` | Sharpen |
| 41 OAuth broker | Self-hosted flows only: PKCE, refresh five minutes early, a pending flow expires after 10 minutes, revoke on disconnect, tokens in the vault. `pi-mcp` already has the OAuth client for MCP servers. No hosted broker. | open-instinct `payments/src/wallet.ts`; Pi `packages/mcp` | Sharpen |
| 42 The agent's own mailbox | Mailbox on the owner's domain over IMAP. Inbound mail is one idempotent observation and never authority; mail from the agent's own address is refused. | openinstinct `email/agent-email.ts` (*docs only*); open-instinct `principal.ts` | Sharpen |
| 43 Owner routines | A routine is a row with a revision, an enabled flag, an optional expiry, and run-now. An empty result sends nothing. One catch-up run. | openinstinct `monitors/types.ts`, `triggers.ts`; open-instinct `core/src/scheduler.ts` | Sharpen |
| 44 Persistent session and context | Reuse Pi for the session, steering, compaction, and server threads. Run turns, reloads, and compactions in one serial queue, compacting only after a turn settles. Use Pi's absolute thresholds (reserve 16,384, keep 20,000 recent tokens) instead of a 50% rule. Roll the session only after two context failures and a failed compaction. Pin "no tool diff" only on models without mid-conversation tool changes. Pass Jaari's own client identity. | Pi `durable/src/harness/agent.ts` (`DEFAULT_COMPACTION_POLICY`); openinstinct `main.ts`; gajae-way `docs/monitors.md` (*docs only*) | Change (was 50% and a byte-identical tool list) |
| 45 Multimodal memory | Stay deferred; no reference stores attachments as memory. | none | Keep |
| 46 Owner panel | No reference has one (they use the host's dashboard). Keep the leaning. | none | Keep |
| 47 Shadow mode | No reference has it. Keep 14 days, and add: an observe-only job fails closed on any effect. | openinstinct `assistant-work/tool-gate.ts` | Keep |
| 48 Threat model | Use an actor by attack by control table with an explicit "not protected against" list, and add rows for MCP servers, skills, nodes, and capability packages. | open-instinct `docs/SECURITY.md` (*docs only*) | Sharpen |
| 49 Onboarding conversation | An onboarding skill: one question per message, save each answer at once, in the order name, city and time zone, messaging style, apps, people, daily brief. Never ask for a password. | open-instinct `skills/onboarding/SKILL.md` | Sharpen |
| 50 Capability packages | No reference has a package manifest. Keep the leaning; an unknown capability or skill fails closed. | gajae-way `subsession/src/skills.ts` | Keep |

### H. From the OpenMausBot study

| OQ | Recommendation | Borrowed from | Verdict |
|---|---|---|---|
| 51 Standing grants | Keep "read-shaped only" for v1. Note the references disagree: openinstinct allows standing rules only for sends (exact recipient, topic, and action, no wildcards) and nothing else. Take its form, not its scope: exact match, revision-fenced, re-checked at dispatch, revoked by id. Revisit sends after shadow mode shows what the owner approves repeatedly. | openinstinct `assistant-work/owner-policy.ts`; open-instinct `core/src/policy.ts` | Keep |
| 52 Inbound triggers | HMAC-SHA256 over delivery id, timestamp, and raw body with a 300 s window and a nonce, instead of a bearer header. Write the receipt to disk before acknowledging. A separate listener that serves only health and hook paths, loopback by default. Body cap 256 KiB to 1 MiB. | open-instinct `inkbox/src/signature.ts`, `inbox.ts`, `server/src/http.ts`; gajae-way `docs/monitors.md` (*docs only*) | Change (was a bearer secret) |
| 53 Memory capture evidence | Two layers. Raw capture is mechanical and append-only, and canonicalize fails if a raw file changed. The quote check on derived facts stays as in the leaning (only OpenMausBot does it). Commit trailers: mutation id, actor, source session. | openinstinct `memory/adapters/capture.ts`, `canonicalize.ts`; learning/09 | Sharpen |
| 54 Outside lineage | Start with one deterministic bit per run: who started it (owner message, schedule, inbound event, third-party content). A run not started by the owner's own message cannot settle approvals. Sticky lineage across spawned work as in the leaning. | open-instinct `core/src/runtime.ts`, `policy.ts`; openinstinct `assistant-work/observation.ts` | Sharpen |
| 55 External control surface | A local Unix socket at mode 0600 speaking NDJSON with version negotiation; status can read but never approve. A long wait exits with a distinct "still running" code and a reference to check later. | openinstinct `control/socket.ts`, `control/schema.ts`; gajae-way `docs/memory.md` (*docs only*) | Sharpen |
| 56 Subscription CLI engines | Keep "not the main session". Pi's `RpcClient` makes Pi itself the first CLI engine a sandboxed child could drive. | Pi `coding-agent/docs/rpc.md` (*docs only*) | Keep |

## 4. Where Jaari differs, and what is open after this study

**Three changes to current leanings**, each needing the owner's call: OQ-03 (BM25 scan before
FTS5), OQ-44 (Pi's compaction thresholds and tool-change handling instead of 50% and a
byte-identical tool list), OQ-52 (HMAC instead of a bearer secret). A fourth, smaller one:
OQ-22 (lockstep releases instead of changesets).

**One new decision this study surfaced:** whether `@jaari/core` builds on `pi-agent-core`
with Jaari's own queue, or on `pi-durable` as both loop and job engine. Recommended here:
`pi-agent-core` now, with the durable contract copied in shape, and a revisit when
`pi-durable` leaves Experimental. It touches ADR-001 and OQ-05.

**Things to set when wrapping Pi:** tool execution `sequential` (the default is parallel, and
the gate approves one digest at a time); Jaari's own client identity (the default names Pi);
Jaari's retry classifier in front of Pi's agent-level retry; a refusal arrives as
`stopReason: "error"`, not as its own stop reason, which ADR-011's refusal rule must handle.

**Where a reference's doc and code disagree** (trust the code): openinstinct's architecture
doc gives a 45-minute monitor cadence and 8 s presence idle, the code has 30 minutes and 3 s;
a comment says the SDK owns compaction while the daemon disables it and compacts at 50%.

**Still without any precedent:** OQ-08, OQ-28, OQ-29, OQ-33, OQ-37, OQ-45, OQ-46, OQ-50.

**Numbers worth keeping.** Children: 4 concurrent, 16 live, 30 min timeout. Watchdog: 300 s.
Outbox: 5 s, 25 s, 125 s; duplicate window 10 min. Retry ladder for jobs: 0, 10 min, 1 h,
4 h, 12 h. Orientation block: 6,000 chars. Canonicalize pass: 20 files, 64 KiB, 45 min.
Pi compaction: reserve 16,384, keep 20,000, background 32,768 tokens. MCP result cap: 20 KB.
Claim code: 8+ chars, 10 tries. Webhook: 300 s window. Takeover wait: 600 s. Skill file:
64 KB. Managed HTTP: 15 s, 64 KiB default, 1 MiB max. Operational retention: 7 days.
