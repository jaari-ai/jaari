# Jaari: Open questions

Last updated: 2026-11-12. Open: **25**.

How to resolve one: decide → write or update an ADR → move the row to *Resolved* with
the ADR link and keep its original wording in *Original questions*. "Leaning" is a
suggestion, not a decision.

OQ-01 to OQ-66 were all decided by 2026-11-12 (ADR-014 to ADR-078). OQ-67 to OQ-91 were
found by the documentation audit of 2026-11-12
([audits/documentation-reconciliation.md](audits/documentation-reconciliation.md)): each is a
conflict between accepted ADRs, or a choice that an accepted ADR leaves undecided. None has a
leaning yet; the options listed are only the ones the docs already name.

## Open

### Secrets and security

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-67 | Secret zero on a server | On a headless Linux server or in a Compose container, which store holds secret zero, and how does the daemon get it after an unattended restart? | 0 | None. On record: OS keychain (ADR-013, ADR-018); `env` and `file` are development-only |
| OQ-68 | Egress before `@jaari/http` | The rule says all network egress goes through `@jaari/http`, but the roadmap ships it in Phase 4. How do model-provider, Telegram, speech, and model-download calls leave the host in Phases 0 to 3? | 0 | None. On record: no option documented |
| OQ-69 | Secret pasted in chat | When an owner message contains a password, key, or card number, is the write blocked, is the value removed before the transcript and the raw log are stored, or is it kept verbatim? | 0 | None. On record: block and ask (ADR-028); keep verbatim (ADR-074); scrub and advise rotation (learning/11, not adopted) |
| OQ-70 | Sandbox backend under Compose | With the daemon in a Compose container and no Docker socket, is the sandbox a rootless Podman sidecar or gVisor? How is the daemon's own container hardened? | 4 | None. On record: rootless Podman sidecar or gVisor (ADR-056); Docker or Podman container, bubblewrap (ADR-034, ADR-036) |
| OQ-79 | Capability names that are missing | Which capability names cover the gated effects that have none (vault writes, address-book writes, file-storage uploads, memory erase), are internal read tools (`memory.search`, `records.query`, `skill.load`) capabilities, and which capability has the `takeover` class? | 3 | None. On record: a new name takes an ADR (ADR-071) |
| OQ-80 | Secrets held by MCP servers | A local MCP server gets its secrets in its environment at start and keeps them while it runs. Is that an accepted exception to "resolved only inside executors, for the duration of the call"? | 4 | None. On record: resolve at start (ADR-034); per-call only (ADR-007, ADR-013) |
| OQ-82 | Hosted browser with owner accounts | ADR-048 says a third-party browser provider is for anonymous work "unless the owner pins it". May a hosted browser carry owner-account sessions, and under which egress rule? | 6 | None. On record: placement rule (ADR-017); "cloud browser by default" rejected (ADR-005) |

### Approvals and grants

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-75 | OAuth token rotation | Rotated OAuth tokens are written back through the gated vault write, and every vault write is Allow once and never grantable. Does each token refresh ask the owner, or is rotation of an existing item exempt? | 5 | None. On record: gated write every time (current text) |
| OQ-76 | Subscription CLI runs called "sealed" | ADR-077 calls these runs sealed and approval-free, but they have network to the provider and the CLI's sign-in inside the sandbox, and ADR-036 limits a run to 5 minutes. Are they a named exception with their own limits, or do they ask like any networked run? | 4 | None. On record: sealed means no network and no secrets (ADR-036) |
| OQ-77 | Pinned recurring jobs | A pinned job runs with no expiry and may run host commands. ADR-072 is "one grant model" with a 90-day expiry and lists host commands and `pay` as never grantable. Is a pinned job a separate approval kind, or does it follow ADR-072? | 4 | None. On record: no expiry (ADR-036); closed list (ADR-072) |
| OQ-88 | MCP client and the active channel | Does a message from a paired MCP client make that client the active channel? If not, is `collect` a second output stream next to the one active channel? | 5 | None. On record: no fan-out (ADR-022); approvals stay on the active channel (ADR-076) |

### Privacy and data

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-78 | Sensitive data and routing | After ADR-078, does the ADR-023 sensitivity level still keep health and money data on local-only models outside canonicalize (context assembly sends budget and tracker values to the main model)? What marks a file, photo, or free-text line as sensitive, and which roles read files? | 1 | None. On record: per-type level (ADR-023); owner marking in config (ADR-066, ADR-078) |
| OQ-81 | Retention of receipts and logs | Receipts are "operational rows" kept 7 days (ADR-029) and also live in the 30-day event log (ADR-061, ADR-032); the browser action log is "kept forever" (ADR-052). Where do receipts and the action log live, and for how long? | 4 | None. On record: 7 days; 30 days; forever |
| OQ-87 | File store in backup and erase | How are file-store blobs backed up (ADR-027 does not list them), and does "erase" also remove the blob, the transcript rows, and existing snapshots? | 3 | None. On record: "the store is part of backups" (ADR-038) |

