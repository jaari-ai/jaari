# ADR-076: External control surface: headless CLI commands on the local socket, a two-tool MCP server for paired desktop apps in v1, nothing that approves or changes policy

- **Status:** Accepted
- **Extended by:** [ADR-101](101-mcp-client-and-active-channel.md)
- **Date:** 2026-11-12

## Decision
**Scripts use the local CLI.** `apps/cli` adds `jaari run "<request>" [--wait <time>]`,
`jaari wait <handle>`, `jaari status <handle>`, and `jaari export <handle>` over the existing local
socket (ADR-021: mode 0600, NDJSON with version negotiation). Each command prints one JSON
document. Exit codes: 0 done; 2 needs input (an approval or question is waiting on the active
channel); 3 still running (check again with the handle); 4 failed; 5 refused (paused, over budget,
or not allowed). `--wait` defaults to 10 minutes and long-polls. Script runs have the `routine`
origin (ADR-075); approvals go to the active channel.

**Approving from the CLI needs a person at the keyboard.** Approval and other admin commands ask
for confirmation in an interactive terminal; without a TTY they are refused. The socket can start
work but never approve it.

**An MCP server for desktop AI apps, in v1.** Off by default. Paired with a code the owner types in
their chat (ADR-022), which creates a revocable `device`. Two tools: `send_message` (ask or start
work; returns a handle) and `collect` (get the result by handle). Transports: stdio through
`jaari mcp`, or HTTP over the overlay with the device token (ADR-030). Runs from a paired client
are trusted like the owner's own messages on a paired channel (`owner` origin, ADR-075), so
grants apply (ADR-072); approvals still go to the active channel, and the card names the client.

**Never exposed through any external surface:** approving or denying; creating or widening
grants; secrets and the vault; editing policy, persona, or rules; installing capabilities;
forget, erase, and purge; pairing or revoking devices; lifting shadow mode; raising the budget;
resuming after a stop. Only vocabulary names from manifests are reachable (ADR-071).

**Limits.** Runs count toward the budget (ADR-046); at most 2 concurrent runs per client; the
client id is in every audit row.

**Phasing.** Phase 4: the CLI commands. Phase 5: the MCP server.

Borrowed: the local socket at 0600 with NDJSON and version negotiation, read-only status, and a
distinct "still running" exit with a handle from openinstinct `control/socket.ts` and
`control/schema.ts` (behaviour only); the two-tool MCP server paired by a code typed in the
owner's chat from Pally (learning/11).

## Alternatives rejected
An MCP server that approves, edits policy, or manages secrets; approving from a non-interactive
script; treating a paired MCP client as outside content (owner choice: it is paired like any
channel); an MCP server only after v1; a public HTTP surface.

## Amendments
- **ADR-101:** a request's result goes only to `collect`; approvals go to the active channel
  while `collect` reports waiting; each request leaves one line in the main session's history.

## Consequences
_TODO: fill in as implementation reveals them._
