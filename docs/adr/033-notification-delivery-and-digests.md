# ADR-033: Notification delivery: the active channel is the push; owner-defined digests; learned urgency

- **Status:** Accepted
- **Date:** 2026-11-10

## Decision
**Push is the active channel itself (ADR-022).** No separate push service. Jaari uses each
channel's own notification levels: on Telegram, digest items and low-priority messages are sent
silently and urgent items alert; the web panel uses web push only while it is the active
channel. An outbound-only ntfy plugin may come later as a fallback.

**Delivery fallback, the one exception.** If the active channel cannot deliver an urgent item for
10 minutes, it goes once to the most recently used other paired channel, marked as sent there
because the active channel failed. Non-urgent items wait.

**Urgency is learned, starting from defaults.** Default urgent classes: money (a bill due, a large
or unusual charge); deadlines and appointments within 24 hours; changes to something the owner
committed to; security alerts; direct replies from the owner's closest contacts. Each item is
scored once. The classes then follow the owner's preferences: what the owner says ("always tell
me when X", "that's not urgent") and how the owner reacts (read, replied, dismissed, ignored),
recorded in the notification ledger, adjust classes, senders, and topics over time. Learned
changes are visible and reversible in the panel. This meets the owner requirement in ADR-023
(important mail surfaced without naming senders).

**Digests are the owner's.** Any number of digests, one per category the owner wants (for example
news at 09:00, job offers at 10:00, money weekly on Monday), each a routine (OQ-43) with its own
time, source filter, and channel behaviour. When the owner names a digest without a time, Jaari
proposes one from the owner's wake hours (learned from activity, bounded by quiet hours) or a
sensible time for the category, and asks before scheduling it. Items not urgent and not covered by
any digest go to a default morning brief, which the owner can move or turn off.

**Routing by the Proactivity dial** (ADR-008) and quiet hours (default 22:00–08:00, configurable).
During quiet hours only security alerts and items the owner marked "always tell me" break through.

**Delivery rules.** Only the main session speaks: children and routines report to it as internal
turns that write one line or stay silent. The outbox retries at 5 s, 25 s, and 125 s with a
10-minute duplicate window; an uncertain send is never resent; "finished" is sent only with a real
result; each failure and cause alerts once; every notification links to its exact thread.

Borrowed: the internal-turn rule and outbox ladder from openinstinct (behaviour only); the
notification QA rules from OpenMausBot (learning/09); scoring each item once and the interruption
classes from Pally (learning/11).

## Alternatives rejected
A separate push service as a second stream (conflicts with ADR-022); a content-free wake ping
(still a second app and stream); fixed urgent classes (the owner's priorities differ and change);
one fixed daily digest (owners want different topics at different times); scheduling a digest at
a time the owner never confirmed.

## Consequences
_TODO: fill in as implementation reveals them._
