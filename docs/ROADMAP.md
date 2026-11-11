# Jaari: Roadmap

The goal: a self-hosted personal agent in the shape of the commercial ones (always
reachable, remembers, works in the background, drives a browser, asks before it acts), run
by the owner on a VPS, a remote server, home hardware, or a laptop (ADR-017).

**Phases are a soft plan (ADR-020).** They say what to build roughly first, not what is
forbidden before. An item can start in any phase once its *needs* are met, and a phase is
never "closed" by a calendar. *Needs* are questions or decisions required **before that item
ships**, not before the phase starts. Per-item status lives in [STATE.md](STATE.md).

| Phase | Scope | Needs before the item ships |
|---|---|---|
| 0 Foundation | Monorepo scaffolding; config loader and `jaari init` (asks for the target); `@jaari/llm` providers, tiers, roles, fallback chains; `ChannelAdapter` contract + CLI channel; `@jaari/capabilities` (manifest, loader, daemon–node contract, ADR-015/018); deny-all `@jaari/gate` stub; `@jaari/secrets` resolver with the `os-keychain` provider; laptop sleep/wake rule; install and `jaari doctor`; project process files | OQ-22, OQ-23, OQ-35, OQ-36 (sleep/wake), OQ-44, OQ-50 |
| 1 Memory | Memory repo and write path; retrieval and context assembly; scheduler and routines; canonicalize (6h); daily audit | OQ-24, OQ-43, OQ-53 |
| 2 Persona | Dials and monitor; curiosity from gap queue; quiet hours; notification ledger; prompt versioning; replay harness; skills (third-party ones disabled until the reader role exists); owner panel; onboarding; voice notes and optional spoken replies (ADR-037) | OQ-20, OQ-21, OQ-39, OQ-46, OQ-49 |
| 3 Safety | Real gate (digests, approvals, 15-minute expiry) + hash-chained `audit.jsonl`; vault providers (Bitwarden, 1Password); LLM/web budgets + usage log; kill switch; backup and encryption; shadow mode; threat model; degraded mode | OQ-25, OQ-29, OQ-38, OQ-47, OQ-48, OQ-51, OQ-64 |
| 4 Background work | Children; `llm.escalate`; `reader` role; `web.search`, `web.fetch`; `@jaari/http` resolve-check-dial egress with `direct` and `owner-exit` providers; MCP client with the first sandbox backend for local servers (ADR-034); code execution (ADR-036); headless CLI and external control | OQ-28, OQ-33, OQ-54, OQ-55, OQ-56 |
| 5 Integrations | GitHub, npm, PyPI, email; OAuth broker; the agent's mailbox; calendar, contacts, and file storage (ADR-039); documents (ADR-038); inbound triggers | OQ-41, OQ-42, OQ-52 |
| 6 Computer use | Browser via Playwright MCP or Stagehand under the placement rule (ADR-017); local profile or owner exit node; remote CDP; takeover; `computer.use` on a host virtual desktop; remote nodes via `jaari capability install`; macOS permission matrix | OQ-27, OQ-30, OQ-31, OQ-32, OQ-34, OQ-36 (permission matrix) |
| 7 Hardening | Firecracker backend; container egress proxy; overlay and sizing per target; multi-device state and host migration; observability; mobile and residential egress providers | OQ-37 |
| 8 Evals | `jaari llm eval` fixtures; behaviour evals; learned router experiment; learning from outcomes | OQ-20 (fixtures), OQ-40 |
| Later | Live calls (ADR-037); payments rail (`pay` is reserved, ADR-040); multimodal memory; trust tiers, agent network (non-goals for v1) | OQ-45 |

Egress arrives in steps: the address-class gate with `direct` and `owner-exit` for fetch in
Phase 4; the browser's SOCKS5 listener and owner-account pinning in Phase 6; `mobile` and
`residential-proxy` providers (anonymous traffic only) in Phase 7.
