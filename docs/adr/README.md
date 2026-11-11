# Architecture decision records

| ADR | Title | Status |
|---|---|---|
| [001](001-agent-loop-pi.md) | Agent loop built on Pi | Accepted |
| [002](002-monorepo-and-refs.md) | pnpm TypeScript monorepo with read-only refs/ | Accepted |
| [003](003-memory-git-markdown.md) | Memory is git-backed Markdown (gajae-way axes) | Accepted |
| [004](004-canonicalize-and-audit.md) | Canonicalize loop every 6 hours plus daily audit | Accepted |
| [005](005-computer-use-local-profile.md) | Computer use on a pinned local Chromium profile with takeover | Accepted |
| [006](006-approval-gate.md) | Approval gate with digest binding | Accepted |
| [007](007-secret-refs.md) | Secrets are referenced, never shown to the model | Accepted |
| [008](008-persona-dials.md) | Persona: two dials, enforced by a monitor | Accepted |
| [009](009-merge-strategy.md) | open-instinct as the shell, openinstinct as a spec | Accepted |
| [010](010-identity-and-publishing.md) | Project identity and trusted publishing | Accepted |
| [011](011-llm-routing.md) | LLM routing: owner policy, role-based tiers, request-only escalation | Accepted |
| [012](012-web-and-browser.md) | Web search, fetch, and browser as separate pluggable tools | Accepted |
| [013](013-vault-providers.md) | Pluggable vault providers: Bitwarden first, 1Password second | Proposed |
| [014](014-license-mit.md) | License: MIT | Accepted |
| [015](015-control-plane-and-nodes.md) | One daemon on an always-on host; capabilities installed where they run | Accepted |
| [016](016-openmausbot-hardening.md) | Hardening borrowed from OpenMausBot: dispatch re-check, chained audit, resolve-check-dial egress, owner hold | Accepted |
| [017](017-self-hosted-anywhere.md) | Self-hosted anywhere: VPS, remote server, or home hardware; placement rule and egress pool | Accepted |
| [018](018-capability-vocabulary-and-phase-0-floor.md) | Capability vocabulary, `@jaari/capabilities`, and the Phase 0 safety floor | Accepted |
| [019](019-model-pinning-and-local-only-defaults.md) | Main session pin with outage failover; local-only canonicalize decided at init | Accepted |
| [020](020-soft-phases-and-v1-scope.md) | Roadmap phases are a soft plan; scope deferred from the merge plan | Accepted |
| [021](021-v1-channels.md) | v1 channels: CLI, web panel, Telegram; email as input only | Accepted |
| [022](022-owner-authentication-and-active-channel.md) | Owner authentication: pluggable pairing, one device registry, one active channel | Accepted |
| [023](023-structured-records-and-memory-search.md) | Structured records first, SQLite FTS5 search behind one tool | Accepted |
| [024](024-context-assembly.md) | Context assembly: a fixed layout built by code, automatic recall, time anchors | Accepted |
| [025](025-scheduler-and-job-engine.md) | Scheduler and job engine: a small SQLite queue built to pi-durable's contract | Accepted |
| [026](026-memory-single-writer.md) | Memory writes go through one writer; the owner's edits win | Accepted |
| [027](027-backup-and-restore.md) | Backup and restore: owner-chosen destinations and schedule, encrypted archives, monthly drill | Accepted |
| [028](028-encryption-at-rest.md) | Encryption at rest: prevent secrets in memory, encrypt every remote you do not control, purge on demand | Accepted |
| [029](029-forgetting-and-retention.md) | Forgetting and retention: correct, forget, or erase, by plain request | Accepted |
| [030](030-overlay-network-and-sizing.md) | Bring your own overlay network; security does not depend on it; reference sizing | Accepted |
| [031](031-kill-switch-and-runaway-limits.md) | Pause, emergency stop, and runaway limits, enforced in code and configurable | Accepted |
| [032](032-observability.md) | Observability: three records, opt-in traces, `jaari doctor` | Accepted |
| [033](033-notification-delivery-and-digests.md) | Notification delivery: the active channel is the push; owner-defined digests; learned urgency | Accepted |
| [034](034-mcp-servers.md) | MCP servers: owner-added, pinned, classified in one step, sandboxed from Phase 4 | Accepted |
| [035](035-channel-neutral-prompts.md) | Channel-neutral prompts: Jaari asks in types, each channel renders what it can | Accepted |
| [036](036-code-execution.md) | Code execution: sealed runs never ask, allow once or for 90 days, pinned recurring jobs | Accepted |
