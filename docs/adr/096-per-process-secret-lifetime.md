# ADR-096: Separate long-running processes may hold their declared secrets while they run

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-034 resolves a local MCP server's declared `secretRef`s into its environment at start, so it
holds them while it runs, but ADR-007 and ADR-013 keep resolved values "only inside the executor
for the duration of the call" (OQ-80). The same holds for third-party packages in their own
process (ADR-071), channel plugins with their tokens (ADR-084), and the vault client (ADR-013).
Most MCP servers read keys only from environment variables. OpenMausBot passes MCP values as
write-only environment rows (`refs/openmausbot/docs/custom-mcp-servers.md`, commit `b802268`).

## Decision
**Two named lifetimes.** Per call: in-process executors, unchanged (ADR-007, ADR-013). Per
process: a separate long-running process (local MCP server, third-party package, channel plugin,
vault client) may hold its declared secrets while it runs; the process is the executor boundary.

**Conditions for per-process secrets.**
- Only names declared in the server config or the manifest `secrets` are resolved, at start.
- Values go into the process environment only inside the sandbox or the package's own process;
  never into the daemon's own environment, the logs, or anything the model sees.
- Every result and log line from the process is scrubbed by exact value (ADR-016).
- The process is stopped when idle (ADR-034), and the values go with it.
- A changed or rotated secret restarts the process; disabling or revoking it stops it at once.
- Each start writes an audit row naming the `secretRef`s it resolved, never their values.

**Unsandboxed local servers** (ADR-034) get secrets only through the per-server warning, and
the card names the secrets the server will hold.

## Alternatives rejected
Per-call injection for every process (most MCP servers cannot take it); an unbounded exception
(no restart on rotation, no stop when idle); refusing secrets to MCP servers (most useful
servers need a key).

## Consequences
_TODO: fill in as implementation reveals them._
