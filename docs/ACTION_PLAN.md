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
6. **Memory next** (OQ-03, OQ-04, OQ-05, OQ-06), then persona, then the real gate and the
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
