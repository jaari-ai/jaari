# ADR-044: One owner per Jaari in v1, one Jaari per person, multiple owners planned later

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**v1 serves exactly one owner.** Only the owner has authority. Anyone else who reaches Jaari is a
principal without authority: their messages are untrusted content read by the `reader` role, and
they can never approve, pair, or change a setting.

**The data model is ready for more owners.** Every record, grant, audit row, session, file, and
job carries an `ownerId`; in v1 it is always the one owner. People in memory are `person` records
(ADR-023), not users. Code never assumes a global owner where an `ownerId` can be passed, so
multiple owners can be added without a data migration.

**Households: one Jaari per person.** Each person runs their own instance with their own memory,
vault, and gate. Sharing between instances follows the deferred open-instinct and Trusted Pals
design (ADR-020): per person and per capability (for example "my partner's Jaari can see my
free/busy"), through grants (ADR-072).

**Multiple owners in one instance are planned for later.** The design must then keep each owner's
memory repository, vault namespace, approvals, sessions, channels, and budgets separate, with no
cross-owner reads unless granted. It is not in v1 and needs its own ADR before it ships.

**Unknown senders.** They get nothing, as today (ADR-022). An optional notice, off by default,
puts one line in the digest ("Sam messaged the bot on Telegram") without replying to the sender.

**Group threads** (when a channel supports them): approvals, links, and codes go only to the
owner's private chat; only the owner's own message changes permissions; a loop breaker stops
replies to another assistant after a few rounds.

Borrowed: per-person, per-capability sharing between assistants, private-chat approvals in
groups, and the loop breaker from Pally (learning/11); the tier model from open-instinct
`packages/network` as the deferred design.

## Alternatives rejected
A shared household instance with guest access in v1 (two people's secrets and memory in one
process before isolation exists); no owner id in the data model (a later migration across every
store); replying to unknown senders (it confirms the bot exists and invites probing).

## Consequences
_TODO: fill in as implementation reveals them._
