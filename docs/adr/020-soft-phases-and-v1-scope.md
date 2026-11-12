# ADR-020: Roadmap phases are a soft plan; scope deferred from the merge plan

- **Status:** Accepted
- **Extended by:** [ADR-037](037-voice.md)
- **Date:** 2026-11-10

## Decision
**1. Soft phases.** Phases in ROADMAP.md are an ordering guide, not gates. An item may start in any phase once its listed needs (open questions, ADRs, earlier items) are met, and a phase is not "closed" while its items are unfinished. "Needs" means *needed before this item ships*, not before the phase may start. Status is tracked per item in STATE.md. **2. Blocker phases corrected.** OQ-32 (egress) is needed with the browser, so it moves from Phase 7 to Phase 6; the sleep and wake part of OQ-36 moves to Phase 0 because a laptop is a supported target; OQ-10 keeps only the overlay and sizing parts (Phase 7) and the Compose layout moves under OQ-35 (Phase 0); OQ-20 is needed in Phase 2 for the replay harness, with fixtures growing after. **3. Scope.** Trust tiers (the 7-tier matrix), the peer envelope and agent network, payments, and voice from the open-instinct merge plan are deferred with the v1 non-goals; they stay in the merge plan as history. ADR-009's "policy and network shell" is read as capability tagging, principal resolution, and grants (ADR-072), plus the hosting shell of ADR-017. The README lineage table says the same.

## Alternatives rejected
Hard phase gates (a small project stalls on an unrelated open question); no phases at all (nothing says what to build first); carrying the 7-tier matrix into the first phases (multi-principal machinery for a single owner).

## Amendments
- **ADR-037:** voice notes and the `stt` and `tts` roles are in v1; of the deferred "voice", only live calls remain deferred.

## Consequences
_TODO: fill in as implementation reveals them._
