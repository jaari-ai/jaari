# ADR-099: Browser reviews read the action log; shadow mode keeps its meaning; onboarding states the real shadow setting

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
ADR-051 takes classifier fixtures from "shadow mode", in which "every action in owner-account
sessions is logged", and ADR-052 reviews the task-scope rule "from shadow-mode logs", but ADR-068
shadows only effects Jaari starts on its own. Onboarding (Phase 2, ADR-070) promises "for the
first 14 days it only proposes", while shadow mode ships in Phase 3 and the owner may choose
another length or turn it off (OQ-83).

## Decision
**The reviews read the action log.** The browser action log (ADR-097: every action with its
snapshot, 90 days) records for each action its commitment classification (ADR-051), whether Jaari
asked, and any task-scope origin prompt (ADR-052), for every owner-account session, owner-asked or
self-initiated. ADR-051's fixtures and ADR-052's Phase 6 review read it. "Shadow-mode logs" in
those ADRs means this action log.

**Shadow mode** keeps ADR-068's meaning: only self-initiated effects, recorded as "would have done
X".

**Onboarding's close line** states what is true. Before shadow mode ships: "Jaari cannot act
outside this chat yet" (the gate stub refuses every gated effect until Phase 3). From Phase 3: the
owner's chosen setting ("for the next 14 days Jaari only proposes what it would do on its own",
the custom length, or "shadow mode is off").

## Alternatives rejected
Shadowing owner-asked browser actions to feed the reviews (contradicts ADR-068 and slows the
owner's own requests); keeping the fixed "14 days" line (wrong when the owner chose otherwise, and
before Phase 3).

## Consequences
_TODO: fill in as implementation reveals them._