### Phasing and dependencies

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-71 | Safety pieces before Phase 3 | Pause, emergency stop, runaway limits, the usage and event logs, the pre-write secret scan, memory push, and snapshots are Phase 3 (or have no phase), but the agent loop, scheduler, canonicalize, and curiosity run from Phases 0 to 2. Which of them ship earlier? | 1 | None. On record: Phase 3 placement (ROADMAP); ADR-031, ADR-027, ADR-028, ADR-032 state no phase |
| OQ-72 | Panel, overlay, and node link timing | The Phase 2 panel needs TLS over the overlay (Phase 7), and its Approvals, secret entry, Activity, and Usage views need Phase 3 parts. Remote nodes (Phase 6) need the node link (Phase 7). Which parts move, or which views wait? | 2 | None. On record: overlay in Phase 7 (ADR-020); panel views in Phase 2 (ADR-067) |
| OQ-73 | Routines before children | Routines ship in Phase 1 and "children do the work", but children are Phase 4, the notification ledger is Phase 2, and budgets are Phase 3. What can a Phase 1 routine do, and how are its results delivered? | 1 | None. On record: Phase 1 (ADR-064); receipts with children in Phase 4 (ADR-061) |
| OQ-74 | Phase 0 items that need later parts | `jaari update` snapshots the stores (backup is Phase 3), and laptop catch-up needs the job engine (Phase 1), but both are Phase 0 items (ADR-057 states Phase 0 for catch-up; the roadmap places install and update there). Split the items, or move the parts they need? | 0 | None. On record: Phase 0 for catch-up (ADR-057); snapshot before update (ADR-056, which states no phase) |
| OQ-83 | Shadow mode and browser logs | ADR-051 and ADR-052 take fixtures and the origin review from "shadow-mode logs" of owner-account sessions, but ADR-068 never shadows what the owner asks for. Which log feeds them? Also: onboarding (Phase 2) promises shadow behaviour that ships in Phase 3 and that the owner may turn off. | 2 | None. On record: classification log of all owner-account actions (ADR-051); shadow only self-initiated effects (ADR-068) |

### Models, packages, and process

| ID | Topic | Question | Blocks phase | Leaning |
|---|---|---|---|---|
| OQ-84 | Pinning the reference repos | `scripts/refs.sh` follows each upstream default branch and `refs/INDEX.md` is untracked, so the "pinned commit" that citations rely on changes at the next sync. Pin the five commits in the script, or change the docs to say "latest"? | 0 | None. On record: citations need a pinned commit (ADR-014, DEVELOPMENT.md) |
| OQ-85 | Channel manifest and the package manifest | Is `ChannelManifest` the channel section of the ADR-071 `jaari` package manifest (with `egress` and `secrets`), or a separate object? What is the contract-test harness that the plugin guide cites? | 0 | None. On record: one manifest per package (ADR-071) |
| OQ-86 | Provider refusal and the pinned session | ADR-011 moves a refused call to the next model; ADR-019 pins the main session and allows failover only when the provider never accepted the turn. What does the main session do on a refusal? | 0 | None. On record: next model (ADR-011); report or hand over, for off-limits categories (ADR-011) |
| OQ-89 | Web budget | ADR-046 leaves search and fetch cost to "the separate web budget", and ADR-053 counts egress cost against it, but no ADR defines it. What is its default, and what happens at its limit? | 3 | None. On record: the example config values only (`monthlyUsd: 10`, `onExceeded: "local-only"`) |
| OQ-90 | Package homes | Which package or app owns the job engine, file store, skills, routines, hook listener, MCP client and server, CLI engines, speech, OAuth broker, mailbox adapters, and observability? | 0 | None. On record: no package in the ARCHITECTURE.md table owns them (`apps/daemon` mentions the scheduler and jobs; `apps/cli` names `jaari mcp`) |
| OQ-91 | Scope of `repo.write` and `publish` | No ADR decides what Jaari may push or publish (which repos, registries, and how) through the GitHub, npm, and PyPI integrations. | 5 | None. On record: gated, never grantable (ADR-072) |

### Context for each open question

Evidence is `ADR-NNN` or a file. "If delayed" is the cost of not deciding before the blocked
phase starts.

- **OQ-67.** Settled: secret zero stays in the OS keychain and is never in a backup (ADR-013,
  ADR-027); Phase 0 ships an `os-keychain` provider (ADR-018). Gap: the first hosting target is
  a VPS (ADR-017) installed with Compose (ADR-056), which has no OS keychain. If delayed: Phase 0
  cannot start the daemon on a server without a development-only provider.
