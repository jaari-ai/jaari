# ADR-072: Standing grants: one grant model, exact-match keys, a closed list of grantable capabilities, offered once after three identical approvals

- **Status:** Accepted
- **Extended by:** [ADR-090](090-oauth-token-rotation.md), [ADR-091](091-engine-runs.md)
- **Date:** 2026-11-12

## Decision
**One grant model** for the grants ADR-036, ADR-039, ADR-051, and ADR-034 each allowed. A grant is
an object with an id, the owner (ADR-044), the capability and its exact key, the approval it came
from, an expiry (90 days by default, configurable), a use count, and the last use. Grants are
listed, renewed, and revoked with `jaari grants` and the panel (ADR-067); revocation is
immediate. Jaari reminds once before a grant expires.

**Grantable capabilities and their keys** (a closed list; anything not listed is Allow once):

| Capability | Key |
|---|---|
| `shell`, `files.write` in the sandbox | Host or folder target (ADR-036) |
| `calendar.write`, own calendar, no attendees | That calendar (ADR-039) |
| `browser.act`, low-risk commitment | Site and form kind (ADR-051) |
| `mcp.act` | Server and tool, with the server config and tool-list fingerprint (ADR-034); not for tools classified as send, publish, or pay |

Read capabilities run without a grant.

**Never grantable**, always Allow once: `email.send`, `publish`, `pay`, `repo.write`,
`browser.submit` commitments (pay or order, send, consent, account changes), calendar
invitations, host commands outside the sandbox, `computer.use`, and anything that handles
credentials.

**Exact-match keys.** No wildcards. Any change to the config, tool list, or manifest (ADR-034,
ADR-071) revokes the grant. The executor re-checks the grant at dispatch (ADR-016).

**Offered, never pushed.** Where a grant is allowed, the prompt (ADR-035) shows Always allow
next to Allow once. After three identical Allow once approvals for a grantable key, Jaari offers
the grant once ("Allow this for 90 days?"); a dismissal is remembered and the offer is not made
again for that key.

**What still overrides a grant.** Pause and emergency stop suspend all grants (ADR-031); budgets
apply (ADR-046); a capability in shadow mode stays shadowed even with a grant (ADR-068).

**Every use is recorded** as an `audit.jsonl` row with the action's digest and the grant id.
This resolves the ADR-006 flagged conflict: each action still has its own digest; a grant is a
pre-approved key checked by code, with no LLM in the path.

**Grants for another person's Jaari** come with the multi-owner ADR (ADR-044).

**Phase 3**, with the real gate.

Borrowed: exact match, revision fencing, re-check at dispatch, and revoke by id from openinstinct
`assistant-work/owner-policy.ts` (behaviour only); grants keyed on the target and a config hash
from OpenMausBot (learning/09); offering a standing permission after repeated similar approvals
from Pally (learning/11, without its send scope).

## Alternatives rejected
Standing grants for sends to an exact recipient (openinstinct, Pally); a grant for `repo.write`
on Jaari's own branches; wildcard keys; grants without expiry; grants keyed on code or model
output; offering a grant again after a dismissal; grants that keep working while paused or in
shadow mode.

## Amendments
- **ADR-090:** a code-initiated OAuth rotation within its bounds is not a grant and needs no
  approval; every other credential write stays Allow once.
- **ADR-091:** the closed list gains `engine.run`, keyed on engine id and workspace path.

## Consequences
_TODO: fill in as implementation reveals them._
