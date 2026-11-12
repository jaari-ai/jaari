# ADR-051: Consequential browser actions: a deterministic commitment classifier, Allow once for commitments, unreadable asks

- **Status:** Accepted
- **Extended by:** [ADR-072](072-standing-grants.md)
- **Date:** 2026-11-11

## Decision
**Commitment classes, not every click.** A deterministic classifier runs before each
`browser.act` and recognises six classes:
- Pay or order: checkout, place order, buy, pay, subscribe, donate (the payment step itself is a
  takeover in v1, ADR-040).
- Book: reserve, book, confirm an appointment.
- Send or publish: send, post, reply, publish, comment, share, invite.
- Consent: accept terms, agree, sign, authorise, OAuth "Allow".
- Account changes: password, email, delete, cancel, close account, two-factor settings.
- Upload: always (ADR-048).

**Signals come from the page, not the model:** the target element's role and accessible name
against a verb list (English plus the owner's configured languages); submit controls and Enter
inside a form; the form's purpose (payment fields such as `autocomplete="cc-*"`, password fields,
a message box); URL and path patterns (`/checkout`, `/payment`, `/compose`, `/oauth/authorize`);
and known-site rules shipped as data, which the owner can extend.

**Three outcomes.**
- Ordinary: runs as `browser.act` within the task the owner asked for, with no prompt.
- Commitment: becomes `browser.submit`, an Allow once prompt (ADR-035) whose digest covers the
  origin, the element's name, and a summary of the filled fields ("Book table · Le Comptoir · Fri
  20:00 · 2 people").
- Unreadable (a coordinate click with no element, a canvas, a hidden name): ask the owner
  (ADR-016).

**An LLM can only add caution.** On ambiguous pages (for example a bare "Continue" on a checkout
page) a `reader`-role check of the page state may escalate an ordinary action to a commitment; it
can never downgrade one (principle 9).

**Repeat asks.** Low-risk commitments that the URL rules flag (adding to a cart, submitting a
search or filter form) may get "Always allow on this site for 90 days" (the ADR-036 model). Send
or publish, pay or order, consent, and account changes are always Allow once.

**Checking afterwards.** After a commitment Jaari reads the result page and records confirmed or
failed in the audit log; when it cannot tell, it says so and never assumes success.

**Rollout: classifier only.** During Phase 6 shadow mode every action in owner-account sessions is
logged with its classification; there is no every-click gating period. Fixtures (ADR-041) are
recorded pages of real flows (checkout, booking, mail send, OAuth consent); the classifier ships
only when it catches every commitment in them.

Borrowed: the commitment classes from Pally (learning/11); "unreadable means ask" from ADR-016;
verb gating as the shadow-mode baseline from openinstinct `browser/enforce.ts` (behaviour only).

## Alternatives rejected
Approval on every click in owner-account sessions (constant prompts); an LLM classifier alone
(principle 9); standing grants for sending, paying, consent, or account changes; assuming a
commitment succeeded.

## Amendments
- **ADR-072:** grants for low-risk commitments follow the one grant model (key: site and form kind).

## Consequences
_TODO: fill in as implementation reveals them._
