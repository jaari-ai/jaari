# Jaari: Open questions

Last updated: 2026-11-10. Open: **17**.

How to resolve one: decide → write or update an ADR → move the row to *Resolved* with
the ADR link. "Leaning" is a suggestion, not a decision.

A recommendation per question, with the reference it is borrowed from, is in
[learning/10-open-questions-review.md](learning/10-open-questions-review.md) (proposals; the
leanings below are unchanged until the owner accepts them).


## A. Blocking soon (Phase 0 to 2)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|

## B. Before daily use

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|

## C. Tools and plugins

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|

## D. Quality and process

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|

## E. Carried over from ADR-011 to ADR-013

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|

## F. Carried over from the computer-use research (learning/07-computer.md, 08-egress-identity-and-takeover.md)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|

## G. From the 2026 gap review (2026-11-09)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-41 | OAuth broker | Connected apps (Google, Microsoft, Slack) need tokens the model never sees: storage, refresh, scope-to-capability mapping, revocation, admin consent. | 5 | Tokens in the vault (ADR-013), resolved per call like `secretRef`; one scope set per capability; revoke from CLI and panel. Tool grants per capability are enforced on the real tool name at call time and logged; with several accounts connected, the account is always chosen explicitly Affected by ADR-039: Google and Microsoft calendar, contacts, and Drive are the first broker users; each account is configured separately. |
| OQ-42 | The agent's own mailbox and number | A mailbox for one-time codes, receipts, and confirmations (Grok Bot, Instinct), and later a phone number (Instinct phones businesses). Inbound mail stays data (reader role). | 5 | Mailbox on the owner's domain, IMAP, read by the reader role; telephony after voice (OQ-16) Affected by ADR-037: each outbound call needs its own approval and never uses a standing grant; live calls run half-duplex with narration. |
| OQ-43 | Owner routines | "Every morning summarise X", "watch this price": routines as owner-visible objects (cron, watcher, webhook) with pause, history, and budgets; all output through the persona monitor. | 1 | Routines are rows the owner can list and pause; built on the job engine (ADR-025); children do the work. Schedule semantics from OpenMausBot: anchor-aligned intervals, overlap skip or queue, one catch-up run within 12 hours and a missed-run receipt otherwise; plain-code checks run before any model call, and a run with nothing new posts nothing (learning/09). Requirement from the owner (ADR-023): connecting email creates a default inbox-watch routine; dated mail becomes events and bills become draft ledger lines. Affected by ADR-033: each digest is a routine with its own time; a digest named without a time gets a proposed time the owner confirms. Affected by ADR-036: a routine that runs a script is approved at creation and pinned to its content; any change holds it. |
| OQ-44 | Persistent session and context | One main session reopened over its transcript across restarts, steering, segment flushing, daemon-managed compaction, a stable prompt prefix for caching, and how 2026 API features (server compaction, threads) are used. | 0 | openinstinct's session semantics on Pi; compaction at ~50% of the window; stable prefix first. Keep the tool list byte-identical across a session's turns (pinned by a test); cache keep-warm only behind a cost guard (learning/09) Affected by ADR-042: the Stable layer fingerprint is logged per turn and the byte-identical test is required. |
| OQ-45 | Multimodal memory | Photos, receipts, and screenshots as memory, and what the audit does with them. | later | Undecided Affected by ADR-037: voice-note audio is kept 30 days and its transcript in the raw log; photos and screenshots remain open here. Affected by ADR-038: photos and screenshots use the same store, OCR ladder, and retention. |
| OQ-46 | Owner panel | `channel-web` as a PWA: approval cards showing the digest, live view (ADR-055), a memory browser and editor, audit viewer, budgets, pause and emergency stop (ADR-031), web push while the panel is the active channel (ADR-033). | 2 | One PWA over Tailscale; memory editing commits like any other write Affected by ADR-035: the panel renders prompts with buttons and hosts the details and secret-entry links other channels point to. |
| OQ-47 | Shadow mode | Observe-and-propose only for the first weeks: drafts instead of sends, plans instead of actions; the owner lifts it per capability. | 3 | On by default for 14 days; per-capability lift recorded in `audit.jsonl` |
| OQ-48 | Threat model | An enumerated `THREAT_MODEL.md`: injection via pages and screenshots, malicious MCP server or skill, compromised node, stolen phone, malicious channel plugin, poisoned memory. | 3 | Write it before Phase 3 code; one mitigation column per threat Affected by ADR-034: the malicious-MCP-server row lists its mitigations (pinned tool list, untrusted text, sandbox, `mcp.act` default). |
| OQ-49 | Onboarding conversation | The first conversation and first week: profile bootstrap, what is asked and what is inferred, when dials are explained. | 2 | An onboarding skill; ask only what the next task needs |
| OQ-50 | Capability packages | ADR-015 makes capabilities installable units with a manifest. Open: manifest schema, where packages come from (npm `@jaari/capability-*`, local path), signing and update, how a capability declares and checks its OS permissions and sidecars (Xvfb or a desktop container for `computer.use` on a VPS), and how this relates to MCP servers (OQ-14) and skills (OQ-39). The owning package is `@jaari/capabilities` and the names come from one vocabulary (ADR-018). | 0 | Manifest schema and the in-process loader in Phase 0; npm packages with provenance, installed by `jaari capability install`; an MCP server can back a capability but never bypasses its manifest. Native sidecars pinned by SHA-256 and size with an SBOM and no runtime self-update; policy reads capability flags from the manifest, never package names (learning/09) Affected by ADR-034: MCP tools map to vocabulary names, `mcp.read` or `mcp.act` when none fits; the server-and-tool mapping is a manifest. |

