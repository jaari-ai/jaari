# Contributing to Jaari

Thank you for your interest. Jaari is in Phase 0: the design is in [docs/](docs/), and the
first packages are being built ([docs/ROADMAP.md](docs/ROADMAP.md)). This page says how to get
a change merged.

To report a security problem, do not open an issue. Follow [SECURITY.md](SECURITY.md).

## Before you start

- Read [docs/STATE.md](docs/STATE.md) and the ADRs in [docs/adr/](docs/adr/README.md) that touch
  your change. A change that goes against an accepted ADR needs a new ADR first.
- For anything larger than a small fix, open an issue first so we can agree on the approach.
- Set up the repo as in the [README](README.md#getting-started-contributors).

## Pull requests

- Branch from `develop`, and open the pull request against `develop`. `main` only receives
  merges from `develop`.
- Keep one topic per pull request. The title becomes the changelog line, so make it clear.
- `pnpm check` (lint, typecheck, tests) must pass.
- If you change docs, follow [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md#docs), and run
  `python3 scripts/merge_docs.py --check`.
- CI runs these checks, plus the DCO check, gitleaks, and the licence check, on every pull
  request.

## Sign-off (DCO)

Every commit must carry a `Signed-off-by:` line. It states that you have the right to submit
the change under the project's MIT licence, as set out in the
[Developer Certificate of Origin](https://developercertificate.org/). Add it with:

~~~bash
git commit -s
~~~

CI refuses a pull request with an unsigned commit. To fix one, run
`git commit --amend -s` (last commit) or `git rebase --signoff develop` (all commits), and
force-push your branch. There is no CLA.

## Code from other projects

The projects Jaari studies are listed in the [README](README.md#lineage), each under its own
licence. Copy code from them only as [ADR-014](docs/adr/014-license-mit.md) and
[ADR-016](docs/adr/016-openmausbot-hardening.md) allow, and add an entry to [NOTICE](NOTICE)
when you do. Some of them may never be copied from; [AGENTS.md](AGENTS.md) lists which.

New dependencies must have a licence on the ADR-014 allowlist, are pinned to an exact version,
and must be at least 7 days old ([ADR-043](docs/adr/043-project-process.md)).

## AI-assisted contributions

You may use AI tools. The person who signs off a commit is responsible for it: you must
understand the change and be able to explain it. Coding agents must follow
[AGENTS.md](AGENTS.md).

## Contact

General questions: `hello@jaari.org`.
