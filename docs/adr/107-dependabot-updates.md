# ADR-107: Dependabot version updates into `develop`; alerts on, security PRs off; bot exempt from DCO

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
`.github/dependabot.yml` covered only GitHub Actions and, with no `target-branch`, would open
pull requests against `main`. The npm (pnpm) dependencies were not covered. Two rules from
ADR-043 clash with Dependabot as it ships:
- The required `dco` check fails every Dependabot pull request: Dependabot cannot add a
  `Signed-off-by` trailer, and it has no option to do so.
- Dependabot security-update pull requests always target the default branch (`main`) and ignore
  `target-branch`, so they would skip `develop`.

## Decision
- **Version updates.** Weekly, for `github-actions` and `npm` (pnpm v12 is supported), with
  `target-branch: develop`. Minor and patch updates are grouped into one pull request per
  ecosystem; each major update gets its own. Commit prefixes are `ci` and `deps`.
- **Cooldown matches the release-age rule.** `cooldown: default-days: 7`, the same 7 days as
  pnpm `minimumReleaseAge` (ADR-043), so Dependabot never proposes a version pnpm would refuse.
- **Security.** Dependabot alerts are on; Dependabot security-update pull requests are off. A
  vulnerable dependency is fixed by the next version-update pull request or a manual bump on a
  branch from `develop`.
- **DCO exemption for the bot only.** The `dco` check skips a commit when the pull request was
  opened by `dependabot[bot]` (set by GitHub, not by the commit) and the commit's author is
  `49699333+dependabot[bot]@users.noreply.github.com`. Every other commit still needs a
  sign-off. A bot is not a contributor, so the DCO has nothing for it to certify.

## Alternatives rejected
- **Sign off Dependabot commits by hand.** Tedious, and once a person pushes to its branch,
  Dependabot stops rebasing that pull request.
- **Drop `dco` from the required checks.** It would stop enforcing the DCO for people too.
- **Security-update pull requests to `main`.** Faster fixes, but `main` and `develop` drift and
  every fix needs a back-merge.
- **Renovate.** More options (it can target `develop` for security fixes too), but it is a
  third-party app with wide repo access; Dependabot is built in and enough for now.

## Consequences
- Dependabot reads `dependabot.yml` from the default branch, so this config takes effect once
  `develop` is merged into `main`.
- A person with push access could set a commit's author to the Dependabot address and push it to
  a Dependabot branch to skip the sign-off. Only the owner has push access today; revisit if
  that changes.
