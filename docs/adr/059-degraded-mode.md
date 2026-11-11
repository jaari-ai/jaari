# ADR-059: Degraded mode: hold only the broken part, a control surface without a model, queued messages answered automatically

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Hold only the broken part.** Each dependency has its own health state: each API provider, the
local runtime, each node, the owner exit, the vault, each channel, each MCP server, and disk. Only
work that needs a broken dependency waits; there is no global pause unless the owner pauses
(ADR-031).

**Model calls.** A send stamp is written just before a turn goes to a provider: an unstamped turn
may be requeued or failed over; a stamped one is reconciled and never resent (ADR-016). Jaari's
retry classifier sits in front of Pi's agent-level retry. Provider limit-reset times are
remembered instead of probed. The main session fails over as in ADR-019.

**A control surface without a model.** When every model in the chain is down, code answers: it
says what is unreachable and since when, and what still works (approvals and other prompts,
pause and stop, the task list, reminders). Commands, prompts (ADR-035), reminders with template
text, and deterministic schedules keep working. A plain "stop that" or "cancel the booking" is
matched to queued tasks by deterministic rules and cancels them before they run.

**The owner's messages are never dropped.** They queue and are answered automatically when a model
returns, marked "(delayed: sent 14:05)", however long the outage.

**Effectful work.** Queued effects keep their place; an approval that expired while waiting is
asked again, never used stale. Each queued task expires after 24 hours by default
(configurable), and the owner is told when one is dropped.

**Local and API roles.** Local-only roles keep running when the API is down; API roles wait and
never move to a local model except along their configured chains. At the budget limit, ADR-046
applies.

**What the owner is told.** One notice per outage per dependency on the active channel, and only
if it affects something the owner is waiting on; otherwise a digest line (ADR-033). On recovery,
one line ("back: answered 3 queued messages, ran 2 jobs"). The panel and `jaari doctor` show each
dependency's state and how long it has been in it.

**Fixtures.** Each degraded state is a tier-1 scenario (ADR-041): provider down, node down, disk
full, vault unreachable.

Borrowed: the send stamp and keeping the control surface up from the gajae-way runbook (docs
only); per-provider and per-connector holds from Pally (learning/11).

## Alternatives rejected
A global pause on any outage; dropping or expiring the owner's messages; asking whether delayed
answers are still wanted; resending a stamped turn; silent fallback from API to local models;
a notice for every failed call.

## Consequences
_TODO: fill in as implementation reveals them._
