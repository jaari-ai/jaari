# Jaari: Open questions

Last updated: 2026-11-10. Open: **55**.

How to resolve one: decide → write or update an ADR → move the row to *Resolved* with
the ADR link. "Leaning" is a suggestion, not a decision.

A recommendation per question, with the reference it is borrowed from, is in
[learning/10-open-questions-review.md](learning/10-open-questions-review.md) (proposals; the
leanings below are unchanged until the owner accepts them).


## A. Blocking soon (Phase 0 to 2)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-03 | Memory retrieval | grep, SQLite FTS5, embeddings, or hybrid? Which embedding provider (local or API tier)? | 1 | FTS5 first, embeddings as optional layer. OpenMausBot ships word-match FTS only, with a fixed recall budget (4 notes and 4 passages); that supports FTS5 first |
| OQ-04 | Context assembly | Who decides what memory enters each prompt? How are long sessions compacted? | 1 | Deterministic assembler with token budget per section. Split the prompt into a stable and a volatile part; recalled memory goes in front of the owner's message, fenced as data, never into the cached prefix (learning/09) |
| OQ-05 | Scheduler | One job engine for canonicalize, audit, reminders, children: persistence, retries, crash recovery, missed runs during sleep, time zones | 1 | SQLite-backed queue in the daemon. A job tree with an append-only events table whose status can be rebuilt from its events; a turn cut by a restart reruns at most once and never after an effectful action (ADR-016) |
| OQ-06 | Concurrent memory writes | Lock, single writer queue, or branch-per-task then merge? | 1 | Single writer; others enqueue patches |

## B. Before daily use

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-07 | Backup and restore | Encrypted git remote for memory, SQLite backup (e.g. Litestream), secret store backup, restore drill | 3 | All three + a scripted restore test |
| OQ-08 | Encryption at rest | age vs git-crypt for memory; how to purge a secret that reached git history | 3 | Undecided |
| OQ-09 | Forgetting and retention | "Forget this" command; raw daily log retention; does forgetting rewrite git history? | 3 | Undecided. Superseded facts are struck through with a date, not deleted; a forgotten-fact list stops canonicalize relearning them (learning/09) |
| OQ-10 | Deployment | Host choice decided by ADR-015 and ADR-017 (VPS, remote server, home hardware, or laptop). Still open: overlay network details (Tailscale first, Headscale or WireGuard documented), reference sizing per target. The Compose layout and migrations moved to OQ-35 | 7 | Tailscale first, Headscale documented; no public ports; sizing table per target |
| OQ-11 | Kill switch | Global pause, loop step limits, max concurrent children, spend-spike alerts | 3 | All four, enforced in code. Add a stall guard: two continuations without a successful tool call, or three identical errors, end the job as stalled; lowering a capability's permission also stops the running turn |
| OQ-12 | Observability | Tracing per turn/tool/child (OpenTelemetry?), admin page for jobs, approvals, usage, errors | 7 | OTel + small local admin page. One canonical event union plus a raw provider tee to spot protocol drift; that log is for inspection, `audit.jsonl` stays the record |
| OQ-13 | Notification delivery | Proactive messages via channel or push (ntfy, Pushover); urgent vs digest routing | 2 | Channel first, ntfy optional. OpenMausBot's notification QA rules become monitor fixtures: finished only with a non-empty result, one alert per failure and cause, every notification links to its exact thread, read state synced across clients |

## C. Tools and plugins

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-14 | MCP client and plugins | Load third-party MCP servers or skills? Permissions, sandboxing, gate coverage per tool | 4 | Allowlisted servers, each tool mapped to a capability. Standing grants carry a SHA-256 of the server config so an edit revokes them; a server's own readOnlyHint is never trusted; a server the model proposes arrives switched off behind a digest-bound approval; tool results are size-capped (learning/09) |
| OQ-15 | Code execution | Python/shell sandbox: reuse Docker/Firecracker backends? Network and resource limits? | 7 | Reuse backends, no network by default. bubblewrap-style profile with a boot self-check and mutation tests that remove one protection at a time; provider keys replaced by per-process broker tokens (learning/09) |
| OQ-16 | Voice | STT (whisper.cpp vs Deepgram) and TTS (Piper/Kokoro vs ElevenLabs), local-or-API like the LLM | later | Undecided. Spoken approvals need a strict grammar: the answer opens the utterance and is an unconditional yes or no; what is approved is still the digest |
| OQ-17 | Documents and files | PDF/Office parsing, OCR, drop-folder inbox, attachment storage | 5 | Undecided |
| OQ-18 | Personal data | Calendar (CalDAV/Google), contacts, notes, file storage | 5 | Calendar first (biggest proactive value) |
| OQ-19 | Payments rail | Virtual cards with per-merchant limits, or no payments in v1? | later | No payments in v1 |

