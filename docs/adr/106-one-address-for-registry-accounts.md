# ADR-106: Registry accounts use `hello@jaari.org`; no separate recovery inbox

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
ADR-043 kept a private `registry@jaari.org` inbox for the npm and PyPI accounts, separate from
the public `hello@jaari.org`. When the names were claimed (roadmap 0.4), the owner set up the
npm account `jaari-ai` with `hello@jaari.org`, and chose that address for every account.

## Decision
- **One address for everything.** npm, PyPI, and any other publishing account use
  `hello@jaari.org`. The project has no `registry@jaari.org` inbox.
- **The inbox is the recovery path, so it is hardened as one.** The `hello@jaari.org` mail
  account has 2FA with a security key, and registry accounts use security-key 2FA, so a
  password reset mail alone cannot take an account.

## Alternatives rejected
- **Keep a private `registry@` inbox (ADR-043).** It hides the recovery address from
  attackers, but it is one more inbox for a single owner to keep safe and to check.

## Consequences
- The recovery address is public. Phishing and password-reset attempts aimed at
  `hello@jaari.org` can target the registry accounts, so 2FA on the mail account and on each
  registry account is the main defence.
