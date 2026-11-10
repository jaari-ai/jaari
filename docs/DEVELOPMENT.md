# Jaari: Development

## refs/ (read-only references, ADR-002)
`scripts/refs.sh` manages them. The manifest (name, URL, pinned ref) is inline in the script.
~~~bash
scripts/refs.sh                  # sync: clone/update every ref to its pin, then lock
scripts/refs.sh sync pi          # one ref only
scripts/refs.sh status           # commit, date, lock state, license per ref
scripts/refs.sh lock             # re-apply chmod -R a-w
~~~
- `sync` adds `/refs/` to `.git/info/exclude`, refuses to run if `refs/` is tracked,
  disables pushes from each ref, and rewrites `refs/INDEX.md` (commit + license per ref).
- Claude Code: `.claude/settings.json` denies edits under `refs/`.
- Codex and other agents: `AGENTS.md` forbids writing to `refs/`; the chmod enforces it.
- pnpm, TSConfig, ESLint, Vitest use allowlists (`packages/*`, `apps/*`), so `refs/` is
  never included.
- Search tools that honour git excludes (ripgrep) skip `refs/`; search it explicitly with
  `rg --no-ignore <pattern> refs/`.
- Never run `git clean -fdx` at the repo root: it deletes excluded files, including `refs/`.

## Commands
~~~bash
python3 scripts/merge_docs.py --check           # works today: validate docs
pnpm install                                    # once the root package.json exists (Phase 0)
pnpm -r build
pnpm test
~~~

## Docs
Docs are hand-maintained Markdown under `docs/`, plus `README.md`, `AGENTS.md`, and
`CLAUDE.md`. There is no generator. One topic lives in one file; other files link to it.
After any change run `python3 scripts/merge_docs.py --check`.

### Layout
| Path | Holds |
|---|---|
| `docs/STATE.md` | What is decided and built, what is next; updated at the end of each session |
| `docs/ARCHITECTURE.md`, `SECURITY_MODEL.md`, `LLM.md`, `WEB.md`, `MEMORY.md`, `PERSONA.md`, `INTEGRATIONS.md` | Subsystem designs |
| `docs/ROADMAP.md`, `ACTION_PLAN.md` | Soft phases (ADR-020) and the ordered next steps; `ACTION_PLAN.md` also carries the ADR table |
| `docs/OPEN_QUESTIONS.md` | Undecided questions |
| `docs/adr/` | One file per decision, plus `README.md` index |
| `docs/guides/` | How-to guides |
| `docs/learning/` | One note per topic studied, plus `README.md` |
| `docs/00-research.md`, `01-merge-plan.md` | Historical captures; do not rewrite, correct with a pointer |

### ADRs
- File: `docs/adr/NNN-slug.md`, next free number, kebab-case slug.
- Template:

~~~md
# ADR-NNN: Title

- **Status:** Proposed | Accepted | Superseded by ADR-MMM
- **Extended by:** [ADR-MMM](MMM-slug.md)   (only when a later ADR amends this one)
- **Date:** YYYY-MM-DD

## Decision
...

## Alternatives rejected
...

## Amendments            (only when amended: "- **ADR-MMM:** what changed")
## Flagged conflicts     (only while a conflict is open: "- [OQ-NN](../OPEN_QUESTIONS.md): ...")

## Consequences
_TODO: fill in as implementation reveals them._
~~~

- An Accepted ADR is not rewritten. Change it with a new ADR, then add an `Extended by` line
  and an `Amendments` entry to the old one.
- Add the row `| [NNN](NNN-slug.md) | Title | Status |` to `docs/adr/README.md` and
  `| [NNN](adr/NNN-slug.md) | Title | Status |` to the ADR table in `docs/ACTION_PLAN.md`.

### Open questions
- A row in a section table of `docs/OPEN_QUESTIONS.md`:
  `| OQ-NN | Topic | Question | Blocks phase | Leaning |`. IDs are never reused; take the next
  number. "Blocks phase" is the phase of the item that needs the answer (ADR-020).
- Resolve it: decide, write or amend an ADR, delete the row, add `| OQ-NN | Decision | [ADR-NNN](adr/NNN-slug.md) |` to
  *Resolved*, and update the "Open: N" count there and the count in `docs/STATE.md`.
- Mention the ID in `docs/ROADMAP.md` (Needs column) for the item it gates.

### Learning notes
`docs/learning/NN-topic.md`, answering the three questions in `docs/learning/README.md`; add
it to that file's *Written* list. Cite references as `refs/<repo>/<path>` with the pinned commit.

### Context file for AI discussions
`python3 scripts/merge_docs.py` writes `JAARI_CONTEXT.md` at the repo root: a compacted merge
of README, AGENTS, all docs, the example config, and `refs/INDEX.md`, with a file tree and git
state. It is git-ignored and overwritten on every run. Options: `--out PATH`, `--code`
(include `packages/` and `apps/` sources), `--check` (validate only, write nothing).
