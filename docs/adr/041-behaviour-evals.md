# ADR-041: Behaviour evals: scripted scenarios in CI, owner golden threads, opt-in live tests, shadow replay

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Evaluate the harness, not the model.** Three tiers.

**Tier 1: scripted scenarios** (CI on every pull request, no API calls). Pi's `fauxProvider`
drives the real daemon; scenarios are JSON, scorers are pure functions over a frozen snapshot.
Coverage:
- Asking before acting: no effect without a matching digest; sealed runs do not ask (ADR-036);
  prompt answers follow ADR-035 (bare-yes rule, expiry).
- Quiet: quiet hours, the 7-day rule, the outbox duplicate window, only the main session speaks
  (ADR-031, ADR-033).
- Memory: the owner's three fixtures from ADR-023 (exact budget balance over 20 expenses, the
  appointment told 7 days earlier, important mail without named senders), plus correction,
  forget, and erase (ADR-029).
- Crash drills: kill and restart at seven points; no possibly accepted action is ever submitted
  twice (ADR-016, ADR-025).
- Limits: step caps, stall guard, pause, and emergency stop (ADR-031).

**Tier 2: owner golden threads** (opt-in, local). When the owner corrects Jaari ("that's wrong",
"you forgot"), Jaari offers once, for that correction, to turn the exchange into a fixture. The
thread is redacted on the owner's machine (names, numbers, and free text replaced by stable
placeholders, then a leak scan) and stays in the install; it leaves only on an explicit
`jaari eval export`.

**Tier 3: live model tests** (opt-in, spends the owner's budget). `jaari llm eval`: role
qualification (LLM.md), a tool-choice set of requests that went wrong in real use, and persona
adherence. An LLM judge is allowed here only, and only for tone; it never gates CI and is never
near approvals.

**Shadow replay.** `jaari replay <turn>` reruns a recorded turn with another prompt version or
model with the gate in dry-run: nothing is sent or written, and the two runs are shown side by
side. Prompt versioning (OQ-21) uses it.

**Phasing.** Tier 1 starts in Phase 0 with a smoke test that boots the daemon on the scripted
engine and grows each phase; golden threads and replay in Phase 2; crash drills with the real
gate in Phase 3.

Borrowed: the three tiers, pure scorers, golden-thread redaction with a leak scan, and the
tool-choice set from OpenMausBot `evals/README.md` (learning/09); the scripted engine from Pi
`ai/src/providers/faux.ts`; the smoke boot from open-instinct `server/src/smoke.ts`; crash drills
from openinstinct `drills/runtime.ts` (behaviour only).

## Alternatives rejected
Live-model evals as the CI gate (slow, costly, flaky); an LLM judge for safety behaviour (the
gate must be checked by deterministic scorers); sending golden threads upstream by default;
asking to save every exchange as a fixture.

## Consequences
_TODO: fill in as implementation reveals them._