## D. Quality and process

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-20 | Behaviour evals | Fixtures for staying quiet, asking before acting, persona adherence; session replay | 2 | Record/replay harness in Phase 2, fixtures grow over time. Evaluate the harness, not the model: a hermetic scripted engine, JSON scenarios, pure scorers, redacted golden threads (learning/09) |
| OQ-21 | Prompt versioning | Version system prompts and persona files; trace and roll back changes | 2 | Prompts as files in repo, version in every log line |
| OQ-22 | Project process | SECURITY.md and disclosure contact, release/versioning policy, contribution rules (DCO or CLA?). License decided: MIT (ADR-014) | 0 | security@jaari.org, changesets, DCO sign-off |
| OQ-23 | Multiple users | Strictly single owner, or household members with limited access? | 0 | Single owner; keep user id in data model |

## E. Carried over from ADR-011 to ADR-013

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-24 | Local model per target | Size classes per deployment target are set in [LLM.md](LLM.md#local-models-per-target). Open: which concrete open-weight model passes the `jaari llm eval` fixtures (tool calls, JSON validity, canonicalize golden set, injection resistance) for the small and medium tiers on each target, and which to suggest at `jaari init`. | 1 | Measure with `jaari llm eval` per target; ship a suggested-models list that is data, refreshed as models change, never hard-coded |
| OQ-25 | LLM budget | Default monthly LLM budget? | 3 | $30/month placeholder |
| OQ-26 | Canonicalize privacy | Should canonicalize be local-only by default? | 1 | Yes, if a capable local model exists |
| OQ-27 | Browser tool surface | Provider-neutral `browser.*` / `computer.*` members run by Jaari's own driver (Playwright/CDP, Stagehand), or the vendor-native toolsets (Anthropic `browser_toolset_20260801` / `computer_toolset_20260801`, Gemini `computer_use`) mapped per routed model? `pi-ai` has no toolset support today, and a native toolset reaches the gate only through the driver's `confirm` hook. Driver hygiene against automation markers (Patchright-level) is part of this; full anti-detect browsers are not (see learning/08). Background: [learning/07-computer.md](learning/07-computer.md) | 6 | Neutral surface shaped like the Anthropic member set; native toolsets as an `@jaari/llm` mapping where the routed model supports them |
| OQ-28 | Lightpanda | Is Lightpanda worth running, or is http + Chromium enough? | 4 | Decide from fetch-ladder usage logs |
| OQ-29 | Vault verification | Confirm against vendor docs before Phase 3: does Bitwarden Lite need a paid licence for anything ADR-013 uses (Secrets Manager is optional)? Exact 1Password SDK and service-account setup for a personal account? | 3 | Bitwarden password-manager API via `bw serve` is enough; Secrets Manager not required |

## F. Carried over from the computer-use research (learning/07-computer.md, 08-egress-identity-and-takeover.md)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-30 | Consequential browser actions | A purchase, a sent message, or accepted terms arrives as an ordinary `left_click` / `type`; Anthropic's own `confirm` hook "can't pick them out by name". How does the gate recognise them: deterministic page heuristics, a reader-role check of the page state, or approval on every click within flagged origins? | 6 | Deterministic heuristics (submit controls, payment and consent URL patterns) escalate to a reader-role check; never an LLM alone (principle 9). A classifier that cannot read the action to the end returns unreadable, which means ask the owner (ADR-016) |
| OQ-31 | Screenshots as untrusted content | Do screenshots and accessibility trees fall under the reader-role rule (principle 8)? A reader pass per screenshot is too slow for a click loop, and vendor prompt-injection classifiers run only on native toolsets. | 6 | Gate + egress allowlist + classifier where available; log every action with its screenshot (OQ-12). While a filled secret is on the page, screenshots and page evaluation are refused until the field is cleared (ADR-016) |
| OQ-32 | Egress pool details | ADR-017 fixes the shape: an egress pool of `owner-exit` (Tailscale, Headscale, WireGuard), `direct`, `mobile`, and `residential-proxy` providers; rotation for anonymous traffic only (owner exit nodes may join the rotation), owner accounts pinned to one owner node. Open: the provider interface, rotation and health-check policy, which residential providers pass the sourcing check, 4G dongle setup, and the home-sites list format. Background: [learning/08-egress-identity-and-takeover.md](learning/08-egress-identity-and-takeover.md) | 6 | Provider interface in `@jaari/http` with `owner-exit` and `direct` first (Phase 4 for fetch, Phase 6 for the browser); residential and mobile providers opt-in later. Home-sites split from OpenMausBot: a short owner-set list of the owner's accounts goes through an owner node, which re-checks each connection itself (ports 80 and 443, never its own LAN); everything else leaves direct. OpenMausBot measured routing all traffic home as 1.7 to 30 times slower (learning/09). Owner-account sessions refuse when no owner exit is up |
| OQ-33 | Signed-agent identity | Should `@jaari/http` and the browser sign requests per Web Bot Auth (RFC 9421, `Signature-Agent`, JWKS at `/.well-known/http-message-signatures-directory`)? Cloudflare's Signed Agents registry is per operator via the dashboard; it is unknown whether an individual self-hoster can register. | 4 | Implement signing with a per-install Ed25519 key; registration decided when the registry policy is known |
| OQ-34 | Takeover transport | How does the owner see and touch the agent's browser from a phone within seconds: CDP screencast in the web panel, noVNC over loopback, or a hosted live view? Takeover states, timeouts, and the rule that screenshots stop while the owner holds the session. | 6 | CDP screencast in `@jaari/channel-web` over Tailscale; a "Take over" link pushed through the active channel; states pending/active/completed/timeout/cancelled. Hold semantics are in ADR-016 (owner-held, drain then hand over, refuse rather than queue, 2-minute grace and 5-minute idle release); only the transport stays open |

## G. From the 2026 gap review (2026-11-09)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-35 | Install, update, migrate | One-command install per target of ADR-017 (Compose on a VPS or home box, brew or a single binary on a laptop), the Compose layout, `jaari doctor`, an update channel, and versioned config and memory schemas with migrations run at start. Nothing is specified today. | 0 | Compose + a single `jaari` binary; `jaari init` asks for the target; schema version in config and in the memory repo; migrations idempotent and run on daemon start |
| OQ-36 | Laptop as host | The laptop as a daemon host (ADR-017 target 3) and as a node: sleep and wake, network changes, battery, and the macOS permission matrix per capability (Automation, Accessibility, Screen Recording, Full Disk Access). Meta publishes none of this for Muse. Sleep and wake is needed in Phase 0; the permission matrix with the desktop capability in Phase 6. | 0 | Published permission matrix per capability manifest; in laptop-only mode, jobs missed in sleep run once on wake, capped |
| OQ-37 | Multi-device state | With ADR-015, how nodes and the daemon reconnect, and how the daemon moves between hosts (laptop, VPS, home server, in any direction). | 7 | The daemon host is authoritative (ADR-015); memory pushed to an encrypted git remote (OQ-07); nodes hold no state; `jaari migrate-host` exports and imports. Node link: a Noise handshake with a QR-pinned daemon key over the overlay network; a relay, if one is ever added, must see only ids, timing, and volume (learning/09) |
| OQ-38 | Degraded mode | Behaviour when the API tier is unreachable, the budget is spent, or a node is offline: what queues, what runs locally, what the owner is told. | 3 | Effectful work queues with expiry; local-only roles keep running; one notice per outage. Fall back only when the turn provably never started, and only to a model that has the same tools; remember provider limit-reset times instead of probing |
| OQ-39 | Skills and procedural memory | Skills as versioned Markdown playbooks (OpenClaw `SKILL.md`, open-instinct `skills/`, Anthropic Agent Skills): where they live, how they are installed, who approves them, how a skill becomes memory. | 2 | Playbooks in the memory repo under `ops/rules`, project `skills/` for built-ins; installing a third-party skill is a gated action; the reader role screens skill text. Scan skill text before install (base64 blobs, piped shell installs, invisible Unicode); third-party skills install disabled; exports scrub secrets (learning/09) |
| OQ-40 | Learning from outcomes | Failure receipts, `reflections → rules` promotion (gajae-way), router tuning from the outcome log. Today only the notification ledger learns. | 8 | Receipts write to `reflections`; the daily audit proposes promotions the owner confirms |
| OQ-41 | OAuth broker | Connected apps (Google, Microsoft, Slack) need tokens the model never sees: storage, refresh, scope-to-capability mapping, revocation, admin consent. | 5 | Tokens in the vault (ADR-013), resolved per call like `secretRef`; one scope set per capability; revoke from CLI and panel. Tool grants per capability are enforced on the real tool name at call time and logged; with several accounts connected, the account is always chosen explicitly |
| OQ-42 | The agent's own mailbox and number | A mailbox for one-time codes, receipts, and confirmations (Grok Bot, Instinct), and later a phone number (Instinct phones businesses). Inbound mail stays data (reader role). | 5 | Mailbox on the owner's domain, IMAP, read by the reader role; telephony after voice (OQ-16) |
| OQ-43 | Owner routines | "Every morning summarise X", "watch this price": routines as owner-visible objects (cron, watcher, webhook) with pause, history, and budgets; all output through the persona monitor. | 1 | Routines are rows the owner can list and pause; built on the scheduler (OQ-05); children do the work. Schedule semantics from OpenMausBot: anchor-aligned intervals, overlap skip or queue, one catch-up run within 12 hours and a missed-run receipt otherwise; plain-code checks run before any model call, and a run with nothing new posts nothing (learning/09) |
| OQ-44 | Persistent session and context | One main session reopened over its transcript across restarts, steering, segment flushing, daemon-managed compaction, a stable prompt prefix for caching, and how 2026 API features (server compaction, threads) are used. | 0 | openinstinct's session semantics on Pi; compaction at ~50% of the window; stable prefix first. Keep the tool list byte-identical across a session's turns (pinned by a test); cache keep-warm only behind a cost guard (learning/09) |
| OQ-45 | Multimodal memory | Photos, receipts, and screenshots as memory, and what the audit does with them. | later | Undecided |
| OQ-46 | Owner panel | `channel-web` as a PWA: approval cards showing the digest, live view (OQ-34), a memory browser and editor, audit viewer, budgets, kill switch (OQ-11), push (OQ-13). | 2 | One PWA over Tailscale; memory editing commits like any other write |
| OQ-47 | Shadow mode | Observe-and-propose only for the first weeks: drafts instead of sends, plans instead of actions; the owner lifts it per capability. | 3 | On by default for 14 days; per-capability lift recorded in `audit.jsonl` |
| OQ-48 | Threat model | An enumerated `THREAT_MODEL.md`: injection via pages and screenshots, malicious MCP server or skill, compromised node, stolen phone, malicious channel plugin, poisoned memory. | 3 | Write it before Phase 3 code; one mitigation column per threat |
| OQ-49 | Onboarding conversation | The first conversation and first week: profile bootstrap, what is asked and what is inferred, when dials are explained. | 2 | An onboarding skill; ask only what the next task needs |
| OQ-50 | Capability packages | ADR-015 makes capabilities installable units with a manifest. Open: manifest schema, where packages come from (npm `@jaari/capability-*`, local path), signing and update, how a capability declares and checks its OS permissions and sidecars (Xvfb or a desktop container for `computer.use` on a VPS), and how this relates to MCP servers (OQ-14) and skills (OQ-39). The owning package is `@jaari/capabilities` and the names come from one vocabulary (ADR-018). | 0 | Manifest schema and the in-process loader in Phase 0; npm packages with provenance, installed by `jaari capability install`; an MCP server can back a capability but never bypasses its manifest. Native sidecars pinned by SHA-256 and size with an SBOM and no runtime self-update; policy reads capability flags from the manifest, never package names (learning/09) |

## H. From the OpenMausBot study (learning/09-openmausbot.md, 2026-11-10)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-51 | Standing grants | ADR-006 approves one action per digest. Daily use needs some "always allow": which capabilities may have a standing grant, what it is keyed on, how it expires, and how the owner lists and revokes them. OpenMausBot keys grants on the exact command plus working directory, and MCP read grants on a hash of the server config. | 3 | Standing grants only for read-shaped capabilities and exact-match actions; keyed on capability, target, and a fingerprint of the tool's config so any edit revokes; never for send, submit, publish, pay, or `repo.write`; every use is an `audit.jsonl` row naming the grant |
| OQ-52 | Inbound triggers | Webhooks and app events that start work ("when this form posts", "when mail from X arrives"): receiver isolation, secret handling, dedup, rate limits, and how events reach a host with no public port. Routines (OQ-43) cover time; this covers events. | 5 | A separate loopback listener that serves only health and hook paths; a per-hook secret stored as a hash and compared in constant time, sent as a Bearer header; body cap, rate limit, dedup by delivery id; the payload is untrusted content for the reader role; exposure through the overlay network (Tailscale Funnel), with polling as the default for apps; no hosted broker |
| OQ-53 | Memory capture evidence | What stops capture and canonicalize from writing an invented fact about the owner? OpenMausBot requires each captured fact to quote the person's words, and code checks that the quote exists and that every number, path, and URL in the fact comes from it. Also: how a memory commit records who caused it. | 1 | Capture emits fact plus quote; code verifies the quote against the owner's turns and rejects facts with unquoted numbers, paths, or URLs; questions, tasks, and hypotheticals are not facts; each memory commit carries trailers for actor (owner, agent, canonicalize, audit) and source session |
| OQ-54 | Outside lineage | The reader role summarises untrusted content, but work started because of that content (a mail that leads to a child, a webhook that leads to a draft) still carries its influence. Does that origin stick to everything derived from it, and what does it restrict? | 4 | Sticky origin: a job caused by untrusted content is marked outside, and so is everything it spawns; outside jobs get a reduced capability set (read and draft, no send), cannot use standing grants, and their memory writes need an approval that shows the full text |
| OQ-55 | External control surface | Should other tools drive Jaari: a headless `jaari run` / `jaari wait` for scripts, and an MCP server for desktop clients? What must such a surface never expose? | 4 | `jaari run`, `wait`, and `export` with one JSON document and typed exit codes (needs input, timeout) in `apps/cli`; an MCP server later that can inspect and start work but never approves, changes credentials, deletes, or edits policy; long-poll waits, a paired token for anything that mutates |
| OQ-56 | Subscription CLI engines | OpenMausBot runs bots on the owner's installed `claude`, `codex`, and other CLIs (27 drivers, including Pi over `pi --mode rpc`), so work is billed to an existing subscription. Should a Jaari child be able to delegate a task to such a CLI? The gate cannot see tool calls inside another loop, and provider terms differ. | 4 | Not for the main session (ADR-001). Possibly for isolated children on code tasks, inside a sandbox with no secrets and no effectful capabilities, with the CLI's permission requests answered by the gate; check each provider's terms first |

## I. Left over from the docs conflict audit (2026-11-10)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-64 | Accept ADR-013 | ADR-011 and ADR-012 were accepted (ADR-019). ADR-013 (vault providers) is still Proposed and depends on OQ-29: Bitwarden Lite licence needs and the 1Password service-account setup are unverified. | 3 | Verify OQ-29 against vendor docs, then accept ADR-013 before the vault providers ship; the Phase 0 `os-keychain` provider does not depend on it (ADR-018) |

## Resolved

| ID | Decision | ADR |
|---|---|---|
| OQ-22 (license part) | MIT | [ADR-014](adr/014-license-mit.md) |
| OQ-10 (host part) | Daemon on an always-on host (VM, VPS, or server); laptop-only supported by configuration | [ADR-015](adr/015-control-plane-and-nodes.md) |
| OQ-57 | Self-hosted on a VPS, remote server, or home hardware; placement rule keeps identity-bearing browsers on the owner's network identity; egress pool with owner exit nodes | [ADR-017](adr/017-self-hosted-anywhere.md) |
| OQ-58 | One capability vocabulary; host and provider are manifest fields; `pay` reserved | [ADR-018](adr/018-capability-vocabulary-and-phase-0-floor.md) |
| OQ-59 | Short code is a digest lookup; no tolerance; 15-minute default expiry, 5 for send and publish | [ADR-018](adr/018-capability-vocabulary-and-phase-0-floor.md) |
| OQ-60 | Phase 0 ships the resolver and an `os-keychain` provider | [ADR-018](adr/018-capability-vocabulary-and-phase-0-floor.md) |
| OQ-61 | Deny-all gate stub in Phase 0; third-party skills disabled until the reader role exists | [ADR-018](adr/018-capability-vocabulary-and-phase-0-floor.md) |
| OQ-62 | Phases are soft; blocker phases corrected (OQ-32, OQ-36, OQ-10, OQ-20) | [ADR-020](adr/020-soft-phases-and-v1-scope.md) |
| OQ-63 | Trust tiers, peers, payments, and voice deferred; wording corrected | [ADR-020](adr/020-soft-phases-and-v1-scope.md) |
| OQ-64 (ADR-011, ADR-012 part) | ADR-011 and ADR-012 accepted; ADR-013 remains open as OQ-64 | [ADR-019](adr/019-model-pinning-and-local-only-defaults.md) |
| OQ-65 | Main session pinned; outage failover at a turn boundary with one notice | [ADR-019](adr/019-model-pinning-and-local-only-defaults.md) |
| OQ-66 | Local-only canonicalize decided at `jaari init` by `jaari llm eval` | [ADR-019](adr/019-model-pinning-and-local-only-defaults.md) |
| OQ-01 | CLI, web panel, and Telegram in v1; email as input only (Phase 5); WhatsApp and iMessage first after v1 | [ADR-021](adr/021-v1-channels.md) |
| OQ-02 | Ingress mints authority; paired channels are equal; one active channel (latest inbound); pluggable pairing into one hashed device registry; immediate revoke | [ADR-022](adr/022-owner-authentication-and-active-channel.md) |