- **OQ-68.** Settled: resolve, check, dial is the egress mechanism (ADR-016). Gap: AGENTS.md,
  ARCHITECTURE.md, and SECURITY_MODEL.md state the rule, and no interim route is decided. If
  delayed: Phase 0 code breaks the rule or blocks on a Phase 4 item.
- **OQ-69.** Settled: one-time codes pasted during a code request are replaced in the transcript
  (ADR-055). Gap: ADR-028 blocks a memory write that contains a secret; ADR-074 writes the
  owner's turn verbatim; ADR-065 stores and backs up the transcript with no scan stated.
- **OQ-70.** Settled: the sandbox never gets the Docker socket (ADR-056); a boot self-check
  disables code execution if the sandbox is weak (ADR-036). Reopens the Compose part of OQ-35.
  If delayed: MCP servers, code execution, document parsing, and CLI engines have no backend
  on the default install.
- **OQ-71.** Settled: the deny-all gate stub blocks every gated effect before Phase 3
  (ADR-018), so the gap is spend, message volume, and one unencrypted, unscanned copy of memory,
  not unapproved actions. ADR-065 (Phase 0) already expects "stop" and "pause" handled by code.
- **OQ-72.** Settled: the panel is a paired device served only over the overlay with TLS
  (ADR-067, ADR-030); the node link is a WebSocket across the overlay (ADR-058). ADR-020 placed
  the overlay in Phase 7 before these ADRs were written.
- **OQ-73.** Settled: routine semantics (ADR-064) and the job engine (ADR-025). Watcher and
  webhook triggers arrive with Phases 4 and 5 in any case.
- **OQ-74.** Settled: sleep detection, the power rule, install, and config migrations have no
  later dependency and can ship in Phase 0.
- **OQ-75.** Evidence: ADR-062 ("written back through the gated vault write"), ADR-013
  amendment from ADR-072, ADR-072 ("anything that handles credentials"). If delayed: calendar,
  mailbox, and file-storage connections prompt on every refresh or fail in the background.
- **OQ-76.** Evidence: ADR-036 ("A run with no network and no secrets is sealed"; provider keys
  never inside the sandbox; 5-minute limit), ADR-077 ("inside the sealed sandbox", the CLI's own
  sign-in, provider API hosts), ADR-031 (children 30 minutes).
- **OQ-77.** Evidence: ADR-036 ("with no expiry"; "Host jobs are allowed this way"), ADR-072
  ("One grant model"; closed list), ADR-006 ("Approvals are single-use and expire"), ADR-040
  (a pinned job as the later model for recurring payments).
- **OQ-78.** Settled: documents and photos follow the owner's routing (ADR-066, ADR-078);
  canonicalize keeps sensitive lines out of an API batch (ADR-047). Gap: ADR-023's rule for
  records, ADR-024's prompt layout, and the marking method ("recognised as sensitive" in
  ADR-038, "marked sensitive" in ADR-066 and ADR-078).
- **OQ-79.** Evidence: ADR-018 ("the only list of names the model can ask for"; classes read,
  gated, takeover), ADR-013 (vault writes gated), ADR-039 (address-book writes and uploads
  gated), ADR-029 (erase goes through the gate), ADR-023 and ADR-024 (`memory.search`,
  `records.query`), ADR-060 (`skill.load`).
- **OQ-80.** Evidence: ADR-034 ("resolved at start into its environment"), ADR-007, ADR-013.
- **OQ-81.** Evidence: ADR-029, ADR-032, ADR-052, ADR-061, ADR-064. ADR-033 learns urgency from
  the notification ledger, which a 7-day prune would shorten.
