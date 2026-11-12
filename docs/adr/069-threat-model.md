# ADR-069: Threat model: an actor-by-attack-by-control table with what is left over, a "not protected against" list, kept current by an ADR checklist rule

- **Status:** Accepted
- **Date:** 2026-11-12

## Decision
**Written now.** [`docs/THREAT_MODEL.md`](../THREAT_MODEL.md) is written from the accepted ADRs
before any Phase 3 code, so the gate and vault work start from it.

**Format.**
- *What we protect:* secrets, memory, owner accounts and sessions, money, the owner's identity
  and reputation, the host and nodes, and the audit trail.
- *Threats:* one table, `Actor | What they might try | Controls | What is left over`, each
  control citing its ADR.
- *Not protected against:* a separate list with plain reasons (root on the host, API model
  providers, the owner approving the wrong thing, a compromised vault service, an unlocked
  paired phone, the overlay's coordination server, connected third-party services).

**Actors covered at the start:** web pages; email, documents, and photos; MCP servers; skills;
browser adapters and providers; egress providers; nodes; stolen or lost paired devices; channel
plugins; group members; poisoned memory; the panel; the supply chain; the update channel;
someone with the data directory or a backup; OAuth token or vault theft; Jaari itself (runaway,
budget drain, self-initiated actions); a wrong or tampered model reply.

**Kept current by a checklist rule** in `docs/DEVELOPMENT.md`: an ADR that adds or changes a
capability, adapter, channel, provider, or input from outside adds or updates its rows in the
same commit. The file is reviewed at each phase exit. `SECURITY_MODEL.md` designs the controls;
`THREAT_MODEL.md` maps them to threats. `scripts/merge_docs.py` is not extended for this: it
merges docs for outside use and checks links only.

Borrowed: the actor, attack, and control table and the "not protected against" section from
open-instinct `docs/SECURITY.md` (docs only, format, not text).

## Alternatives rejected
Writing it only just before Phase 3 code; threats folded into `SECURITY_MODEL.md` (mixes design
with the threat map); enforcing coverage in `merge_docs.py` (out of that script's scope); a
threat list without the left-over column.

## Consequences
_TODO: fill in as implementation reveals them._
