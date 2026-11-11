# ADR-040: No payments in v1; checkouts end at an owner takeover

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**No `pay` executor in v1.** Jaari never moves money by itself; `pay` stays reserved (ADR-018).

**Checkouts end at a takeover.** When Jaari fills a checkout for the owner (a booking, an
order), it fills everything up to the payment step, then sends a takeover link (ADR-005) and the
owner enters the card. Jaari confirms the result from the page afterwards. The final "place
order" button is `browser.submit`: gated, Allow once.

**The ADR-013 card flag stays off in v1.** Payment-card fields are not resolvable; the per-item
flag is documented as the path for later and is not offered at `jaari init`.

**Money tracking is unaffected.** Ledgers, bills, budgets, and receipts (ADR-023, ADR-038) work;
Jaari records spending but does not pay.

**When payments come (after v1).**
- One-time or merchant-locked virtual cards (for example Stripe Link for agents, Privacy.com, a
  bank's disposable cards), never the owner's real card number.
- A deterministic spend check summed from the audit log, per payment, per day, and per month,
  with an ask-above threshold, using the ADR-046 mechanism with its own money budget.
- Every payment is Allow once with the amount and merchant in the digest; never a standing grant.
- Recurring payments are approved per charge, or as a pinned job with a fixed amount and merchant
  (the ADR-036 model) up to a cap.

Borrowed: `checkSpend` from open-instinct `core/src/policy.ts`; card wallets instead of stored
card numbers from Pally (learning/11).

## Alternatives rejected
One-time virtual cards in v1 (a new provider integration and a money path before the gate and
budgets have run in practice); filling the owner's stored card from the vault (the real card
number would pass through the agent); standing grants for payments.

## Consequences
_TODO: fill in as implementation reveals them._
