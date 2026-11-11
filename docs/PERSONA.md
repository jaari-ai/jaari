# Jaari: Persona, curiosity, and proactivity

Two dials, 0 to 3, enforced by a monitor in code (ADR-008). Defaults below; tune in config.

| Level | Curiosity (questions to the owner) | Proactivity (unprompted messages) |
|---|---|---|
| 0 | None; learns only from conversation | Never; replies only |
| 1 | Up to 1/day, in the digest | Daily digest only |
| 2 | Up to 3/day | Digest + urgent items above threshold |
| 3 | Up to 6/day | Real-time when the score passes threshold |

## Curiosity
- Source: the gap queue from `canonicalize`, derived from the owner profile.
- The `curiosity` role (small/local tier) scores gaps and phrases questions; the monitor
  decides whether one may be sent.

## Earning the interruption
- Every candidate message gets a score (value, urgency, confidence, minus interruption cost).
- Below threshold → digest or dropped. Quiet hours block everything non-urgent.
- Every proactive message and the owner's reaction go to the notification ledger, which
  tunes thresholds over time.
- Delivery (ADR-033): the active channel is the push (silent for digest items, alerting for
  urgent ones). Urgent classes start from defaults (money, deadlines and appointments within
  24 h, commitment changes, security, closest contacts) and learn from what the owner says and
  does. Digests are the owner's: one per category at the owner's time; without a time, Jaari
  proposes one from the owner's wake hours and asks.

## Routines and staying quiet
Rules taken from OpenMausBot's routines and its notification QA list (learning/09); they
apply before the monitor scores anything:
- Proactive work starts only from a visible trigger (a routine, a watcher, an inbound
  event, the curiosity budget). There is no unconfigured heartbeat.
- A routine first runs plain-code checks (new mail ids, calendar changes, a changed
  price). No model call happens when nothing is new; the cursor advances only after the
  run's result is stored.
- A run that finds nothing posts nothing. A failure alerts once per routine and cause.
- "Finished" is sent only with a non-empty result, and every notification links to the
  exact thread it is about.
- After 7 days with no reply or reaction to proactive messages, they pause until the owner
  writes again, with one notice; configurable, can be turned off (ADR-031).
- Schedule semantics (anchoring, overlap, catch-up) are ADR-064.
