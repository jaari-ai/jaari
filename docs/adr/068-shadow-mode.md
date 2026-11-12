# ADR-068: Shadow mode: only what Jaari starts on its own, per capability, 14 days by default, each new capability shadowed in turn

- **Status:** Accepted
- **Date:** 2026-11-12

## Decision
**Scope: what Jaari starts on its own.** Shadow mode applies to effects Jaari initiates: routines
and watchers (ADR-064), curiosity and follow-ups, background children, and learned behaviour
(ADR-061). What the owner asks for directly goes through the normal approval (Allow once,
ADR-036) from day one and is never shadowed. Reads, searches, and sealed sandbox runs are never
shadowed.

**Behaviour.** When Jaari would take a self-initiated effect on a shadowed capability, it takes
no action and records "would have done X" with the full canonical action and its digest. The
line appears in the digest (ADR-033) with **Do it now**, which is a normal Allow once approval
(ADR-035) bound to that digest; nothing new is trusted. An observe-only job fails closed: any
effect it attempts is refused and logged.

**Defaults and choice.** At `jaari init` the owner chooses shadow mode for 14 days (the default),
a custom length, or off. The setting is per capability, so one capability can stay shadowed while
another is live.

**Lifting.** At the end of the period Jaari sends one summary per capability, for example "In 14
days Jaari would have sent 12 emails on its own; you tapped Do it now on 11. Lift shadow mode for
email?", with Lift, Keep 14 more days, and Keep. After a Keep it asks once more, then never again
for that capability (as ADR-064). The owner can lift or re-enable at any time in the panel
(ADR-067) or with `jaari shadow lift | enable <capability>`. Every change is an `audit.jsonl`
entry, and the executor re-checks shadow state at dispatch (ADR-016).

**New capabilities start shadowed.** A capability installed later (an MCP server, ADR-034; a
skill, ADR-060; a browser adapter, ADR-048) starts its own 14-day period unless the owner skips
it at install. Owner-account browsing starts its period when Phase 6 ships.

**What the shadow logs feed.** The end-of-period summary; the commitment classifier fixtures and
classification log (ADR-051); the task-scoped origin review (ADR-052); and the evidence for any
standing grant (ADR-072).

**Phase 3**, with the real gate.

Borrowed: an observe-only job that fails closed on any effect from openinstinct
`assistant-work/tool-gate.ts` (behaviour only).

## Alternatives rejected
Shadowing the owner's direct requests (friction on top of Allow once); one global switch instead
of per capability; lifting automatically when the period ends; repeated lift prompts; a shadow
period only after the first install, so capabilities added later run live at once.

## Consequences
_TODO: fill in as implementation reveals them._
