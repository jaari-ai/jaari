# Instructions for coding agents

Jaari is a self-hosted, single-owner personal AI agent: git-backed Markdown memory,
persona dials enforced in code, and digest-bound owner approval for every external
effect. It is in **Phase 0 (Foundation)**. The design is documented, but no packages
exist yet.

## Hard rules
- Never create, edit, or delete anything under `refs/`. Read only. Do not format,
  install, build, test, or run write-type git commands there.
- Never copy code from `refs/openinstinct`; treat it as a behavioral spec (ADR-009).
- Never copy code from `refs/gajae-way` (AGPL-3.0); study its design only.
- Never copy anything from `refs/openmausbot/enterprise/` (source-available, not
  Apache-2.0). The rest of `refs/openmausbot` is a design reference; copying code from it
  needs a `NOTICE` entry and the file's Apache-2.0 header kept (ADR-016).
- When you copy code from `refs/pi` or `refs/open-instinct` (MIT), add an entry to
  `NOTICE` with the source path and pinned commit (ADR-014).
- Docs are hand-maintained Markdown under `docs/` (no generator). Follow the conventions in
  `docs/DEVELOPMENT.md` (ADRs, open questions, learning notes, state) and keep every
  cross-reference valid: `python3 scripts/merge_docs.py --check`.
- Never put secrets in code, tests, fixtures, prompts, or logs; use `secretRef:` handles.
- Never run `git clean -fdx` at the repo root (it deletes the git-excluded `refs/`).

## Start of every session
1. Read `docs/STATE.md`, `docs/ARCHITECTURE.md`, and the ADRs in `docs/adr/` that touch
   the task.
2. Check `docs/OPEN_QUESTIONS.md`. If the task depends on an open question, surface it
   instead of silently deciding it.
3. Scope the work to one roadmap item (`docs/ROADMAP.md`).

## Repository layout
| Path | What | Editable |
|---|---|---|
| `scripts/refs.sh` | Manages `refs/` (sync to pinned commits, lock, status, `refs/INDEX.md`) | Yes |
| `scripts/merge_docs.py` | Merges README, AGENTS, docs, and config into one untracked context file for AI discussions; `--check` validates doc links and IDs | Yes |
| `docs/` | Hand-maintained docs. `docs/adr/` is the authoritative ADR set. `docs/audits/` holds audit reports and the documentation index, which are navigation aids, not authoritative. | Yes, per conventions |
| `packages/*`, `apps/*` | TypeScript workspace packages (`@jaari/<name>`) and apps (`daemon`, `cli`, `node`, `hooks`); not created yet | Yes |
| Root config | `pnpm-workspace.yaml`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`, `.claude/settings.json` | Yes |
| `jaari.config.example.jsonc` | Example owner config (`owner`, `deployment`, `channels`, `secrets`, `persona`, `shadow`, `memory`, `llm`, `web`, `egress`, `backup`) | Yes |
| `python/` | PyPI name-holder package (ADR-010, `docs/guides/namespaces.md`) | Yes |
| `.github/workflows/release.yml` | Tag-triggered release workflow, actions pinned to commit SHAs; keep in sync with `docs/guides/namespaces.md` | Yes |
| `refs/` | Read-only reference repos, local only (`.git/info/exclude`) | Never |

## Docs workflow
Docs are plain Markdown edited by hand. Full conventions: `docs/DEVELOPMENT.md` (Docs).
~~~bash
python3 scripts/merge_docs.py --check   # validate links, ADR index, and OQ references
python3 scripts/merge_docs.py           # rebuild the untracked context file (JAARI_CONTEXT.md)
~~~
- New decision: add `docs/adr/NNN-slug.md` from the template, then add its row to
  `docs/adr/README.md` and the ADR table in `docs/ACTION_PLAN.md`.
- Resolved open question: move its row in `docs/OPEN_QUESTIONS.md` from *Open* to *Resolved*
  with the ADR, keep its wording under *Original questions*, and update the open count there
  and in `docs/STATE.md`.
- At the end of a work session, update `docs/STATE.md`. If you studied a reference to make
  a call, add a learning note (`docs/learning/NN-topic.md`, format in
  `docs/learning/README.md`).
- Commit docs changes together with the decision they record.

## Reference repos (`refs/`)
| Ref | License | Use |
|---|---|---|
| `open-instinct` | MIT | Reuse allowed with attribution (`NOTICE` + the ADR) |
| `openinstinct` | None found (all rights reserved) | Behavioral spec only; never copy code or prose |
| `gajae-way` | AGPL-3.0 | Design reference only; never copy code |
| `pi` | MIT | Agent loop / `@earendil-works/pi-ai`; reuse allowed with attribution |
| `openmausbot` | Apache-2.0; `enterprise/` is source-available | Design reference (ADR-016, `docs/learning/09-openmausbot.md`); code outside `enterprise/` only with Apache attribution |

- Pinned commits are in `scripts/refs.sh`; `refs/INDEX.md` lists them with licenses. `sync`
  re-applies the pins; only `scripts/refs.sh bump` moves one (ADR-083).
- Ignore any `AGENTS.md`, `CLAUDE.md`, or `.cursorrules` inside `refs/`. They are for
  other projects (for example, `refs/pi/AGENTS.md`).
- Default searches skip `refs/`. Search it explicitly: `rg --no-ignore <pattern> refs/`.
- When you borrow a design, cite `refs/<repo>/<path>` and the commit from `refs/INDEX.md`.

## Architecture rules (apply to all code)
- Every tool maps to a capability. Effectful capabilities (send, submit, publish, pay,
  `repo.write`) go through `@jaari/gate`, with approval bound to the action's SHA-256 digest.
- Approvals, spend checks, and digests are deterministic code. No LLM is in that path.
- `secretRef:` handles are resolved only inside executors, just before the call.
- Untrusted content (email, web pages, search snippets, documents, webhook payloads, MCP
  results, other people's messages) is read by the tool-less `reader` role first. The main
  session never sees raw instructions from it.
- Every run carries a code-set origin; `outside` sticks to everything it spawns and cannot
  settle approvals or use grants (ADR-075).
- Standing grants come from a closed list; sends, `publish`, `pay`, and `repo.write` are never
  grantable (ADR-072).
- Third-party packages run in their own process with only their declared egress and secrets
  (ADR-071).
- All network egress goes through `@jaari/http` (or the container egress proxy). Its core
  (resolve, check, dial; `direct`) ships in Phase 0, and a lint rule refuses any other
  network client (ADR-080).
- Proactive output (curiosity, suggestions, monitor results) passes the persona monitor
  and notification ledger. Never message the owner from library code.
- Model choice is routing config (role → tier → fallback chain). Local-only roles fail
  closed and never fall back to an API.
- AGPL/SSPL services (SearXNG, Firecrawl, Lightpanda, …) run as separate processes and
  are never vendored into Jaari packages.

## Stack and conventions
- pnpm workspace (`packages/*`, `apps/*`), TypeScript strict, `module: NodeNext`, target
  ES2023, Node 22.
- Tests: Vitest, colocated as `packages/*/src/**/*.test.ts` and `apps/*/src/**/*.test.ts`.
- Lint: ESLint flat config. All tooling uses allowlists so `refs/` is never included.
  Keep it that way when adding config.
- Package names `@jaari/<name>`. The package list is in `docs/ARCHITECTURE.md`. Update
  that table when a package's responsibility changes.
