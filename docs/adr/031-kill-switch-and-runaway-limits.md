# ADR-031: Pause, emergency stop, and runaway limits, enforced in code and configurable

- **Status:** Accepted
- **Extended by:** [ADR-087](087-safety-pieces-ship-with-what-they-protect.md), [ADR-116](116-owner-commands-in-code.md)
- **Date:** 2026-11-10

## Decision
Every limit below is enforced in code, is configurable by the owner, and logs to the audit log
when it fires. The numbers are defaults.

**Pause** ("pause", "stop everything", the panel, or `jaari pause`). A durable flag that survives
restarts. New turns, routines, children, and proactive messages stop. The owner's messages are
still received and kept, but no turn runs; on resume Jaari asks whether to handle them now and
reports in one line what was skipped. Pending approvals stay pending, and nothing dispatches
while paused (the ADR-016 re-check reads the flag).

**Emergency stop** ("stop now", a panel button, or `jaari stop --now`). Everything pause does,
plus: every running turn and child is aborted (Pi abort and the ADR-025 job tree), pending
approvals are cancelled, and a step that was mid-action settles `ambiguous`; the owner is told
exactly what was cut.

**Runaway limits.**
- Steps per turn: 25 for the main session, 50 per child; when reached the job stops and reports.
- Children: 4 running, 16 alive, 30 minutes each.
- Stall guard: two continuations without a successful tool call, or three identical errors, end
  the job as `stalled` with one notice.
- Watchdog: 300 seconds without activity on a turn, sleep-aware so a laptop waking up does not
  trip it.
- Lowering a capability's permission stops the turn that is using it.
- Loop breaker: replying to another bot in a loop stops after 3 exchanges.

**Spend spikes.** An alert when spending in the last hour is more than 3 times the usual hourly
rate, or when one job passes a set amount ($2); one notice per spike, offering a pause. Monthly
budgets are ADR-046.

**Repeated failures.** After 2 failed turns in a row, further failure notices go to the log only,
with one line saying so; the next success resets it.

**Quiet when the owner stops answering.** After 7 days with no reply or reaction to proactive
messages, Jaari pauses proactive messages until the owner writes again and says so once. Replies
to the owner's own messages are never affected. The period is configurable and the rule can be
turned off. It is a persona monitor rule (ADR-008).

Borrowed: the durable pause flag, child caps, watchdog, and failure-notice rule from openinstinct
(behaviour only); the sleep-aware watchdog from gajae-way (design only); abort and step limits
from Pi; the 7-day quiet rule and the loop breaker from Pally (learning/11).

## Alternatives rejected
No step limit (open-instinct; a runaway loop burns budget until someone notices); queueing the
owner's messages silently during a pause and running them all on resume (stale requests run
without the owner deciding); one stop that both pauses and kills (the owner sometimes wants
running work to finish); fixed, non-configurable limits.

## Amendments
- **ADR-087 (resolves OQ-71):** pause, emergency stop, steps per turn, the stall guard, and the
  watchdog ship in Phase 0; spike alerts in Phase 1; the loop breaker and the persona rules in
  Phase 2; permission lowering in Phase 3; child limits in Phase 4.
- **ADR-116 (resolves OQ-94):** code reads the commands in the owner's languages; a bare stop word
  pauses, a second one within 10 seconds is the emergency stop, and "wait" or "hold on" pauses.

## Consequences
Built in `@jaari/core` (roadmap 0.5, 2026-11-16):
- The step limit and the stall guard run in Pi's `finishTurn` hook, after every step. A step counts
  as failed when it called tools and every call failed; two in a row, or three identical tool
  errors in one turn, end the turn as `stalled`.
- The watchdog checks every 5 seconds. A gap of more than 2 minutes between two checks is read as
  sleep (ADR-057) and starts the 300 seconds again.
- Pause is one row in the session store. Messages received while paused are stored and handed back
  on resume; the question to the owner comes with typed prompts (0.8).
- Compaction does not run while paused, so nothing calls a model.
- Each limit that fires writes a line to the event log (ADR-032). The audit log line waits for the
  audit log (3.1).
- At the step limit the turn ends before the next step, also when a steered message would have
  continued it. On emergency stop, steered messages join the held messages. The stop reply names
  the tools that were running and the messages it held, so a channel can tell the owner what was
  cut.
- A message steered into a turn that a limit then cut runs as the next turn, and the caller gets
  that turn's reply; the cut is in the event log only until channels deliver notices (0.8).
