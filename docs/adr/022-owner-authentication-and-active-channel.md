# ADR-022: Owner authentication: pluggable pairing, one device registry, one active channel

- **Status:** Accepted
- **Extended by:** [ADR-076](076-external-control-surface.md), [ADR-101](101-mcp-client-and-active-channel.md)
- **Date:** 2026-11-10

## Decision
**Authority.** Owner authority is minted in one place, channel ingress, after principal
resolution. A plugin reports only the raw sender handle. Unknown senders get nothing. Email
(`none` identity) is never the owner. The identity table in ARCHITECTURE.md (`carrier`,
`account`, `device`, `none`) is decided as written.

**Paired channels are equal.** Once paired, a channel is a way in and out for messages and
calls with the same authority as any other paired channel. There is no step-up rule that
limits what a channel may approve. An optional per-channel capability cap exists in config
and is off by default.

**One active channel.** The active channel is the one the owner's latest inbound message
came from; an inbound call the owner places also makes its channel active. Opening the web
panel does not. Replies, approval cards, proactive messages, and takeover links go only to
the active channel: no fan-out, no parallel streams. When the owner writes from another
paired channel, that channel becomes active and the same session continues there; history is
never replayed into it. After a long silence, proactive messages still go to the last active
channel.

**Pairing is pluggable.** Each method ends in the same place: a hashed token in one device
registry. Methods are enabled at `jaari init` and can be changed later. Built-in methods:
CLI code (`jaari pair` prints a code the new channel sends); web pairing request (the new
device asks in the panel, an approve link goes through an already-trusted channel); QR that
pins the daemon's key; one-time web link; and config (a handle such as `owner.phones` or a
Telegram user id written in config). Shared limits: single use, 10 minutes, 5 wrong tries
then a lockout, constant-time comparison, and the code is stripped before the model sees it.
The first pairing needs host access (`jaari init` or the CLI): owning the box is the root of
trust. Nodes (ADR-015) pair through the same registry.

**Revocation.** `jaari devices list | revoke <id>`, also in the panel. Revocation is
immediate and cancels pending approvals sent to that device. Paired devices do not expire on
their own.

## Alternatives rejected
A step-up rule that requires a `device` channel for high-risk approvals (too strict for daily
use; the owner chose equal channels plus revocation); fan-out of replies to every paired
channel (duplicate streams, unclear which reply settles what); replaying history into a newly
active channel (the stale-message failure openinstinct's cursor rule exists to prevent); one
fixed pairing method (excludes devices without a screen or a keyboard); revocation by editing
config only (too blunt for a stolen phone); a long-lived setup password (a standing secret);
automatic device expiry (re-pairing friction with little gain for a single owner).

## Amendments
- **ADR-076:** adds a pairing method: an MCP client is paired by a code the owner types in their chat, which creates a revocable `device`.
- **ADR-101 (resolves OQ-88):** a paired MCP client is not a channel and never becomes active;
  a pull of a request's own result by its handle is not fan-out.

## Consequences
_TODO: fill in as implementation reveals them._
