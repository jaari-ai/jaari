# ADR-075: Outside lineage: a code-set origin on every run, sticky across spawned work, outside effects always ask with the origin shown

- **Status:** Accepted
- **Date:** 2026-11-12

## Decision
**Every run has an origin, set by code, never by the model.** A run is a turn, a job, or a child.

| Origin | Meaning |
|---|---|
| `owner` | Started by the owner's own message on a paired channel (ADR-022) |
| `routine` | A schedule or routine the owner created (ADR-064) |
| `event` | A watcher, a webhook (ADR-073), or inbound mail |
| `outside` | Started or steered by third-party content: an email, web page, document, or another person's message |

**Sticky.** Everything an `outside` run spawns is `outside`. It never upgrades by itself. The
owner adopts outside work only with their own message ("yes, do that"), which starts a new `owner`
run that takes the proposal as data.

**What `outside` restricts.** It asks rather than refuses.
- It cannot settle approvals; only the owner's own messages approve.
- It cannot use standing grants (ADR-072): every effect is Allow once, and the card carries an
  origin line, for example "Started by: email from x@example.com".
- Memory: typed records that pass the quote check are written with their source (for example a
  receipt becoming a ledger line); writes to the profile, rules, persona, or skills need an
  approval showing the full text; facts stay "according to" (ADR-074).
- It cannot create routines, hooks, skills, or grants without approval.
- Its network reach is limited to the task's origins (ADR-052).

**Owner runs that read untrusted content stay `owner`.** The content reaches them only as
`reader` summaries; their grants keep working, because grants are narrow exact-match keys.

**Recorded everywhere.** The origin is in every audit row, receipt (ADR-061), and approval card
(ADR-035).

**Phase 4**, with the reader role.

Borrowed: one deterministic origin per run and "a run not started by the owner cannot settle
approvals" from open-instinct `core/src/runtime.ts` and `policy.ts` and openinstinct
`assistant-work/observation.ts` (behaviour only); sticky outside origin across spawned work and
full-text approval for its memory writes from OpenMausBot `server/host/outside-lineage.ts` and
`outside-fence.ts` (learning/09).

## Alternatives rejected
Origin judged by the model; outside work upgrading itself; refusing every outside effect (it
would block useful drafts such as a reply to a mail); outside runs using grants; owner runs
losing grants after reading untrusted content (more asks for little gain).

## Consequences
_TODO: fill in as implementation reveals them._
