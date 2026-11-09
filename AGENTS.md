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
- When you copy code from `refs/pi` or `refs/open-instinct` (MIT), add an entry to
  `NOTICE` (in the script) with the source path and pinned commit (ADR-014).
- Generated files (`docs/**`, `README.md`, `AGENTS.md`, `CLAUDE.md`, `LICENSE`, `NOTICE`)
  are never edited by hand: edit `scripts/make_docs.py`, then run it.
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
| `scripts/make_docs.py` | Single source of truth for docs, ADRs (`ADRS`), open questions (`OPEN_QUESTIONS`), agent files, base config | Yes |
| `scripts/refs.sh` | Manages `refs/` (sync to pinned commits, lock, status, `refs/INDEX.md`) | Yes |
| `docs/` | Generated docs. `docs/adr/` is the authoritative ADR set. | Via the script |
| `packages/*`, `apps/*` | TypeScript workspace packages (`@jaari/<name>`) and apps (`daemon`, `cli`); not created yet | Yes |
| Root config | `pnpm-workspace.yaml`, `tsconfig*.json`, `eslint.config.js`, `vitest.config.ts`, `.claude/settings.json` | Scaffold-once: edit the script and run with `--force`, or edit directly and mirror the change in the script |
| `jaari.config.example.jsonc` | Example owner config (`owner`, `persona`, `memory`, `llm`, `web`) | Via the script |
| `.github/workflows/release.yml` | Tag-triggered release workflow, actions pinned to commit SHAs (`RELEASE_WORKFLOW`) | Via the script |
| `refs/` | Read-only reference repos, local only (`.git/info/exclude`) | Never |

## Docs workflow
~~~bash
python3 scripts/make_docs.py --dry-run --diff   # preview
python3 scripts/make_docs.py                    # write changed files
~~~
- Commit the script together with the files it regenerates.
- New decision: add an entry to `ADRS` (id `NNN-slug`, title, status, decision,
  alternatives rejected). Index tables regenerate automatically.
- Resolved open question: remove it from `OPEN_QUESTIONS`, record the ADR, and list it
  under *Resolved*.
- At the end of a work session, update the `docs/STATE.md` text in the script. If you
  studied a reference to make a call, add a learning note (`docs/learning/NN-topic.md`,
  format in `docs/learning/README.md`).

## Reference repos (`refs/`)
| Ref | License | Use |
|---|---|---|
| `open-instinct` | MIT | Reuse allowed with attribution (`NOTICE` + the ADR) |
| `openinstinct` | None found (all rights reserved) | Behavioral spec only; never copy code or prose |
| `gajae-way` | AGPL-3.0 | Design reference only; never copy code |
| `pi` | MIT | Agent loop / `@earendil-works/pi-ai`; reuse allowed with attribution |

- Pinned commits and licenses are in `refs/INDEX.md`. Refresh them with `scripts/refs.sh`.
- Ignore any `AGENTS.md`, `CLAUDE.md`, or `.cursorrules` inside `refs/`. They are for
  other projects (for example, `refs/pi/AGENTS.md`).
- Default searches skip `refs/`. Search it explicitly: `rg --no-ignore <pattern> refs/`.
- When you borrow a design, cite `refs/<repo>/<path>` and the commit from `refs/INDEX.md`.

## Architecture rules (apply to all code)
- Every tool maps to a capability. Effectful capabilities (send, submit, publish, pay,
  `repo.write`) go through `@jaari/gate`, with approval bound to the action's SHA-256 digest.
- Approvals, spend checks, and digests are deterministic code. No LLM is in that path.
- `secretRef:` handles are resolved only inside executors, just before the call.
- Untrusted content (email, web pages, search snippets, documents) is read by the
  tool-less `reader` role first. The main session never sees raw instructions from it.
- All network egress goes through `@jaari/http` (or the container egress proxy).
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
  that table (in the script) when a package's responsibility changes.