## H. From the OpenMausBot study (learning/09-openmausbot.md, 2026-11-10)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-51 | Standing grants | ADR-006 approves one action per digest. Daily use needs some "always allow": which capabilities may have a standing grant, what it is keyed on, how it expires, and how the owner lists and revokes them. OpenMausBot keys grants on the exact command plus working directory, and MCP read grants on a hash of the server config. | 3 | Standing grants only for read-shaped capabilities and exact-match actions; keyed on capability, target, and a fingerprint of the tool's config so any edit revokes; never for send, submit, publish, pay, or `repo.write`; every use is an `audit.jsonl` row naming the grant Affected by ADR-034: MCP grants are keyed on the server's config and tool-list fingerprint. Affected by ADR-036: code execution already has Allow once and 90-day per-target grants, plus pinned recurring jobs; this question extends or limits that model for other capabilities. Affected by ADR-039: own-calendar writes without attendees may have a 90-day grant; invitations never. Affected by ADR-044: grants are keyed per owner, and later cover another person's Jaari (per person, per capability). |
| OQ-52 | Inbound triggers | Webhooks and app events that start work ("when this form posts", "when mail from X arrives"): receiver isolation, secret handling, dedup, rate limits, and how events reach a host with no public port. Routines (OQ-43) cover time; this covers events. | 5 | A separate loopback listener that serves only health and hook paths; a per-hook secret stored as a hash and compared in constant time, sent as a Bearer header; body cap, rate limit, dedup by delivery id; the payload is untrusted content for the reader role; exposure through the overlay network (Tailscale Funnel), with polling as the default for apps; no hosted broker |
| OQ-53 | Memory capture evidence | What stops capture and canonicalize from writing an invented fact about the owner? OpenMausBot requires each captured fact to quote the person's words, and code checks that the quote exists and that every number, path, and URL in the fact comes from it. Also: how a memory commit records who caused it. | 1 | Capture emits fact plus quote; code verifies the quote against the owner's turns and rejects facts with unquoted numbers, paths, or URLs; questions, tasks, and hypotheticals are not facts; each memory commit carries trailers for actor (owner, agent, canonicalize, audit) and source session. Affected by ADR-023: typed records already require a source quote checked by code; this question now covers free-text facts and commit trailers. Affected by ADR-047: canonicalize rejects a changed profile line without a source quote from a daily file. |
| OQ-54 | Outside lineage | The reader role summarises untrusted content, but work started because of that content (a mail that leads to a child, a webhook that leads to a draft) still carries its influence. Does that origin stick to everything derived from it, and what does it restrict? | 4 | Sticky origin: a job caused by untrusted content is marked outside, and so is everything it spawns; outside jobs get a reduced capability set (read and draft, no send), cannot use standing grants, and their memory writes need an approval that shows the full text |
| OQ-55 | External control surface | Should other tools drive Jaari: a headless `jaari run` / `jaari wait` for scripts, and an MCP server for desktop clients? What must such a surface never expose? | 4 | `jaari run`, `wait`, and `export` with one JSON document and typed exit codes (needs input, timeout) in `apps/cli`; an MCP server later that can inspect and start work but never approves, changes credentials, deletes, or edits policy; long-poll waits, a paired token for anything that mutates |
| OQ-56 | Subscription CLI engines | OpenMausBot runs bots on the owner's installed `claude`, `codex`, and other CLIs (27 drivers, including Pi over `pi --mode rpc`), so work is billed to an existing subscription. Should a Jaari child be able to delegate a task to such a CLI? The gate cannot see tool calls inside another loop, and provider terms differ. | 4 | Not for the main session (ADR-001). Possibly for isolated children on code tasks, inside a sandbox with no secrets and no effectful capabilities, with the CLI's permission requests answered by the gate; check each provider's terms first Affected by ADR-034: a delegated CLI could run in the Phase 4 sandbox. |

