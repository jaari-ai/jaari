# ADR-024: Context assembly: a fixed layout built by code, automatic recall, time anchors

- **Status:** Accepted
- **Extended by:** [ADR-093](093-sensitive-content-follows-routing.md)
- **Date:** 2026-11-10

## Decision
**Code builds every prompt; the model can ask for more.** A deterministic assembler (on Pi's
`section()` / `prepareRequest`) builds each prompt in a fixed order with a budget per section;
the model can still call `memory.search` and `records.query` for anything beyond it.

| Part | Contents | Budget |
|---|---|---|
| Stable (cached) | Identity and persona, `ops/rules`, capability list, tool definitions | Fixed; changes only when persona, rules, or capabilities change |
| Daily | Owner profile summary | About 2,000 tokens; changes at most when canonicalize runs |
| Volatile, before the owner's message | Now (date, time, time zone, active channel); events in the next 14 days; active trackers and budget status with code-computed values; open commitments and overdue tasks; warnings whose lead time has started; pending approvals; the horizon line | About 1,500 tokens, each type capped |
| Recall, before the owner's message | Automatic `memory.search` on the message, fenced as data | 4 notes and 4 passages, about 1,500 tokens |
| Conversation | Recent turns plus the compaction summary | The rest |

**Time anchors beyond 14 days.** Three mechanisms keep later dates reachable:
- *Date-aware recall.* Code parses date and range expressions in the owner's message
  (absolute: "on March 3"; relative: "in 60 days", "next month", "before my trip"), using a
  deterministic parser and the owner's time zone, and adds every structured record whose date
  falls in that window (events, expiries, recurring charges, due tasks, tracker run-out dates)
  to the volatile part, whatever the distance.
- *Horizon line.* A one-line pointer past the 14-day window: per type, how many items fall in
  the next 12 months and the next one ("later: 3 events, next Dec 2 passport renewal; 2
  expiries, next Jan 15 car insurance"). The model knows something exists and can fetch it.
- *`records.query(type?, from, to)`.* A read tool for any window, for the model or for
  follow-up questions.
Warnings keep their own lead times (a passport expiring in 60 days appears as a warning once
its lead time starts), independent of the 14-day window.

**Rules.**
- Overflowing sections cut the oldest or least relevant entries, and the cut is recorded so
  `jaari prompt --layers` can show it.
- Nothing that changes per turn goes into the stable part, so the provider's prompt cache
  holds.
- Automatic recall is skipped for very short acknowledgements ("ok", "thanks").
- What must survive a compaction: decisions, commitments, and owner corrections. Structured
  records live outside the conversation (ADR-023), so compaction cannot lose them.
  Compaction mechanics (thresholds, Pi reuse) are ADR-065.
- `jaari prompt --layers` shows every section, its size, its source, and what was cut, for
  any turn.

## Alternatives rejected
The model alone decides what to recall (it does not know what it does not know: the
appointment failure of ADR-023); a fixed window with nothing beyond it (a question about a
date 60 days out would miss it); putting all future records in every prompt (unbounded);
rebuilding the whole system prompt every turn (open-instinct; no stable prefix, so no prompt
caching).

## Amendments
- **ADR-093:** sensitive records are assembled like any other; privacy comes from routing.

## Consequences
_TODO: fill in as implementation reveals them._
