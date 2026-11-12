# ADR-077: Subscription CLI engines: pluggable CliEngine adapters for sandboxed children only, Pi first, the gate answering the CLI's permission requests, off until the owner enables each engine

- **Status:** Accepted
- **Extended by:** [ADR-091](091-engine-runs.md)
- **Date:** 2026-11-12

## Decision
**Never for the main session** (ADR-001).

**A pluggable `CliEngine` adapter**, a package kind under ADR-071. Pi over RPC (`pi --mode rpc`)
first; then Claude Code (`claude -p` with stream-json output), Codex (`codex exec`), and Gemini
CLI; any other CLI through a custom adapter.

**Children only, on code or research tasks, inside the sealed sandbox** (ADR-036): a workspace
copy; no credentials except the CLI's own sign-in, mounted read-only for that run; network reach
limited to that provider's API hosts. The CLI's own web access is off by default.

**The gate stays in charge.** The CLI runs in its own ask mode. Where it exposes permission
requests (for example Claude Code's permission hook or Codex's approval policy), Jaari's gate
answers them. Changes inside the sandbox are sealed and need no approval. The CLI cannot push,
publish, or send: its result returns as files or a diff, which Jaari applies through its own
gated capabilities (for example `repo.write`, Allow once).

**Output is untrusted.** It goes through the `reader` role. The run keeps its parent's origin
while the CLI's web access is off; with web access on, the run is `outside` (ADR-075).

**Usage.** Subscription work is not billed per dollar, so Jaari records runs and time per engine,
shown in Usage (ADR-067); routine caps apply (ADR-064).

**Off by default; the owner enables each engine.** Each adapter carries a note on the provider's
terms, checked against the provider's current terms when the adapter is built and recorded in a
learning note. `jaari init` and the enable prompt show it.

**Phase 4**, with the sandbox.

Borrowed: driving the owner's installed CLIs as engines from OpenMausBot (learning/09); Pi's RPC
mode as the first engine from Pi `coding-agent/docs/rpc.md` (docs only).

## Alternatives rejected
A CLI engine for the main session; CLI engines with secrets or effectful capabilities; letting the
CLI push, publish, or send itself; web access on by default; enabled by default without a terms
note.

## Amendments
- **ADR-091 (resolves OQ-76):** these are engine runs, not sealed runs; on owner files the first
  run per workspace asks Allow once or a 90-day `engine.run` grant; scratch workspaces run without
  asking once enabled; web access on makes the run `outside`; the child time limit applies.

## Consequences
_TODO: fill in as implementation reveals them._
