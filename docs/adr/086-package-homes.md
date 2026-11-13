# ADR-086: Package homes for eleven subsystems; two new homes, `@jaari/mcp` and `apps/hooks`

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
The package table in ARCHITECTURE.md had no owner for the job engine, file store, skills,
routines, hook listener, MCP client and server, CLI engines, speech, OAuth broker, mailbox
adapters, and observability (OQ-90).

## Decision
**Rule.** A new package or app only for a separate process or a separate trust boundary;
otherwise the package that owns the neighbouring parts.

| Subsystem | Home |
|---|---|
| Job engine (ADR-025) | `@jaari/core`; `apps/daemon` runs the scheduler tick |
| Routines (ADR-064) | `@jaari/core` |
| Skills (ADR-060) | `@jaari/core`, through the tool registry (`skill.load`) |
| CLI engines (ADR-077) | `CliEngine` interface in `@jaari/core`; each engine is an ADR-071 package, Pi first |
| File store (ADR-038) | `@jaari/memory` |
| Speech (ADR-037) | `@jaari/llm` (`stt` and `tts` roles) |
| OAuth broker (ADR-062) | `@jaari/integrations`; tokens are written through the gated vault write in `@jaari/secrets` |
| Mailbox adapters (ADR-063) | `@jaari/integrations` |
| Observability (ADR-032) | Event log and the OpenTelemetry adapter in `@jaari/core`; the usage log stays in `@jaari/llm`, `audit.jsonl` in `@jaari/gate`; `jaari doctor` in `apps/cli` collects each package's `health` |
| MCP client and server (ADR-034, ADR-076) | New `@jaari/mcp`; the server runs as `jaari mcp` in `apps/cli` |
| Hook listener (ADR-073) | New `apps/hooks`, a separate process; it hands verified events to the daemon over the local socket |

## Alternatives rejected
One package per subsystem (eleven packages with no boundary between them); splitting MCP
between `@jaari/capabilities` (client) and `apps/cli` (server) (one untrusted boundary in two
places); running the hook listener inside `apps/daemon` (ADR-073 requires a separate process).

## Consequences
_TODO: fill in as implementation reveals them._
