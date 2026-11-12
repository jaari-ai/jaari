# ADR-070: Onboarding conversation: a built-in skill after `jaari init`, one question at a time, optional people records, a first week of inference and one gap question a day

- **Status:** Accepted
- **Date:** 2026-11-12

## Decision
**Two steps.** `jaari init` (CLI or panel wizard) does the technical setup: host and overlay
(ADR-017, ADR-030), models and budget (ADR-045, ADR-046), vault layout (ADR-050), shadow mode
(ADR-068), channels and pairing (ADR-021, ADR-022). The onboarding conversation is the first
chat, run by a built-in `onboarding` skill (ADR-060) on whichever channel the owner first uses
(CLI, panel, or Telegram; ADR-067). It never repeats a setup question.

**Conversation rules.**
- One question per message; short messages.
- Each answer is saved at once through the single writer (ADR-026).
- Anything already answered, in this chat or earlier, is skipped.
- "Later" saves what it has and stops; onboarding resumes in the next conversation, or with
  "redo setup" or `jaari onboard`.
- It never asks for passwords, card numbers, or logins. Accounts connect through the OAuth
  wizard (ADR-062), the vault (ADR-050), or a takeover (ADR-055).

**What it asks, in order.**
1. Name.
2. City, which sets the timezone (confirmed only if ambiguous).
3. Message style (short or detailed) and quiet hours, which set the dials (ADR-008).
4. When the daily digest arrives (ADR-033).
5. Accounts to connect, offered one at a time: email, then calendar (ADR-039).
6. Optionally, two or three key people as People records (name, relationship, contact). The
   owner can skip this; people also build up from conversation. v1 has no trust tiers (ADR-044).
7. Close: what Jaari can do, and one line saying that for the first 14 days it only proposes
   what it would start on its own (ADR-068).

**Everything else is inferred.** During the first week, facts from normal conversation become
profile facts, each with its source quote (ADR-047), visible in "Knows" (ADR-067). At most one
gap question a day, in the digest. On day 7, a short "what I learned about you this week" with a
link to edit it; then onboarding ends and normal curiosity rules apply (PERSONA.md).

**Dials explained when they matter.** One sentence when they are set during onboarding. Later,
a short explanation the first 3 times a dial changes what Jaari does (for example, holding back a
question), then never again; the count is configurable, as in ADR-046.

**Phase 2.**

Borrowed: one question per message, saving each answer at once, skipping answered questions,
stopping on "later", never asking for credentials, and the question order from open-instinct
`skills/onboarding/SKILL.md` (behaviour; the skill text is Jaari's own).

## Alternatives rejected
One long form at init; repeating setup questions in the chat; asking everything up front instead
of inferring; required people and trust tiers in v1; explaining dials every time they apply;
open-ended onboarding questions after the first week.

## Consequences
_TODO: fill in as implementation reveals them._
