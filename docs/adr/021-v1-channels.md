# ADR-021: v1 channels: CLI, web panel, Telegram; email as input only

- **Status:** Accepted
- **Extended by:** [ADR-071](071-capability-packages.md)
- **Date:** 2026-11-10

## Decision
v1 ships four channels behind the `ChannelAdapter` contract:
- **CLI** (`apps/cli`, local socket, `device` identity) in Phase 0, for development and admin.
- **Web panel** (`@jaari/channel-web`, `device` identity): the always-available fallback, and
  the only place for approval cards that do not fit a message, secret entry, and takeover.
- **Telegram** (`@jaari/channel-telegram`, Bot API via grammY, `account` identity paired with a
  one-time code from the CLI) as the first mobile messenger. It runs on every ADR-017 target,
  has an official free API, and carries no ban risk. A bot can message the owner first once
  the owner has started it, so proactive messages work.
- **Email** (`@jaari/channel-email`, IMAP/SMTP, `none` identity) in Phase 5 as an input only:
  mail is untrusted content read by the `reader` role and never counts as the owner.

The first channels after v1 are WhatsApp (with a `mode` setting and the ban risk documented)
and iMessage (on a Mac host or a Mac node, ADR-015). Signal, Discord, Matrix, and Slack stay
possible as plugins. Hosted bridges are never core dependencies.

## Alternatives rejected
Signal first (needs a dedicated number and a fragile Java sidecar); WhatsApp first (Baileys
is unofficial with a ban risk, the Meta Cloud API needs a Business account and template
approval for agent-initiated messages); iMessage first (Mac only, and on a VPS it waits for
Phase 6 nodes); two messengers in v1 (more scope before the contract is proven).

## Amendments
- **ADR-071:** channel plugins are capability packages with a checked `jaari` manifest (`kind: channel`).

## Consequences
_TODO: fill in as implementation reveals them._
