# Jaari: Action plan

Ordered by dependency, not by calendar. Phases in the [roadmap](ROADMAP.md) are a soft plan
(ADR-020): pick up the next item whose needs are met.

## Workstreams
1. **Decide the Phase 0 questions.** OQ-22 (project process), OQ-23 (single owner), OQ-35 (install), OQ-44 (session). Record
   an ADR for each as it closes.
2. **Scaffold the monorepo** from the config this script generates; add `@jaari/capabilities`,
   `@jaari/gate` (deny-all stub), and `@jaari/secrets` (resolver + `os-keychain`) with the
   first package (ADR-018).
3. **Build `@jaari/llm`** on `@earendil-works/pi-ai` with the tier/role config; add the
   `jaari llm eval` hook that `jaari init` uses to decide local-only roles (ADR-019).
4. **Define `ChannelAdapter` and ship the CLI channel**; then the web panel and Telegram (ADR-021).
5. **Daemon and install.** `apps/daemon`, `jaari init` (target: VPS, remote server, home
   hardware, or laptop), `jaari doctor`, Compose, and the laptop sleep/wake rule (ADR-017).
6. **Memory next**: structured records and FTS5 search (ADR-023) and context assembly (ADR-024), the job engine (ADR-025), and the single writer (ADR-026); then persona, then the real gate and the
   vault (ADR-006, ADR-016, ADR-018; verify OQ-29 and accept ADR-013).
7. **Egress and browser.** `@jaari/http` to ADR-016 with `direct` and `owner-exit` (Tailscale)
   providers; the browser under the placement rule; pool details in OQ-32 (ADR-017).

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
| [013](adr/013-vault-providers.md) | Pluggable vault providers: Bitwarden first, 1Password second | Proposed |
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
