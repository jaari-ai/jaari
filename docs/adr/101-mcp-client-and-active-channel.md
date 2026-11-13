# ADR-101: A paired MCP client is not a channel; `collect` is a pull by the requester

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
ADR-076 gives a paired desktop AI app two tools, `send_message` (returns a handle) and
`collect` (gets the result by handle), and sends approvals to the active channel. ADR-022 sends
replies only to the one active channel, with no fan-out and no parallel streams. Whether an MCP
message makes the client active, or whether `collect` is a second output stream, was undecided
(OQ-88).

## Decision
**Not a channel.** A message from a paired MCP client never changes the active channel.

**A pull, not a stream.** `collect` returns only the result of a request the client made, by its
handle, when it asks; Jaari never pushes to the client. No message goes to two places, so
ADR-022's "no fan-out" holds. `jaari run` and `jaari wait` (ADR-076) work the same way.

**Where output goes.** The request's own result: only to `collect`, not repeated in the owner's
chat. Approvals and questions it needs: to the active channel, with the client named on the
card; meanwhile `collect` reports "waiting for approval" (as CLI exit code 2). Proactive messages,
digests, and other replies: never to the client.

**The main session stays aware.** Each MCP request runs as its own job with the `owner` origin
(ADR-075) and leaves one line in the main session's history ("<client> asked: ...; result
collected").

## Alternatives rejected
Making the client the active channel (approvals would land in another app's context, where
injected text can steer them); sending results to both the client and the chat (fan-out).

## Consequences
_TODO: fill in as implementation reveals them._