## I. Left over from the docs conflict audit (2026-11-10)

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-64 | Accept ADR-013 | ADR-011 and ADR-012 were accepted (ADR-019). ADR-013 (vault providers) is still Proposed and depends on OQ-29: Bitwarden Lite licence needs and the 1Password service-account setup are unverified. | 3 | Verify OQ-29 against vendor docs, then accept ADR-013 before the vault providers ship; the Phase 0 `os-keychain` provider does not depend on it (ADR-018) Affected by ADR-050: the vendor check is done; no paid tier is required and the owner picks the vault layout. |

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
| OQ-03 | Typed structured records (13 built-in types plus custom) with code-computed values; SQLite FTS5 search as a rebuildable cache; embeddings later | [ADR-023](adr/023-structured-records-and-memory-search.md) |
| OQ-04 | Code-built layout with per-section budgets; 14-day window plus date-aware recall, a horizon line, and records.query for later dates; model may search more | [ADR-024](adr/024-context-assembly.md) |
| OQ-05 | Own SQLite job engine with an events table, per-tool replay flag, per-job catch-up window (default 12 h), DST rules, retry ladder; replaceable by pi-durable | [ADR-025](adr/025-scheduler-and-job-engine.md) |
| OQ-06 | One writer with the closure ladder and commit trailers; canonicalize submits patches, conflicts redone; owner edits committed separately and win | [ADR-026](adr/026-memory-single-writer.md) |
| OQ-07 | Memory pushed to owner-chosen git remotes; nightly (configurable) encrypted snapshots to local, NAS, or S3-compatible (S3, R2, B2, MinIO); advice not enforcement; recovery key; journaled restore; monthly drill | [ADR-027](adr/027-backup-and-restore.md) |
| OQ-08 | Scan writes for secrets; host relies on full-disk encryption (owner-managed volumes documented); age bundles or gcrypt for remotes not owned; plain only to own remotes; jaari memory purge | [ADR-028](adr/028-encryption-at-rest.md) |
| OQ-09 | Correction supersedes; forget removes and can always be undone; erase purges history through the gate; plain-language requests with preview; forget by source; raw logs kept, others' messages 30 days, operational rows 7 days | [ADR-029](adr/029-forgetting-and-retention.md) |
| OQ-10 | Owner picks and changes the overlay (Tailscale default, Headscale, WireGuard generated or existing, Cloudflare private network, custom); app-level auth; vpn egress class for anonymous traffic; sizing estimates | [ADR-030](adr/030-overlay-network-and-sizing.md) |
| OQ-11 | Durable pause and emergency stop; configurable step, child, stall, watchdog, loop, spend-spike, and failure-notice limits; 7-day quiet rule (configurable) | [ADR-031](adr/031-kill-switch-and-runaway-limits.md) |
| OQ-12 | Audit log, 30-day event log, usage log; OpenTelemetry and raw tee off by default, no prompts exported; jaari doctor checks; panel timeline | [ADR-032](adr/032-observability.md) |
| OQ-13 | Active channel is the push (silent vs alerting); one failure fallback; urgency from defaults then learned from the owner; owner-defined digests per category, time proposed from wake hours if unset | [ADR-033](adr/033-notification-delivery-and-digests.md) |
| OQ-14 | MCP via pi-mcp; owner-added servers; tools pre-classified in one confirm step (unknown is `mcp.act`); config and tool list pinned; local servers sandboxed from Phase 4, unsandboxed only with a per-server warning | [ADR-034](adr/034-mcp-servers.md) |
| OQ-15 | Phase 4 sandbox; sealed runs (no network, no secrets) never ask; otherwise Allow once or Always allow per target for 90 days; owner-chosen starter list at init; recurring jobs approved at creation and pinned to their content | [ADR-036](adr/036-code-execution.md) |
| OQ-16 | Voice notes in v1 via an `stt` role (local whisper.cpp default); spoken replies off by default, owner toggles them; spoken approvals hardened or bare yes, owner's choice; live calls after v1 | [ADR-037](adr/037-voice.md) |
| OQ-17 | Content-addressed store outside git; parsing ladder in the sealed sandbox; sensitive documents read by local models only; owner files kept with no quota, disk watch notifies at 80/90/95%; drop folder on host and nodes | [ADR-038](adr/038-documents-and-files.md) |
| OQ-18 | Calendar first (CalDAV, Google, Microsoft), free/busy, read, write split; own-calendar writes Allow once or 90-day grant, invitations always ask; direct requests added, passing mentions offered; contacts read-only sync; WebDAV and Drive native, others via MCP | [ADR-039](adr/039-personal-data.md) |
| OQ-19 | No `pay` executor in v1; checkouts stop at the payment step and the owner enters the card in a takeover; card fields stay unresolvable; later: one-time virtual cards, spend check, Allow once | [ADR-040](adr/040-no-payments-in-v1.md) |
| OQ-20 | Tier 1 scripted scenarios on the real daemon in CI; tier 2 owner corrections offered once as local redacted fixtures; tier 3 opt-in live tests with an LLM judge for tone only; `jaari replay` in shadow mode | [ADR-041](adr/041-behaviour-evals.md) |
| OQ-21 | Versioned prompt files; safety and system prompts locked; per-turn fingerprint; Jaari's persona edits are proposals | [ADR-042](adr/042-prompt-versioning.md) |
| OQ-22 | hello@jaari.org for all contact; DCO, no CLA; lockstep SemVer releases; pinned, aged, script-free dependencies | [ADR-043](adr/043-project-process.md) |
| OQ-23 | Single owner in v1; ownerId everywhere; one Jaari per person; multi-owner instance planned later; unknown-sender notice off by default | [ADR-044](adr/044-single-owner-multi-owner-later.md) |
| OQ-24 | suggested.json data file, no licence filter; qualification on the owner's machine; Ollama, llama.cpp, LM Studio, MLX | [ADR-045](adr/045-local-models.md) |
| OQ-25 | Budget suggested at init by preset ($30/$20/$0); 50% and 80% warnings; owner chooses at the limit, trade-offs explained the first 3 times | [ADR-046](adr/046-llm-budget.md) |
| OQ-26 | Local-only by default (ADR-019); bounded passes; sensitive lines never in an API batch; sourced lines; 20% deletion hold | [ADR-047](adr/047-canonicalize-privacy.md) |
| OQ-27 | Neutral browser.*/computer.* surface; pluggable adapters (remote desktop, MCP, providers, custom incl. spoofing); any egress route; native toolsets in Phase 6 | [ADR-048](adr/048-browser-surface-and-adapters.md) |
| OQ-28 | Pluggable fetch rungs; Lightpanda off by default, offered on small hosts; monthly on/off suggestion from usage logs | [ADR-049](adr/049-fetch-ladder-and-lightpanda.md) |
| OQ-29 | Verified: no paid tier needed; owner picks vault layout and Premium; one-time codes from vault, then owner's channels with a notice, then ask | [ADR-050](adr/050-vault-verification-and-one-time-codes.md) |
| OQ-30 | Deterministic classifier over six commitment classes; commitments Allow once; LLM may only escalate; classifier-only rollout | [ADR-051](adr/051-consequential-browser-actions.md) |
| OQ-31 | Browser driven by a worker child with task data only; strict task-scoped origins (review in Phase 6); fencing; screenshot redaction | [ADR-052](adr/052-browser-worker-and-untrusted-pages.md) |
| OQ-32 | Pluggable egress providers; one connection baseline; sticky-per-task rotation; 5-minute health probes; home sites suggested from vault logins | [ADR-053](adr/053-egress-pool.md) |
| OQ-33 | Web Bot Auth signing built, off by default, chosen per site; key directory on the owner's own domain only; registration revisited | [ADR-054](adr/054-signed-agent-identity.md) |
| OQ-34 | Per-adapter transport (CDP screencast, noVNC, provider live view) in one panel view; 10-minute wait then pause; pasted codes accepted and scrubbed | [ADR-055](adr/055-takeover-transport.md) |
| OQ-35 | Compose, npm, brew, binary, or one-line installer; patches auto-install in quiet hours, minor and major notify; migrations on store open | [ADR-056](adr/056-install-update-migrate.md) |
| OQ-36 | Clock-gap sleep detection; missed jobs run once (max 5); awake only while a job runs on mains; battery pause; macOS permission matrix | [ADR-057](adr/057-laptop-host-and-node.md) |
| OQ-37 | Pinned TLS node link; 1-hour result outbox; migrate-host asks about pending approvals (cancel or carry over); generation fencing; signed node handoff | [ADR-058](adr/058-node-link-and-host-migration.md) |
| OQ-38 | Per-dependency holds; send stamp; code-run control surface when models are down; owner messages answered automatically when back; 24 h task expiry | [ADR-059](adr/059-degraded-mode.md) |
| OQ-39 | SKILL.md in ops/skills with a lock file; index in prompt, body on demand; third-party scanned, disabled, hash-pinned; built-ins win; save-as-skill offered once | [ADR-060](adr/060-skills.md) |
| OQ-40 | 1 KiB receipts; reflections; promotion after a repeat or one correction, via the digest; monthly routing suggestions; gate and grants never learn | [ADR-061](adr/061-learning-from-outcomes.md) |
