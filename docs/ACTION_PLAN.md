# Jaari: Action plan

Ordered by dependency, not by calendar. Phases in the [roadmap](ROADMAP.md) are a soft plan
(ADR-020): pick up the next item whose needs are met. Item numbers (`0.1`) are roadmap IDs;
status and exit criteria live there.

## Workstreams
1. **Questions that block Phase 0**: all decided (ADR-079 to ADR-086).
2. **Scaffold the monorepo** (0.1 to 0.4): root `package.json`, lockfile, pnpm supply-chain
   settings, CI with the tier-1 smoke test, `SECURITY.md` and `CONTRIBUTING.md` (ADR-041,
   ADR-043); fix `python/` to match [guides/namespaces.md](guides/namespaces.md) and secure
   the names (ADR-010).
3. **Safety floor first** (0.9 to 0.11): `@jaari/capabilities`, `@jaari/gate` (deny-all stub),
   and `@jaari/secrets` (resolver + `os-keychain` and `host-credential`) with the first package
   (ADR-018, ADR-079).
4. **Build `@jaari/llm`** (0.7) on `@earendil-works/pi-ai` with the tier/role config; the
   `jaari llm eval` qualification fixtures that `jaari init` uses arrive with Phase 1 (1.9;
   ADR-019, ADR-045).
5. **Daemon and install** (0.5, 0.6, 0.12 to 0.14): `apps/daemon` with the persistent session,
   `jaari init` (target: VPS, remote server, home hardware, or laptop), `jaari doctor`,
   Compose, and the laptop sleep rule (ADR-017, ADR-056, ADR-057, ADR-065).
6. **Define `ChannelAdapter` and ship the CLI channel** (0.8; ADR-021, ADR-035). The CLI talks
   to the daemon, so this follows step 5.
7. **Memory** (Phase 1): single writer (ADR-026), structured records and FTS5 search (ADR-023),
   context assembly (ADR-024), the job engine (ADR-025), canonicalize and capture evidence
   (ADR-047, ADR-074). Decide OQ-71, OQ-73, and OQ-78 first.
8. **Persona and owner surfaces** (Phase 2): dials and notifications, pairing (ADR-022),
   Telegram, then the panel (ADR-067). Decide OQ-72 before the panel.
9. **The real gate and its companions** (Phase 3): gate and audit log (ADR-006, ADR-016,
   ADR-018), vault (ADR-013, ADR-050), pause and limits (ADR-031), grants (ADR-072), backup and
   encryption (ADR-027, ADR-028), shadow mode (ADR-068). They check each other at dispatch, so
   they land together.
10. **Background work** (Phase 4): children, the `reader` role, `@jaari/http` to ADR-016 with
    `direct` and `owner-exit` providers, the sandbox, MCP, and code execution. Decide OQ-70,
    OQ-76, OQ-77, and OQ-80 first.
11. **Integrations, then the browser** (Phases 5 and 6): OAuth broker, mailbox, calendar,
    documents; then the browser under the placement rule, with pool details in ADR-053
    (ADR-017).
12. **Hardening and evals** (Phases 7 and 8).

