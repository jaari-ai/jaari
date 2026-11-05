# Claude Code instructions

@AGENTS.md

## Claude Code specifics
- `.claude/settings.json` denies `Edit(./refs/**)`, and `refs/` is `chmod -R a-w`. A
  denied or failed write under `refs/` is intended; do not work around it.
- Searches that honour git excludes (ripgrep-based Grep) can skip `refs/`. Pass a
  `refs/...` path explicitly when you need to search a reference.
- Do not edit generated files with Edit or Write. Change `scripts/make_docs.py` and run
  `python3 scripts/make_docs.py`.
