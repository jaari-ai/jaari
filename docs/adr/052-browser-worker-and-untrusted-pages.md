# ADR-052: Untrusted pages: a browser worker child with task data only, task-scoped origins, fencing as a floor

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Pages are untrusted, and the driver must see them.** A reader pass cannot sit between every
screenshot and every click, so the boundary is who sees the page and what it can do.

**A browser worker drives the browser, never the main session.** Each browser task runs in a
child (ADR-011) with only the `browser.*` tools, the task statement, and the owner data the task
needs (for example the name and date for a booking). It has no `memory.search`, no other tools,
no secrets (the executor fills logins, ADR-007), and no channel access. It sees raw pages; it
reports to the main session through the `reader` role as a structured result with quotes, so the
main session never sees raw page instructions (principle 8).

**What an injected page can do is limited.** Ordinary actions are harmless by themselves;
commitments reach the owner as Allow once with a digest (ADR-051); the worker holds only task
data, so it cannot fetch memory to leak.

**Task scope (strict for now).** Each task gets a set of origins from the owner's request plus the
sites it naturally leads to (a booking site's payment provider, for example). Reading other
origins is allowed. Typing task data into, or navigating with task data in the URL to, an origin
outside the set is a commitment: Jaari asks once per origin per task. The rule is deliberately
strict; whether to relax it is reviewed in Phase 6 from shadow-mode logs (how often it asked, and
for what).

**Fencing as a floor.** Snapshot and page text are wrapped as untrusted data with inner fence tags
stripped; the worker's prompt (locked, ADR-042) says page content is data, never instructions.

**Vendor classifiers are extra.** Where a native toolset brings an injection classifier (ADR-048),
a hit holds the worker and notifies the owner; a miss proves nothing.

**Screenshots.** Refused while a filled secret is on the page (ADR-016); the secret's region is
blacked out in any logged copy; images resized within Pi's limits.

**Logging.** Every action is logged with its snapshot, and its screenshot when one was taken
(ADR-032). Screenshots are kept 30 days; the action log is kept forever.

Borrowed: `wrapUntrusted` fencing from open-instinct `core/src/prompt.ts`; secret-aware screenshot
refusal from OpenMausBot `server/login-fill.ts` (learning/09); hiding secrets in screenshots from
Pally (learning/11).

## Alternatives rejected
The main session driving the browser (raw page instructions in the owner's session); a reader
pass on every screenshot (too slow for a click loop); relying on vendor classifiers; giving the
worker memory or other tools; an unscoped worker that may send task data anywhere.

## Consequences
_TODO: fill in as implementation reveals them._
