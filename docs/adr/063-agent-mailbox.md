# ADR-063: The agent's mailbox: every mailbox option coded as an adapter, setup guides per option, inbound mail as data, no phone number in v1

- **Status:** Accepted
- **Extended by:** [ADR-071](071-capability-packages.md)
- **Date:** 2026-11-11

## Decision
**Every option is coded and ready; the owner picks.** A `MailboxProvider` interface with adapters
for:
- the owner's personal mailbox, scoped to a plus-address (`you+jaari@…`), an alias, or a folder or
  label (what most owners are expected to use, so `init` lists it first);
- a mailbox or alias on the owner's domain over IMAP and SMTP (Fastmail, Migadu, self-hosted
  Stalwart or mailcow, any host);
- a separate Gmail or Outlook account through the OAuth broker (ADR-062);
- JMAP where the host offers it.

Setup guides in `docs/guides/` show how to configure each option; none is pushed. With the
personal mailbox, Jaari reads only the chosen address, alias, folder, or label; reading the rest of
the inbox is the separate `email.read` capability.

**Uses.** Sign-ups for accounts the agent owns (anonymous work, ADR-017); one-time codes for them
(ADR-050); receipts and confirmations for things Jaari booked; newsletters or alerts it follows
for research.

**Inbound.** IMAP IDLE or push; each message is one idempotent observation keyed on its
Message-ID, read by the `reader` role first, and never authority, even when it claims to come from
the owner (ADR-022). Mail from the agent's own address is refused (loop guard). Attachments go to
the file store (ADR-038). Mail is kept 30 days unless it becomes a record (a receipt becomes a
ledger line, a booking an event).

**Outbound.** `email.send` from the agent's mailbox is gated, Allow once each time with recipient
and body in the digest. Replies to a confirmation flow Jaari started ("reply YES to confirm")
follow the commitment rule (ADR-051), also Allow once.

**Deliverability.** On an owner domain, `jaari doctor` checks SPF, DKIM, and DMARC for the agent's
address.

**No phone number or SMS gateway in v1.** A voice number comes, if ever, after live calls
(ADR-037), with every outbound call approved on its own. No SMS gateway node is planned.

**Phase 5.**

Borrowed: one idempotent observation per message and refusing the agent's own address from
openinstinct `email/agent-email.ts` (docs only) and open-instinct `principal.ts`.

## Alternatives rejected
One supported mailbox type; a project-hosted mailbox; inbound mail as authority; reading the whole
personal inbox when the agent mailbox is a scoped alias; standing grants for sending; an SMS
gateway node.

## Amendments
- **ADR-071:** mailbox providers are capability packages with a checked manifest.

## Consequences
_TODO: fill in as implementation reveals them._
