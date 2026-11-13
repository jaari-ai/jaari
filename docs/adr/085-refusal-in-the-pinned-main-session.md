# ADR-085: A provider refusal never moves the pinned main session; other roles move down the chain

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-011 treats a provider refusal as an escalation signal and moves to the next model, except
for off-limits categories. ADR-019 pins the main session and lets it move down its chain only
when the provider never accepted the turn (ADR-016). A refusal is an accepted turn, so the two
disagree for the main session (OQ-86). Pi reports a refusal as `stopReason: "error"`
(`refs/pi/packages/ai/src/api/anthropic-messages.ts`, commit `469d865`) but keeps the
provider's `rawStopReason` (`refs/pi/packages/ai/src/types.ts`).

## Decision
**Main session.** A refusal never changes the main model. Jaari ends the turn and tells the
owner once, with the provider's explanation. The owner may rephrase, or use the existing
one-turn override (`/model <tier>`, "use the big model for this"). Moving model is the owner's
act, never automatic.

**Off-limits categories** (impersonation, CAPTCHA solving) are unchanged: they end the attempt
and go to the owner as a takeover or a plain report, never to another model (ADR-011).

**Roles that are not pinned** (children, classify, summarize, and the rest) keep ADR-011's rule:
a refusal moves to the next model in the chain, within budget and privacy policy.

**Detection is deterministic.** `@jaari/llm` reads `rawStopReason` (`refusal` for Anthropic,
`content_filter` for OpenAI, `SAFETY` or `PROHIBITED_CONTENT` for Gemini) and classifies it as a
refusal, not a provider error. Jaari's retry classifier, in front of Pi's retry, never retries a
refusal as an error.

**Test.** A tier-1 scenario: a scripted refusal in the main session ends the turn with one
notice and no model change; a refusal in a child moves to the next model.

## Alternatives rejected
Following ADR-011 in the main session (silent model switches break the pin and its cache);
treating a refusal as a provider error (it would be retried, or trigger failover).

## Consequences
_TODO: fill in as implementation reveals them._