- **OQ-82.** Evidence: ADR-048 ("unless the owner pins it"), ADR-017 (placement rule), ADR-005.
- **OQ-83.** Evidence: ADR-051 ("During Phase 6 shadow mode every action in owner-account
  sessions is logged"), ADR-052, ADR-068, ADR-070 ("for the first 14 days it only proposes").
- **OQ-84.** Verified on 2026-11-12: each reference is at the commit in `refs/INDEX.md` and its
  licence matches. If delayed: the next `scripts/refs.sh` run moves every reference.
- **OQ-85.** Evidence: ARCHITECTURE.md (Channels, Contract), guides/channel-plugins.md, ADR-071
  (manifest with `kind`, `egress`, `secrets`; third-party packages in their own process; a
  local path is for development only).
- **OQ-86.** Evidence: ADR-011, ADR-019, learning/10 (Pi reports a refusal as an error stop).
- **OQ-87.** Evidence: ADR-027 ("What is backed up"), ADR-038, ADR-058 (the migration bundle
  includes the store), ADR-029, ADR-028.
- **OQ-88.** Evidence: ADR-022, ADR-076.
- **OQ-89.** Evidence: ADR-046, ADR-053 (egress cost counts against it), `jaari.config.example.jsonc`.
- **OQ-90.** Evidence: ARCHITECTURE.md (Packages); AGENTS.md asks to keep that table current.
- **OQ-91.** Evidence: ARCHITECTURE.md (`@jaari/integrations`), INTEGRATIONS.md, ROADMAP.md
  (Phase 5), ADR-072.

## Resolved

A later ADR can change a resolved answer; the row then names both ADRs.

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
| OQ-63 | Trust tiers, peers, payments, and voice deferred; wording corrected. Later narrowed: voice notes are in v1, only live calls stay deferred ([ADR-037](adr/037-voice.md)) | [ADR-020](adr/020-soft-phases-and-v1-scope.md) |
| OQ-64 (ADR-011, ADR-012 part) | ADR-011 and ADR-012 accepted; ADR-013 was left open as OQ-64 (decided since; see the OQ-64 row) | [ADR-019](adr/019-model-pinning-and-local-only-defaults.md) |
| OQ-65 | Main session pinned; outage failover at a turn boundary with one notice | [ADR-019](adr/019-model-pinning-and-local-only-defaults.md) |
| OQ-66 | Local-only canonicalize decided at `jaari init` by `jaari llm eval` | [ADR-019](adr/019-model-pinning-and-local-only-defaults.md) |
| OQ-01 | CLI, web panel, and Telegram in v1; email as input only (Phase 5); WhatsApp and iMessage first after v1 | [ADR-021](adr/021-v1-channels.md) |
| OQ-02 | Ingress mints authority; paired channels are equal; one active channel (latest inbound); pluggable pairing into one hashed device registry; immediate revoke | [ADR-022](adr/022-owner-authentication-and-active-channel.md) |
| OQ-03 | Typed structured records (13 built-in types plus custom) with code-computed values; SQLite FTS5 search as a rebuildable cache; embeddings later | [ADR-023](adr/023-structured-records-and-memory-search.md) |
| OQ-04 | Code-built layout with per-section budgets; 14-day window plus date-aware recall, a horizon line, and records.query for later dates; model may search more | [ADR-024](adr/024-context-assembly.md); compaction in [ADR-065](adr/065-persistent-session.md) |
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
| OQ-17 | Content-addressed store outside git; parsing ladder in the sealed sandbox; documents follow the owner's model routing, with no forced local-only path (ADR-078 replaced the local-only default); owner files kept with no quota, disk watch notifies at 80/90/95%; drop folder on host and nodes | [ADR-038](adr/038-documents-and-files.md), [ADR-078](adr/078-documents-follow-owner-routing.md) |
| OQ-18 | Calendar first (CalDAV, Google, Microsoft), free/busy, read, write split; own-calendar writes Allow once or 90-day grant, invitations always ask; direct requests added, passing mentions offered; contacts read-only sync; WebDAV and Drive native, others via MCP | [ADR-039](adr/039-personal-data.md) |
| OQ-19 | No `pay` executor in v1; checkouts stop at the payment step and the owner enters the card in a takeover; card fields stay unresolvable; later: one-time virtual cards, spend check, Allow once | [ADR-040](adr/040-no-payments-in-v1.md) |
| OQ-20 | Tier 1 scripted scenarios on the real daemon in CI; tier 2 owner corrections offered once as local redacted fixtures; tier 3 opt-in live tests with an LLM judge for tone only; `jaari replay` in shadow mode | [ADR-041](adr/041-behaviour-evals.md) |
| OQ-21 | Versioned prompt files; safety and system prompts locked; per-turn fingerprint; Jaari's persona edits are proposals | [ADR-042](adr/042-prompt-versioning.md) |
| OQ-22 | hello@jaari.org for all contact; DCO, no CLA; lockstep SemVer releases; pinned, aged, script-free dependencies | [ADR-043](adr/043-project-process.md) |
| OQ-23 | Single owner in v1; ownerId everywhere; one Jaari per person; multi-owner instance planned later; unknown-sender notice off by default | [ADR-044](adr/044-single-owner-multi-owner-later.md) |
| OQ-24 | suggested.json data file, no licence filter; qualification on the owner's machine; Ollama, llama.cpp, LM Studio, MLX. Which models pass is measured in Phase 1 | [ADR-045](adr/045-local-models.md) |
| OQ-25 | Budget suggested at init by preset ($30/$20/$0); 50% and 80% warnings; owner chooses at the limit, trade-offs explained the first 3 times | [ADR-046](adr/046-llm-budget.md) |
| OQ-26 | Local-only by default (ADR-019); bounded passes; sensitive lines never in an API batch; sourced lines; 20% deletion hold | [ADR-047](adr/047-canonicalize-privacy.md) |
| OQ-27 | Neutral browser.*/computer.* surface; pluggable adapters (remote desktop, MCP, providers, custom incl. spoofing); any egress route; native toolsets in Phase 6 | [ADR-048](adr/048-browser-surface-and-adapters.md) |
| OQ-28 | Pluggable fetch rungs; Lightpanda off by default, offered on small hosts; monthly on/off suggestion from usage logs | [ADR-049](adr/049-fetch-ladder-and-lightpanda.md) |
| OQ-29 | Bitwarden verified: no paid tier needed; 1Password plan eligibility and limits are checked on a real account at the start of Phase 3; owner picks vault layout and Premium; one-time codes from vault, then owner's channels with a notice, then ask | [ADR-050](adr/050-vault-verification-and-one-time-codes.md) |
| OQ-30 | Deterministic classifier over six commitment classes; commitments Allow once; LLM may only escalate; classifier-only rollout | [ADR-051](adr/051-consequential-browser-actions.md) |
| OQ-31 | Browser driven by a worker child with task data only; strict task-scoped origins (review in Phase 6); fencing; screenshot redaction | [ADR-052](adr/052-browser-worker-and-untrusted-pages.md) |
| OQ-32 | Pluggable egress providers; one connection baseline; sticky-per-task rotation; 5-minute health probes; home sites suggested from vault logins | [ADR-053](adr/053-egress-pool.md) |
| OQ-33 | Web Bot Auth signing built, off by default, chosen per site; key directory on the owner's own domain only; registration revisited | [ADR-054](adr/054-signed-agent-identity.md) |
| OQ-34 | Per-adapter transport (CDP screencast, noVNC, provider live view) in one panel view; 10-minute wait then pause; pasted codes accepted and scrubbed | [ADR-055](adr/055-takeover-transport.md) |
| OQ-35 | Compose, npm, brew, binary, or one-line installer; patches auto-install in quiet hours, minor and major notify; migrations on store open. The sandbox backend under Compose is open again as OQ-70 | [ADR-056](adr/056-install-update-migrate.md) |
| OQ-36 | Clock-gap sleep detection; missed jobs run once (max 5); awake only while a job runs on mains; battery pause; macOS permission matrix | [ADR-057](adr/057-laptop-host-and-node.md) |
| OQ-37 | Pinned TLS node link; 1-hour result outbox; migrate-host asks about pending approvals (cancel or carry over); generation fencing; signed node handoff | [ADR-058](adr/058-node-link-and-host-migration.md) |
| OQ-38 | Per-dependency holds; send stamp; code-run control surface when models are down; owner messages answered automatically when back; 24 h task expiry | [ADR-059](adr/059-degraded-mode.md) |
| OQ-39 | SKILL.md in ops/skills with a lock file; index in prompt, body on demand; third-party scanned, disabled, hash-pinned; built-ins win; save-as-skill offered once | [ADR-060](adr/060-skills.md) |
| OQ-40 | 1 KiB receipts; reflections; promotion after a repeat or one correction, via the digest; monthly routing suggestions; gate and grants never learn | [ADR-061](adr/061-learning-from-outcomes.md) |
| OQ-41 | Own Google/Microsoft client via wizard; PKCE; one grouped consent for the chosen capabilities; tokens in the vault; revoke and admin-consent handling | [ADR-062](adr/062-oauth-broker.md) |
| OQ-42 | Adapters for personal (scoped), own-domain, OAuth, and JMAP mailboxes with setup guides; inbound as data; email.send Allow once; no phone or SMS gateway in v1 | [ADR-063](adr/063-agent-mailbox.md) |
| OQ-43 | Routine objects with budgets and history; overlaps queue (coalesced); code checks first; check-in at 14 and 30 days then never; reply to stop | [ADR-064](adr/064-owner-routines.md) |
| OQ-44 | One persistent daemon-owned session on pi-agent-core; serial queue; Pi thresholds; no server-side state for the main session; keep transcripts, optional pruning | [ADR-065](adr/065-persistent-session.md) |
| OQ-45 | Photo notes with description, text, date, and location; vision role follows the owner's routing; face recognition planned for later | [ADR-066](adr/066-photos-as-memory.md) |
| OQ-46 | One PWA over the overlay on the CLI's API; optional passkey for secret entry and takeover; untrusted content as text; Phase 2 core views | [ADR-067](adr/067-owner-panel.md) |
| OQ-47 | Shadow only self-initiated effects, per capability, 14 days by default with Do it now; direct requests skip it; new capabilities start shadowed. What is logged for owner-requested browsing is OQ-83 | [ADR-068](adr/068-shadow-mode.md) |
| OQ-48 | THREAT_MODEL.md written now: actor/attack/control/left-over table and a not-protected list; kept current by a DEVELOPMENT.md checklist rule | [ADR-069](adr/069-threat-model.md) |
| OQ-49 | Built-in onboarding skill after init; one question per message; optional people records; first week inferred with one gap question a day and a day-7 summary | [ADR-070](adr/070-onboarding-conversation.md) |
| OQ-50 | One npm package format with a checked jaari manifest for every pluggable part; third-party in its own process; updates notify; schema and built-in loader in Phase 0 | [ADR-071](adr/071-capability-packages.md) |
| OQ-51 | One grant model with exact-match keys, 90-day expiry, a closed grantable list (never sends, publish, pay, repo.write); offered once after three identical approvals | [ADR-072](adr/072-standing-grants.md) |
| OQ-52 | Polling first; separate hook listener with opt-in public exposure offered at hook creation; HMAC or provider signatures, bearer with a warning; hooks start one bound routine | [ADR-073](adr/073-inbound-triggers.md) |
| OQ-53 | Raw capture mechanical; every derived fact carries a code-checked quote and source id; others' content as 'according to'; inferred facts marked; commit trailers | [ADR-074](adr/074-memory-capture-evidence.md) |
| OQ-54 | Code-set origin per run (owner, routine, event, outside); outside is sticky, cannot approve or use grants, effects ask with an origin line | [ADR-075](adr/075-outside-lineage.md) |
| OQ-55 | jaari run/wait/status/export on the local socket with typed exit codes; two-tool MCP server for paired apps in v1, trusted as owner; never approves or changes policy | [ADR-076](adr/076-external-control-surface.md) |
| OQ-56 | CliEngine adapters (Pi first) for sandboxed children only; gate answers the CLI's permission requests; results applied by Jaari's gated capabilities; off until enabled per engine | [ADR-077](adr/077-subscription-cli-engines.md) |
| OQ-64 | ADR-013 accepted with the ADR-050 vendor check and amendments from ADR-050, ADR-063, ADR-071, and ADR-072 | [ADR-013](adr/013-vault-providers.md), [ADR-050](adr/050-vault-verification-and-one-time-codes.md) |

### Original questions

The wording of each question in its last open version, recovered from the git history of this
file. OQ-57 to OQ-63, OQ-65, and OQ-66 never had an open row: they were recorded as already
decided by the docs conflict audit of 2026-11-10 (ADR-017 to ADR-020), so their row above is
the only wording. Some questions had been narrowed by an earlier partial decision.

| ID | Topic | Original question | Blocked phase |
|---|---|---|---|
| OQ-01 | Channels | Which channels ship in v1 (CLI, web UI, Telegram, Signal, Matrix, Discord, email, iMessage)? | 0 |
| OQ-02 | Owner authentication | How does Jaari verify a message is from the owner? How are new devices paired and revoked? | 0 |
| OQ-03 | Memory retrieval | grep, SQLite FTS5, embeddings, or hybrid? Which embedding provider (local or API tier)? | 1 |
| OQ-04 | Context assembly | Who decides what memory enters each prompt? How are long sessions compacted? | 1 |
| OQ-05 | Scheduler | One job engine for canonicalize, audit, reminders, children: persistence, retries, crash recovery, missed runs during sleep, time zones | 1 |
| OQ-06 | Concurrent memory writes | Lock, single writer queue, or branch-per-task then merge? | 1 |
| OQ-07 | Backup and restore | Encrypted git remote for memory, SQLite backup (e.g. Litestream), secret store backup, restore drill | 3 |
| OQ-08 | Encryption at rest | age vs git-crypt for memory; how to purge a secret that reached git history | 3 |
| OQ-09 | Forgetting and retention | "Forget this" command; raw daily log retention; does forgetting rewrite git history? | 3 |
| OQ-10 | Deployment | Host choice decided by ADR-015 and ADR-017 (VPS, remote server, home hardware, or laptop). Still open: overlay network details (Tailscale first, Headscale or WireGuard documented), reference sizing per target. The Compose layout and migrations moved to OQ-35 | 7 |
| OQ-11 | Kill switch | Global pause, loop step limits, max concurrent children, spend-spike alerts | 3 |
| OQ-12 | Observability | Tracing per turn/tool/child (OpenTelemetry?), admin page for jobs, approvals, usage, errors | 7 |
| OQ-13 | Notification delivery | Proactive messages via channel or push (ntfy, Pushover); urgent vs digest routing | 2 |
| OQ-14 | MCP client and plugins | Load third-party MCP servers or skills? Permissions, sandboxing, gate coverage per tool | 4 |
| OQ-15 | Code execution | Python/shell sandbox: reuse Docker/Firecracker backends? Network and resource limits? | 7 |
| OQ-16 | Voice | STT (whisper.cpp vs Deepgram) and TTS (Piper/Kokoro vs ElevenLabs), local-or-API like the LLM | later |
| OQ-17 | Documents and files | PDF/Office parsing, OCR, drop-folder inbox, attachment storage | 5 |
| OQ-18 | Personal data | Calendar (CalDAV/Google), contacts, notes, file storage | 5 |
| OQ-19 | Payments rail | Virtual cards with per-merchant limits, or no payments in v1? | later |
| OQ-20 | Behaviour evals | Fixtures for staying quiet, asking before acting, persona adherence; session replay | 2 |
| OQ-21 | Prompt versioning | Version system prompts and persona files; trace and roll back changes | 2 |
| OQ-22 | Project process | SECURITY.md and disclosure contact, release/versioning policy, contribution rules (DCO or CLA?). License decided: MIT (ADR-014) | 0 |
| OQ-23 | Multiple users | Strictly single owner, or household members with limited access? | 0 |
| OQ-24 | Local model per target | Size classes per deployment target are set in [LLM.md](LLM.md#local-models-per-target). Open: which concrete open-weight model passes the `jaari llm eval` fixtures (tool calls, JSON validity, canonicalize golden set, injection resistance) for the small and medium tiers on each target, and which to suggest at `jaari init`. | 1 |
| OQ-25 | LLM budget | Default monthly LLM budget? | 3 |
| OQ-26 | Canonicalize privacy | Should canonicalize be local-only by default? | 1 |
| OQ-27 | Browser tool surface | Provider-neutral `browser.*` / `computer.*` members run by Jaari's own driver (Playwright/CDP, Stagehand), or the vendor-native toolsets (Anthropic `browser_toolset_20260801` / `computer_toolset_20260801`, Gemini `computer_use`) mapped per routed model? `pi-ai` has no toolset support today, and a native toolset reaches the gate only through the driver's `confirm` hook. Driver hygiene against automation markers (Patchright-level) is part of this; full anti-detect browsers are not (see learning/08). Background: [learning/07-computer.md](learning/07-computer.md) | 6 |
| OQ-28 | Lightpanda | Is Lightpanda worth running, or is http + Chromium enough? | 4 |
| OQ-29 | Vault verification | Confirm against vendor docs before Phase 3: does Bitwarden Lite need a paid licence for anything ADR-013 uses (Secrets Manager is optional)? Exact 1Password SDK and service-account setup for a personal account? | 3 |
| OQ-30 | Consequential browser actions | A purchase, a sent message, or accepted terms arrives as an ordinary `left_click` / `type`; Anthropic's own `confirm` hook "can't pick them out by name". How does the gate recognise them: deterministic page heuristics, a reader-role check of the page state, or approval on every click within flagged origins? | 6 |
| OQ-31 | Screenshots as untrusted content | Do screenshots and accessibility trees fall under the reader-role rule (principle 8)? A reader pass per screenshot is too slow for a click loop, and vendor prompt-injection classifiers run only on native toolsets. | 6 |
| OQ-32 | Egress pool details | ADR-017 fixes the shape: an egress pool of `owner-exit` (Tailscale, Headscale, WireGuard), `direct`, `mobile`, and `residential-proxy` providers; rotation for anonymous traffic only (owner exit nodes may join the rotation), owner accounts pinned to one owner node. Open: the provider interface, rotation and health-check policy, which residential providers pass the sourcing check, 4G dongle setup, and the home-sites list format. Background: [learning/08-egress-identity-and-takeover.md](learning/08-egress-identity-and-takeover.md) | 6 |
| OQ-33 | Signed-agent identity | Should `@jaari/http` and the browser sign requests per Web Bot Auth (RFC 9421, `Signature-Agent`, JWKS at `/.well-known/http-message-signatures-directory`)? Cloudflare's Signed Agents registry is per operator via the dashboard; it is unknown whether an individual self-hoster can register. | 4 |
| OQ-34 | Takeover transport | How does the owner see and touch the agent's browser from a phone within seconds: CDP screencast in the web panel, noVNC over loopback, or a hosted live view? Takeover states, timeouts, and the rule that screenshots stop while the owner holds the session. | 6 |
| OQ-35 | Install, update, migrate | One-command install per target of ADR-017 (Compose on a VPS or home box, brew or a single binary on a laptop), the Compose layout, `jaari doctor`, an update channel, and versioned config and memory schemas with migrations run at start. Nothing is specified today. | 0 |
| OQ-36 | Laptop as host | The laptop as a daemon host (ADR-017 target 3) and as a node: sleep and wake, network changes, battery, and the macOS permission matrix per capability (Automation, Accessibility, Screen Recording, Full Disk Access). Meta publishes none of this for Muse. Sleep and wake is needed in Phase 0; the permission matrix with the desktop capability in Phase 6. | 0 |
| OQ-37 | Multi-device state | With ADR-015, how nodes and the daemon reconnect, and how the daemon moves between hosts (laptop, VPS, home server, in any direction). | 7 |
| OQ-38 | Degraded mode | Behaviour when the API tier is unreachable, the budget is spent, or a node is offline: what queues, what runs locally, what the owner is told. | 3 |
| OQ-39 | Skills and procedural memory | Skills as versioned Markdown playbooks (OpenClaw `SKILL.md`, open-instinct `skills/`, Anthropic Agent Skills): where they live, how they are installed, who approves them, how a skill becomes memory. | 2 |
| OQ-40 | Learning from outcomes | Failure receipts, `reflections → rules` promotion (gajae-way), router tuning from the outcome log. Today only the notification ledger learns. | 8 |
| OQ-41 | OAuth broker | Connected apps (Google, Microsoft, Slack) need tokens the model never sees: storage, refresh, scope-to-capability mapping, revocation, admin consent. | 5 |
| OQ-42 | The agent's own mailbox and number | A mailbox for one-time codes, receipts, and confirmations (Grok Bot, Instinct), and later a phone number (Instinct phones businesses). Inbound mail stays data (reader role). | 5 |
| OQ-43 | Owner routines | "Every morning summarise X", "watch this price": routines as owner-visible objects (cron, watcher, webhook) with pause, history, and budgets; all output through the persona monitor. | 1 |
| OQ-44 | Persistent session and context | One main session reopened over its transcript across restarts, steering, segment flushing, daemon-managed compaction, a stable prompt prefix for caching, and how 2026 API features (server compaction, threads) are used. | 0 |
| OQ-45 | Multimodal memory | Photos, receipts, and screenshots as memory, and what the audit does with them. | later |
| OQ-46 | Owner panel | `channel-web` as a PWA: approval cards showing the digest, live view (ADR-055), a memory browser and editor, audit viewer, budgets, pause and emergency stop (ADR-031), web push while the panel is the active channel (ADR-033). | 2 |
| OQ-47 | Shadow mode | Observe-and-propose only for the first weeks: drafts instead of sends, plans instead of actions; the owner lifts it per capability. | 3 |
| OQ-48 | Threat model | An enumerated `THREAT_MODEL.md`: injection via pages and screenshots, malicious MCP server or skill, compromised node, stolen phone, malicious channel plugin, poisoned memory. | 3 |
| OQ-49 | Onboarding conversation | The first conversation and first week: profile bootstrap, what is asked and what is inferred, when dials are explained. | 2 |
| OQ-50 | Capability packages | ADR-015 makes capabilities installable units with a manifest. Open: manifest schema, where packages come from (npm `@jaari/capability-*`, local path), signing and update, how a capability declares and checks its OS permissions and sidecars (Xvfb or a desktop container for `computer.use` on a VPS), and how this relates to MCP servers (OQ-14) and skills (OQ-39). The owning package is `@jaari/capabilities` and the names come from one vocabulary (ADR-018). | 0 |
| OQ-51 | Standing grants | ADR-006 approves one action per digest. Daily use needs some "always allow": which capabilities may have a standing grant, what it is keyed on, how it expires, and how the owner lists and revokes them. OpenMausBot keys grants on the exact command plus working directory, and MCP read grants on a hash of the server config. | 3 |
| OQ-52 | Inbound triggers | Webhooks and app events that start work ("when this form posts", "when mail from X arrives"): receiver isolation, secret handling, dedup, rate limits, and how events reach a host with no public port. Routines (ADR-064) cover time; this covers events. | 5 |
| OQ-53 | Memory capture evidence | What stops capture and canonicalize from writing an invented fact about the owner? OpenMausBot requires each captured fact to quote the person's words, and code checks that the quote exists and that every number, path, and URL in the fact comes from it. Also: how a memory commit records who caused it. | 1 |
| OQ-54 | Outside lineage | The reader role summarises untrusted content, but work started because of that content (a mail that leads to a child, a webhook that leads to a draft) still carries its influence. Does that origin stick to everything derived from it, and what does it restrict? | 4 |
| OQ-55 | External control surface | Should other tools drive Jaari: a headless `jaari run` / `jaari wait` for scripts, and an MCP server for desktop clients? What must such a surface never expose? | 4 |
| OQ-56 | Subscription CLI engines | OpenMausBot runs bots on the owner's installed `claude`, `codex`, and other CLIs (27 drivers, including Pi over `pi --mode rpc`), so work is billed to an existing subscription. Should a Jaari child be able to delegate a task to such a CLI? The gate cannot see tool calls inside another loop, and provider terms differ. | 4 |
| OQ-64 | Accept ADR-013 | ADR-011 and ADR-012 were accepted (ADR-019). ADR-013 (vault providers) is still Proposed and depends on OQ-29: Bitwarden Lite licence needs and the 1Password service-account setup are unverified. | 3 |
