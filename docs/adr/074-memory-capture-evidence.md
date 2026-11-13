# ADR-074: Memory capture evidence: mechanical raw capture, a code-checked quote and source id on every derived fact, inferred facts marked, commit trailers

- **Status:** Accepted
- **Extended by:** [ADR-056](056-install-update-migrate.md), [ADR-081](081-secrets-pasted-in-chat.md)
- **Date:** 2026-11-12

## Decision
**Two layers.** Raw capture is mechanical and append-only: the owner's turns are written
verbatim to the daily log with their source id, with no model involved. Derived facts (profile
lines, notes, records) must each carry evidence.

**The evidence rule, checked by code.** Every derived fact carries a quote and a source id (a
conversation turn, an email Message-ID, a document hash and page, a photo hash). Code checks:
- the quote appears in that source, ignoring whitespace and case;
- every number, amount, date, path, URL, email address, and phone number in the fact appears in
  the quote;
- relative dates ("tomorrow") are resolved by code from the quote's timestamp, never by the model.

A fact that fails is not written; the rejection is logged, and the model may retry once. Typed
records (ADR-023) use the same check.

**Whose words.** Facts about the owner come only from the owner's own words. Facts from others'
content (emails, documents from others) are stored as "according to <source>" and become facts
about the owner only when the owner confirms them.

**Not facts.** Questions, hypotheticals, requests and tasks (these become task records), and
text the owner quotes from someone else. The model labels each candidate, and code drops any
candidate not labelled as a statement.

**Inferred facts.** Jaari may infer a fact from several turns, quoting each supporting turn. It is
marked *inferred* in "Knows" (ADR-067), where the owner can confirm or reject it, and it never
drives an action until confirmed.

**Commit trailers** (ADR-026): `Mutation-Id`, `Actor` (`owner`, `agent`, `canonicalize`,
`audit`, `import`, `skill`), `Source-Session`, `Source` (the source ids), and
`Prompt-Fingerprint` (ADR-042). Forget and erase cascade through `Source` (ADR-029). The owner's
own edits are committed as `actor: owner` and need no quote.

**Canonicalize** (ADR-047): the run fails if a raw file changed during it; the same quote rule
applies; large deletions are held for review.

**Fixtures** (ADR-041): invented-fact cases, such as a number not in the quote or a date the
model resolved itself, must be rejected.

**Phase 1.**

Borrowed: the quote-and-verify rule for captured facts from OpenMausBot (learning/09); raw capture
as a mechanical append-only layer under canonicalize from openinstinct
`memory/adapters/capture.ts` and `canonicalize.ts` (behaviour only); mutation-id trailers from
gajae-way (ADR-026, design only).

## Alternatives rejected
Trusting the model's facts without a quote; letting the model resolve relative dates; facts about
the owner from others' content without confirmation; inferred facts acting like stated ones;
commits without actor and source trailers.

## Amendments
- **ADR-056:** adds the commit actor `migration` (a memory migration is one commit through the writer).
- **ADR-081:** raw capture writes the owner's turn verbatim after the ingress secret scrub.

## Consequences
_TODO: fill in as implementation reveals them._
