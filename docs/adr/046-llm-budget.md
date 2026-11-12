# ADR-046: LLM budget: a monthly budget set at init, early warnings, and the owner's choice at the limit

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Default set at `jaari init`.** `init` asks for a monthly budget and suggests one by preset:
api-only $30, hybrid $20, local-only $0. Display uses the owner's currency; accounting stays in
USD, as providers bill. The month resets on the 1st or on an owner-set day (a billing date).

**What counts.** Pi's `Usage`, including provider-billed cost and failed attempts (ADR-032 usage
log). Search and fetch APIs count against the separate `web` budget; local models cost $0.
Per-role caps (for example `child`) stay as in config.

**Warnings.** One digest line at 50% and one at 80% (not interruptions, ADR-033); one notice when
the run rate projects going over before the reset ("at this rate you reach $30 on the 22nd");
spike alerts as in ADR-031.

**At 100%: the owner chooses.** Jaari sends one ADR-035 prompt with three options:
- Raise the budget for this month (+50% suggested).
- Switch chat to a cheaper model until the reset.
- Local only until the reset.

The first 3 times the limit is reached, the prompt explains the trade-offs (raising costs money;
a cheaper model is weaker on long tool-using work; local only is free and private but slower and
weaker, and API-only roles wait). After that it shows only the choices. The count of explanations
is configurable.

The switch is the owner's override, so ADR-019 (no cost-driven switching) holds. Until the owner
answers: the main session keeps its model through a 10% grace overrun, then waits, and can always
say that the budget is reached and offer the choices; children, routines, and curiosity pause and
queue; local-only roles keep running; effectful work already approved finishes.

**Per-job check-in.** Before a job estimated to exceed its share of what is left (default $2, as
in ADR-031), Jaari checks in once.

**Visibility.** `jaari llm usage` and the panel show spend by role, model, day, and job, with the
projection; the digest carries a one-line budget status. `jaari doctor` recommends a spending
limit in each provider's console as a backstop.

**Payments later** (ADR-040) use a separate money budget; the spend check shares only the
mechanism, not the figures.

Borrowed: the at-the-limit behaviour and the one check-in before a job exhausts the budget from
Pally (learning/11), changed so the owner chooses instead of an automatic downgrade; usage
accounting from Pi `ai/src/types.ts` (`Usage`).

## Alternatives rejected
A fixed default for every install; an automatic downgrade of the main session at the limit
(cost-driven switching, against ADR-019); a hard stop that silences Jaari; explaining the
trade-offs every time (nagging); counting web APIs and payments against the LLM budget.

## Consequences
_TODO: fill in as implementation reveals them._
