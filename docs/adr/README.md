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
