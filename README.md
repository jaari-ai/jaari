# Jaari

A self-hosted personal AI agent, in the shape of the commercial ones (Instinct, Muse, Grok
Bot, ChatGPT Work), that you run yourself: on a VPS, a remote server, hardware at home, or a
laptop. Git-backed memory, a configurable personality, a browser it can drive, and
owner-approved external actions.

Jaari (جاري, "my neighbor" / "ongoing", pronounced JAH-ree) is a single-owner agent you
talk to over a messaging channel. It remembers in plain Markdown under git, works in the
background, gets to know you at a pace you set, and never takes an external action
(send, publish) without an approval bound to the exact action. Payments are reserved, not
in v1.

> **Status: Phase 0 (Foundation). Design only, no runnable code yet.** The architecture,
> decisions, and open questions are written down; packages are not scaffolded. See
> [docs/STATE.md](docs/STATE.md).

## Design in brief

| Area | Approach | Details |
|---|---|---|
| Hosting | Self-hosted, single owner. One daemon on a VPS, remote server, home hardware, or laptop; capabilities installed where they run; Tailscale as the default overlay | [ARCHITECTURE](docs/ARCHITECTURE.md), ADR-015/017 |
| Browser identity | Identity-bearing browsing runs on or through the owner's network (home box, owner device, Tailscale exit node); rotating proxies only for anonymous traffic | [WEB](docs/WEB.md), ADR-017 |
| Memory | Separate git repo of Markdown (gajae-way axes), canonicalized every 6 h, audited daily | [MEMORY](docs/MEMORY.md), ADR-003/004 |
| Personality | Curiosity and Proactivity dials (0 to 3) enforced by a monitor; proactive messages must earn the interruption | [PERSONA](docs/PERSONA.md), ADR-008 |
| Safety | Every external effect needs owner approval bound to a SHA-256 digest; secrets are `secretRef:` handles the model never sees; untrusted content goes through a tool-less `reader` role; the gate exists from Phase 0 | [SECURITY_MODEL](docs/SECURITY_MODEL.md), ADR-006/007/016/018 |
| Models | Provider-agnostic via Pi; role → tier → fallback chain; budgets and local-only roles | [LLM](docs/LLM.md), ADR-001/011/019 |
| Web | Pluggable `web.search`, `web.fetch` ladder, and browser via Playwright MCP or Stagehand | [WEB](docs/WEB.md), ADR-012 |
| Channels | Plugins behind a `ChannelAdapter` contract | [guides/channel-plugins](docs/guides/channel-plugins.md) |

## Documentation

| Doc | What it covers |
|---|---|
| [docs/STATE.md](docs/STATE.md) | What is done, what is next |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Principles, packages, trust boundaries |
| [docs/ROADMAP.md](docs/ROADMAP.md) | Soft phases 0 to 8 and what each item needs before it ships |
| [docs/ACTION_PLAN.md](docs/ACTION_PLAN.md) | Next steps |
| [docs/OPEN_QUESTIONS.md](docs/OPEN_QUESTIONS.md) | Undecided design questions (OQ-01 to OQ-66; some resolved) with current leanings |
| [docs/adr/](docs/adr/README.md) | Architecture decision records (the authoritative ADR numbering) |
| [docs/MEMORY.md](docs/MEMORY.md), [PERSONA.md](docs/PERSONA.md), [SECURITY_MODEL.md](docs/SECURITY_MODEL.md), [LLM.md](docs/LLM.md), [WEB.md](docs/WEB.md), [INTEGRATIONS.md](docs/INTEGRATIONS.md) | Subsystem designs |
| [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) | Dev setup, `refs/`, commands |
| [docs/guides/](docs/guides/channel-plugins.md) | [Writing a channel plugin](docs/guides/channel-plugins.md); [securing the npm and PyPI namespaces](docs/guides/namespaces.md) |
| [docs/00-research.md](docs/00-research.md), [docs/01-merge-plan.md](docs/01-merge-plan.md) | Background research and the original merge reasoning (historical) |
| [docs/learning/](docs/learning/README.md) | Learning log, one file per topic studied |

## Repository layout

~~~
README.md AGENTS.md CLAUDE.md   project and agent instructions
jaari.config.example.jsonc      example owner config (llm, web, persona, memory)
pnpm-workspace.yaml tsconfig*.json eslint.config.js vitest.config.ts
                                build config, allowlisted to packages/* and apps/*
docs/                           design docs, ADRs, open questions (hand-maintained)
scripts/merge_docs.py           merge all docs into one untracked file for AI discussions
scripts/refs.sh                 clone, pin, and lock the read-only reference repos
packages/  apps/                TypeScript packages and apps (not yet created)
refs/                           read-only reference repos (local only, git-excluded)
~~~

## Getting started (contributors)

Prerequisites: git, Node 22, pnpm, Python 3.

~~~bash
git clone https://github.com/jaari-ai/jaari && cd jaari
scripts/refs.sh                         # clone reference repos into refs/, pin, lock read-only
scripts/refs.sh status                  # commit, lock state, and license per ref
python3 scripts/merge_docs.py --check   # docs links and IDs are consistent
~~~

`pnpm install`, `pnpm -r build`, and `pnpm test` apply once Phase 0 adds the root
`package.json` and the first packages. Runtime config will be read from a copy of
[`jaari.config.example.jsonc`](jaari.config.example.jsonc); the config loader is a
Phase 0 item.

## Changing the docs

Docs are hand-maintained Markdown. Follow the conventions in
[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#docs) (ADRs, open questions, learning notes,
state), then run `python3 scripts/merge_docs.py --check`. To talk about the project with an AI
agent, run `python3 scripts/merge_docs.py` and give it the resulting `JAARI_CONTEXT.md`
(untracked, rebuilt on every run).

## Lineage

Jaari merges ideas from these projects. They are kept in `refs/` for study, not vendored:

| Project | License | What Jaari takes |
|---|---|---|
| [open-instinct](https://github.com/mariagorskikh/open-instinct) | MIT | Policy, capability tagging, and hosting shell; code reuse allowed with attribution. Trust tiers and the agent network are deferred (ADR-020) |
| [openinstinct](https://github.com/Yeachan-Heo/openinstinct) | None found | Runtime semantics, as a behavioral spec only; no code copied (ADR-009) |
| [gajae-way](https://github.com/Yeachan-Heo/gajae-way) | AGPL-3.0 | Memory axes design; no code copied |
| [Pi](https://github.com/earendil-works/pi) | MIT | Agent loop and multi-provider LLM access (ADR-001) |
| [OpenMausBot](https://github.com/milind-soni/OpenMausBot) | Apache-2.0 (`enterprise/` excluded) | Hardening details: egress gate, dispatch re-check, owner hold, routine semantics (ADR-016); no code copied |

Background on Instinct AI and Meta's Muse is in [docs/00-research.md](docs/00-research.md).

## License

MIT; see [LICENSE](LICENSE) and [ADR-014](docs/adr/014-license-mit.md). Third-party
notices for reused code are in [NOTICE](NOTICE).
