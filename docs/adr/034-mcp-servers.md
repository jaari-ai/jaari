# ADR-034: MCP servers: owner-added, pinned, classified in one step, sandboxed from Phase 4

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Client.** Pi `pi-mcp` (stdio, HTTP, OAuth), used as a library. Tools are named
`mcp__<server>__<tool>`. Third-party skills are a separate question (OQ-39).

**Adding a server.** The owner adds a server by address in chat, in the panel, or in config.
The model may propose one; it arrives switched off, and enabling it is an approval bound to the
digest of its config. There is no marketplace auto-install.

**Every tool maps to a capability (amends ADR-018).** The vocabulary gains two names: `mcp.read`
(read) and `mcp.act` (gated). A tool that matches an existing name maps to it instead (a mail
tool that sends is `email.send`, a file reader is `files.read`); server and tool are manifest
fields, never part of the name. When a server connects, Jaari pre-classifies each tool with
deterministic rules (verbs in the name, the input schema, open-instinct's money, sending, and
calendar patterns) and shows one card: the whole server's mapping, each tool with its suggested
capability. The owner confirms it in one step or changes single rows. Until confirmed, and for
any tool the rules cannot read (ADR-016: unreadable is flagged), the tool is `mcp.act`. A
server's own hints (`readOnlyHint` and the rest) are never trusted and never lower a class.

**Pinning against silent changes.** Jaari stores a SHA-256 of the server's config and of its
tool list with names, descriptions, and schemas. If either changes, the server is held until the
owner re-approves; the card shows the difference. Standing grants (OQ-51) are keyed on the same
fingerprint, so any edit revokes them.

**Server text is untrusted.** Server instructions are not followed. Tool descriptions reach the
model fenced as data, and results are untrusted content: large results and results from outside
the owner's own data go through the `reader` role. Results are capped at 20 KB, the full text
kept aside for the reader to page through.

**Sandbox, brought forward to Phase 4.** Local (stdio) servers run in a sandbox that ships with
the MCP client, the first sandbox backend; OQ-15 later reuses it for code execution.
- A container (Docker or Podman, the default where one is present) or bubblewrap on Linux.
- No network except a loopback proxy into `@jaari/http`, so every request passes the
  resolve-check-dial gate (ADR-016), the same pattern as the browser's SOCKS5 listener.
- A per-server working directory, no host home directory, a read-only root.
- Only the `secretRef`s declared for that server, resolved at start into its environment; OAuth
  tokens stay in the vault (OQ-41).
- CPU, memory, and process limits; the server is stopped when idle.

Where no backend exists (for example macOS without a container runtime), the owner can still
run a local server by accepting, per server, a warning that it is unsandboxed and can reach the
network and files directly. The card says so, the audit row records it, and `jaari doctor`
lists unsandboxed servers. Remote (HTTP) servers need no sandbox: Jaari's calls to them go
through `@jaari/http`.

Borrowed: the client, tool naming, and 20 KB cap from Pi `packages/mcp`; capability tagging and
the stricter patterns from open-instinct `apps/src/capabilities.ts`; config-hash grants and the
switched-off proposal from OpenMausBot (learning/09); adding a server by address from Pally
(learning/11), without following its instructions.

## Alternatives rejected
Trusting server annotations or instructions (Pally's choice; a server is untrusted code and
text); unknown tools defaulting to read; asking per tool call until each tool is classified
(noisy, and owners would approve blindly); pinning only the config (a server can swap a tool's
description or add tools without a config change); forbidding local servers until Phase 7 (many
useful servers are local); running local servers unsandboxed with no warning (they bypass the
egress gate); a marketplace with auto-install.

## Consequences
_TODO: fill in as implementation reveals them._
