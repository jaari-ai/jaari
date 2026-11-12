# ADR-032: Observability: three records, opt-in traces, `jaari doctor`

- **Status:** Accepted
- **Extended by:** [ADR-038](038-documents-and-files.md), [ADR-087](087-safety-pieces-ship-with-what-they-protect.md)
- **Date:** 2026-11-10

## Decision
**Three records, one job each.**

| Record | Purpose | Retention |
|---|---|---|
| `audit.jsonl` | The authoritative, hash-chained record of decisions and effects (ADR-016) | Forever (ADR-029) |
| Event log (NDJSON) | Everything that happened: turns, tools, children, jobs, deliveries, limits that fired (ADR-031) | 30 days, configurable |
| Usage log (SQLite) | Per model call: role, model, tokens, cost, latency, outcome (ADR-011) | Forever |

**Traces.** `pi-telemetry` is the contract, with one OpenTelemetry adapter, off by default. When
the owner turns it on, it exports to any collector they run. Prompts and arguments are never
exported; only sizes, timing, and ids.

**Raw provider tee** (for protocol drift). Off by default; switched on per provider for a set
time; passes through the ADR-016 scrubber; deleted after 7 days.

**`jaari doctor`.** A read-only health check that exits non-zero when any check fails: daemon and
dependencies up; a channel silent too long; jobs stuck or `ambiguous`; the memory writer locked;
the last backup too old or failing its drill (ADR-027); disk encryption and file permissions
(ADR-028); budget status. The same checks show as a status strip in the panel.

**Panel views** (detailed in ADR-067): a per-message timeline of what Jaari did and why, built from
the event and audit logs; jobs and routines; usage and cost; errors that need attention.

**CLI.** `jaari status`, `jaari events --follow`, `jaari llm usage`, `jaari prompt --layers`
(ADR-024).

Borrowed: the telemetry contract and no-prompt export rule from Pi `packages/telemetry`; the
event union and raw tee from OpenMausBot (learning/09); the read-only gates command from
gajae-way (design only); the decisions view from Pally (learning/11).

## Alternatives rejected
OpenTelemetry on by default (most owners run no collector); exporting prompts or arguments in
traces (memory and secrets would leave the box); one log for everything (the audit record must
stay small, chained, and authoritative); a raw provider tee left on permanently.

## Amendments
- **ADR-038:** `jaari doctor` and the panel also show disk use per volume and the largest
  stored files; the daemon notifies at 80%, 90%, and 95% used.
- **ADR-087:** the event log and the usage log ship in Phase 0.

## Consequences
_TODO: fill in as implementation reveals them._
