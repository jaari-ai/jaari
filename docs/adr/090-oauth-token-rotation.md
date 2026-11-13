# ADR-090: Rotating an existing OAuth token is a bounded maintenance write, not an approval

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-062 writes rotated OAuth tokens back through the gated vault write, and ADR-072 makes every
credential write Allow once and never grantable. Read together, every token refresh would ask
the owner, and an unanswered request would break the connection (OQ-75). A rotated refresh
token usually invalidates the old one, so it must be stored at once: open-instinct does the same
("persist the new one at once", `refs/open-instinct/packages/payments/src/oauth.ts`, commit
`2e5e71b`).

## Decision
**Rotation needs no approval** and is not a grant; it is code run by the executor, never chosen
by the model or by content, whatever the run origin (ADR-075). ADR-072 is unchanged.

**Bounds.** A write skips the gate only when all hold: the vault item exists and was created by
an owner-approved `jaari connect` (ADR-062); it is the same item and provider account; the new
value came back from that provider's token endpoint, as listed in the provider data file,
through `@jaari/http`, in answer to a refresh that used the old token; only the refresh token
and its expiry change. Any other credential write goes through the gate as Allow once: a new
item, other fields, other scopes, or another account.

**Order.** The new token is written before the new access token is used. If the write fails,
the connection is marked "needs reconnect", the owner gets one notice, and nothing is retried.

**Record.** Each rotation writes an `audit.jsonl` row and an event-log entry with the item id
and provider, never the value.

## Alternatives rejected
Asking at every refresh (prompts every hour per account, or broken connections); a standing
grant for vault writes (ADR-072 keeps credentials out of grants); keeping the old token until
the owner approves (the provider has already invalidated it).

## Consequences
_TODO: fill in as implementation reveals them._
