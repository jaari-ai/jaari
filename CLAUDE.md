# Claude Code instructions

@AGENTS.md

## Claude Code specifics
- `.claude/settings.json` denies `Edit(./refs/**)`, and `refs/` is `chmod -R a-w`. A
  denied or failed write under `refs/` is intended; do not work around it.
- Searches that honour git excludes (ripgrep-based Grep) can skip `refs/`. Pass a
  `refs/...` path explicitly when you need to search a reference.
- Docs under `docs/` are hand-edited Markdown; follow `docs/DEVELOPMENT.md` (Docs). Run
  `python3 scripts/merge_docs.py --check` after changing them. `JAARI_CONTEXT.md` is an
  untracked build artifact: never edit it, regenerate it.

## Ownership

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.