## ADRs
| ADR | Title | Status |
|---|---|---|
| [001](adr/001-agent-loop-pi.md) | Agent loop built on Pi | Accepted |
| [002](adr/002-monorepo-and-refs.md) | pnpm TypeScript monorepo with read-only refs/ | Accepted |
| [003](adr/003-memory-git-markdown.md) | Memory is git-backed Markdown (gajae-way axes) | Accepted |
| [004](adr/004-canonicalize-and-audit.md) | Canonicalize loop every 6 hours plus daily audit | Accepted |
| [005](adr/005-computer-use-local-profile.md) | Computer use on a pinned local Chromium profile with takeover | Accepted |
| [006](adr/006-approval-gate.md) | Approval gate with digest binding | Accepted |
| [007](adr/007-secret-refs.md) | Secrets are referenced, never shown to the model | Accepted |
| [008](adr/008-persona-dials.md) | Persona: two dials, enforced by a monitor | Accepted |
| [009](adr/009-merge-strategy.md) | open-instinct as the shell, openinstinct as a spec | Accepted |
| [010](adr/010-identity-and-publishing.md) | Project identity and trusted publishing | Accepted |
| [011](adr/011-llm-routing.md) | LLM routing: owner policy, role-based tiers, request-only escalation | Accepted |
| [012](adr/012-web-and-browser.md) | Web search, fetch, and browser as separate pluggable tools | Accepted |
| [013](adr/013-vault-providers.md) | Pluggable vault providers: Bitwarden first, 1Password second | Accepted |
| [014](adr/014-license-mit.md) | License: MIT | Accepted |
| [015](adr/015-control-plane-and-nodes.md) | One daemon on an always-on host; capabilities installed where they run | Accepted |
| [016](adr/016-openmausbot-hardening.md) | Hardening borrowed from OpenMausBot: dispatch re-check, chained audit, resolve-check-dial egress, owner hold | Accepted |
| [017](adr/017-self-hosted-anywhere.md) | Self-hosted anywhere: VPS, remote server, or home hardware; placement rule and egress pool | Accepted |
| [018](adr/018-capability-vocabulary-and-phase-0-floor.md) | Capability vocabulary, `@jaari/capabilities`, and the Phase 0 safety floor | Accepted |
| [019](adr/019-model-pinning-and-local-only-defaults.md) | Main session pin with outage failover; local-only canonicalize decided at init | Accepted |
| [020](adr/020-soft-phases-and-v1-scope.md) | Roadmap phases are a soft plan; scope deferred from the merge plan | Accepted |
| [021](adr/021-v1-channels.md) | v1 channels: CLI, web panel, Telegram; email as input only | Accepted |
| [022](adr/022-owner-authentication-and-active-channel.md) | Owner authentication: pluggable pairing, one device registry, one active channel | Accepted |
| [023](adr/023-structured-records-and-memory-search.md) | Structured records first, SQLite FTS5 search behind one tool | Accepted |
| [024](adr/024-context-assembly.md) | Context assembly: a fixed layout built by code, automatic recall, time anchors | Accepted |
| [025](adr/025-scheduler-and-job-engine.md) | Scheduler and job engine: a small SQLite queue built to pi-durable's contract | Accepted |
| [026](adr/026-memory-single-writer.md) | Memory writes go through one writer; the owner's edits win | Accepted |
| [027](adr/027-backup-and-restore.md) | Backup and restore: owner-chosen destinations and schedule, encrypted archives, monthly drill | Accepted |
| [028](adr/028-encryption-at-rest.md) | Encryption at rest: prevent secrets in memory, encrypt every remote you do not control, purge on demand | Accepted |
| [029](adr/029-forgetting-and-retention.md) | Forgetting and retention: correct, forget, or erase, by plain request | Accepted |
| [030](adr/030-overlay-network-and-sizing.md) | Bring your own overlay network; security does not depend on it; reference sizing | Accepted |
| [031](adr/031-kill-switch-and-runaway-limits.md) | Pause, emergency stop, and runaway limits, enforced in code and configurable | Accepted |
| [032](adr/032-observability.md) | Observability: three records, opt-in traces, `jaari doctor` | Accepted |
| [033](adr/033-notification-delivery-and-digests.md) | Notification delivery: the active channel is the push; owner-defined digests; learned urgency | Accepted |
| [034](adr/034-mcp-servers.md) | MCP servers: owner-added, pinned, classified in one step, sandboxed from Phase 4 | Accepted |
| [035](adr/035-channel-neutral-prompts.md) | Channel-neutral prompts: Jaari asks in types, each channel renders what it can | Accepted |
| [036](adr/036-code-execution.md) | Code execution: sealed runs never ask, allow once or for 90 days, pinned recurring jobs | Accepted |
| [037](adr/037-voice.md) | Voice: voice notes in v1, local speech by default, owner-chosen approval strictness | Accepted |
| [038](adr/038-documents-and-files.md) | Documents and files: content-addressed store, sealed parsing, sensitive files local-only, disk watch | Accepted |
| [039](adr/039-personal-data.md) | Personal data: calendar first, native for calendar, contacts, and files, MCP for the rest | Accepted |
| [040](adr/040-no-payments-in-v1.md) | No payments in v1; checkouts end at an owner takeover | Accepted |
| [041](adr/041-behaviour-evals.md) | Behaviour evals: scripted scenarios in CI, owner golden threads, opt-in live tests, shadow replay | Accepted |
| [042](adr/042-prompt-versioning.md) | Prompt versioning: versioned prompt files, locked safety prompts, a per-turn fingerprint, propose-and-approve persona edits | Accepted |
| [043](adr/043-project-process.md) | Project process: one contact address, DCO without a CLA, lockstep releases, hardened supply chain | Accepted |
| [044](adr/044-single-owner-multi-owner-later.md) | One owner per Jaari in v1, one Jaari per person, multiple owners planned later | Accepted |
| [045](adr/045-local-models.md) | Local models: a suggested-models data file, per-machine qualification, any OpenAI-compatible local runtime | Accepted |
| [046](adr/046-llm-budget.md) | LLM budget: a monthly budget set at init, early warnings, and the owner's choice at the limit | Accepted |
| [047](adr/047-canonicalize-privacy.md) | Canonicalize privacy: local-only by default, bounded passes, sensitive lines never sent to an API | Accepted |
| [048](adr/048-browser-surface-and-adapters.md) | Browser surface: one neutral tool surface, pluggable browser adapters, any egress route, native toolsets mapped in Phase 6 | Accepted |
| [049](adr/049-fetch-ladder-and-lightpanda.md) | Fetch ladder: pluggable rungs, Lightpanda optional and off by default, decided from usage data | Accepted |
| [050](adr/050-vault-verification-and-one-time-codes.md) | Vault verification: no paid tier required, owner-chosen vault layout, one-time codes from the vault or the owner's channels | Accepted |
| [051](adr/051-consequential-browser-actions.md) | Consequential browser actions: a deterministic commitment classifier, Allow once for commitments, unreadable asks | Accepted |
| [052](adr/052-browser-worker-and-untrusted-pages.md) | Untrusted pages: a browser worker child with task data only, task-scoped origins, fencing as a floor | Accepted |
| [053](adr/053-egress-pool.md) | Egress pool: pluggable providers, one connection baseline, sticky anonymous rotation, home sites suggested from the vault | Accepted |
| [054](adr/054-signed-agent-identity.md) | Signed-agent identity: Web Bot Auth signing built in, off by default, per site, key directory on the owner's own domain only | Accepted |
| [055](adr/055-takeover-transport.md) | Takeover transport: per-adapter live view behind one panel view, a non-blocking state protocol, codes from chat scrubbed before the model | Accepted |
| [056](adr/056-install-update-migrate.md) | Install, update, migrate: owner-chosen install method, automatic patch updates, migrations when a store opens | Accepted |
| [057](adr/057-laptop-host-and-node.md) | Laptop as host and node: sleep detection and capped catch-up, power and battery rules, a published macOS permission matrix | Accepted |
| [058](adr/058-node-link-and-host-migration.md) | Node link and host moves: pinned TLS over the overlay, results that survive a disconnect, generation-fenced host migration | Accepted |
| [059](adr/059-degraded-mode.md) | Degraded mode: hold only the broken part, a control surface without a model, queued messages answered automatically | Accepted |
| [060](adr/060-skills.md) | Skills: SKILL.md playbooks in the memory repo, loaded on demand, third-party skills scanned and pinned, procedures offered as skills | Accepted |
| [061](adr/061-learning-from-outcomes.md) | Learning from outcomes: receipts, reflections, promotions the owner confirms, routing suggestions, a protected core that never learns | Accepted |
| [062](adr/062-oauth-broker.md) | OAuth broker: bring-your-own client with a wizard, grouped consent per connection, tokens in the vault, no hosted broker | Accepted |
| [063](adr/063-agent-mailbox.md) | The agent's mailbox: every mailbox option coded as an adapter, setup guides per option, inbound mail as data, no phone number in v1 | Accepted |
| [064](adr/064-owner-routines.md) | Owner routines: visible routine objects, queued overlaps, cheap checks first, a 14-day check-in, stop by replying | Accepted |
| [065](adr/065-persistent-session.md) | Persistent session: one daemon-owned main session on pi-agent-core, one serial queue, Pi's compaction thresholds, no server-side state for the main session | Accepted |
| [066](adr/066-photos-as-memory.md) | Photos as memory: photo notes in the file store, the vision role as the owner routed it, location kept, face recognition planned for later | Accepted |
| [067](adr/067-owner-panel.md) | Owner panel: one PWA served by the daemon over the overlay, an optional passkey, untrusted content as text, views grown by phase | Accepted |
| [068](adr/068-shadow-mode.md) | Shadow mode: only what Jaari starts on its own, per capability, 14 days by default, each new capability shadowed in turn | Accepted |
| [069](adr/069-threat-model.md) | Threat model: an actor-by-attack-by-control table with what is left over, a "not protected against" list, kept current by an ADR checklist rule | Accepted |
| [070](adr/070-onboarding-conversation.md) | Onboarding conversation: a built-in skill after `jaari init`, one question at a time, optional people records, a first week of inference and one gap question a day | Accepted |
| [071](adr/071-capability-packages.md) | Capability packages: one package format for every pluggable part, a checked manifest, third-party packages in their own process, updates that notify | Accepted |
| [072](adr/072-standing-grants.md) | Standing grants: one grant model, exact-match keys, a closed list of grantable capabilities, offered once after three identical approvals | Accepted |
| [073](adr/073-inbound-triggers.md) | Inbound triggers: polling first, a separate hook listener with opt-in public exposure offered at hook creation, signed deliveries, hooks bound to one routine | Accepted |
| [074](adr/074-memory-capture-evidence.md) | Memory capture evidence: mechanical raw capture, a code-checked quote and source id on every derived fact, inferred facts marked, commit trailers | Accepted |
| [075](adr/075-outside-lineage.md) | Outside lineage: a code-set origin on every run, sticky across spawned work, outside effects always ask with the origin shown | Accepted |
| [076](adr/076-external-control-surface.md) | External control surface: headless CLI commands on the local socket, a two-tool MCP server for paired desktop apps in v1, nothing that approves or changes policy | Accepted |
| [077](adr/077-subscription-cli-engines.md) | Subscription CLI engines: pluggable CliEngine adapters for sandboxed children only, Pi first, the gate answering the CLI's permission requests, off until the owner enables each engine | Accepted |
| [078](adr/078-documents-follow-owner-routing.md) | Documents follow the owner's model routing; no forced local-only path for sensitive files | Accepted |
| [079](adr/079-secret-zero-on-servers.md) | Secret zero on a server: a `host-credential` provider fed by the service manager | Accepted |
| [080](adr/080-egress-core-in-phase-0.md) | Egress core in Phase 0: every outbound call goes through `@jaari/http` from the start | Accepted |
| [081](adr/081-secrets-pasted-in-chat.md) | Secrets pasted in chat: scrubbed at channel ingress, never kept, rotation advised | Accepted |
| [082](adr/082-phase-split-update-and-catch-up.md) | Phase split for update and laptop catch-up | Accepted |
| [083](adr/083-pinned-reference-commits.md) | Reference repos are pinned in `scripts/refs.sh` and moved only with `bump` | Accepted |
| [084](adr/084-package-manifest-location-and-channel-section.md) | The package manifest lives in `package.json`; channels add a `channel` section; a shared contract suite | Accepted |
| [085](adr/085-refusal-in-the-pinned-main-session.md) | A provider refusal never moves the pinned main session; other roles move down the chain | Accepted |
| [086](adr/086-package-homes.md) | Package homes for eleven subsystems; two new homes, `@jaari/mcp` and `apps/hooks` | Accepted |
