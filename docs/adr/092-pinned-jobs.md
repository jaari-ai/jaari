# ADR-092: A pinned job is its own repeating approval, managed with grants; host jobs expire

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-036 approves a recurring script once, bound to a digest of the script, placement, secrets,
hosts, and schedule; runs then proceed with no expiry, and host jobs are allowed. ADR-072 is one
grant model with a 90-day expiry and lists host commands as never grantable; ADR-006 makes
approvals single-use and expiring (OQ-77). A grant covers many future digests keyed on a target;
a pinned job covers one exact digest that repeats, and any change holds it.

## Decision
**Own kind.** A pinned job is an approval that repeats for one digest, not a grant. ADR-072's
closed list does not apply to it; it is the one repeating approval next to ADR-006's single-use
ones.

**Managed with grants.** Listed in `jaari grants` and the panel, revocable at once, owned
(ADR-044), with a use count and last use; each run writes an audit row naming the pin.

**Expiry by placement.** Sandboxed jobs: no expiry (ADR-036); after 90 days one check-in asks
whether to keep or pause it (as ADR-064). Host jobs: expire after 90 days with one reminder
before; renewing shows the digest again.

**Creation.** Only the owner creates or re-approves one: an `outside` run cannot (ADR-075), and
Jaari cannot approve its own job (ADR-036).

**No `pay`.** A pinned job cannot use `pay`; v1 has no payment executor (ADR-040).

## Alternatives rejected
Treating pinned jobs as ADR-072 grants (host commands would have to become grantable); Allow once
per run (defeats recurring jobs); no expiry for host jobs (the riskiest approval would never be
reviewed).

## Consequences
_TODO: fill in as implementation reveals them._
