# Claude Code instructions

@AGENTS.md

## Claude Code specifics
- `.claude/settings.json` denies `Edit(./refs/**)`, and each repo under `refs/` is
  `chmod -R a-w` (`refs/INDEX.md` is rewritten by `scripts/refs.sh`). A
  denied or failed write under `refs/` is intended; do not work around it.
- Searches that honour git excludes (ripgrep-based Grep) can skip `refs/`. Pass a
  `refs/...` path explicitly when you need to search a reference.
- Docs under `docs/` are hand-edited Markdown; follow `docs/DEVELOPMENT.md` (Docs). Run
  `python3 scripts/merge_docs.py --check` after changing them. `JAARI_CONTEXT.md` is an
  untracked build artifact: never edit it, regenerate it.

## Package documentation
- Before you use or change a call to a third-party package, read its current documentation
  through Context7 (`resolve-library-id`, then `query-docs`). Do not rely on memory: APIs change
  between versions.
- If Context7 has no entry for the package, or its entry does not cover the version pinned in
  this repo, fall back to the package's own documentation, in this order: its README and docs
  for the pinned version, its type declarations (`node_modules/<package>/**/*.d.ts`), then its
  source code. Confirm the behaviour with a short run when the documentation is unclear.
- Say in your update which source you used, so a wrong API can be traced.

## Ownership

This codebase is yours: what it's for and how it's built are your call, and you'll keep building on it.

## About me as a developer
- My level: comfortable with HTML/CSS and JavaScript, new to TypeScript, midium level in nodejs, comfortable with sql but new to postgresql, comfortable with Docker and CI/CD
- What I want to learn deeply in this project: API design, database modelling, testing, deployment, typescript, node, AI, llm and models
- I work in mentor mode (Mentor output style): explain, don't quiz me.