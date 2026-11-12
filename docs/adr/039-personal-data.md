# ADR-039: Personal data: calendar first, native for calendar, contacts, and files, MCP for the rest

- **Status:** Accepted
- **Extended by:** [ADR-072](072-standing-grants.md), [ADR-095](095-missing-capability-names.md)
- **Date:** 2026-11-11

## Decision
**Order.** Calendar, then contacts, then file storage. Notes come through memory, files, and MCP.

**Calendar.** One provider interface: CalDAV (iCloud, Fastmail, Nextcloud, Radicale, others)
plus native Google and Microsoft adapters through the OAuth broker (ADR-062). The vocabulary
gains `calendar.freebusy` and `calendar.read` (read) and `calendar.write` (gated) (amends
ADR-018). The calendar stays the source of truth: Jaari mirrors it into event records (ADR-023)
for recall and the 12-month horizon (ADR-024), re-synced every 15 minutes and on change where the
provider supports push.

**Calendar writes** (the ADR-036 model):
- An event on the owner's own calendar with no other attendees: Allow once, or Always allow for
  that calendar for 90 days.
- Anything that sends invitations or changes other people's events: treated like `email.send`,
  Allow once every time, never a standing grant.

**Appointments the owner mentions.** Every mentioned appointment is captured at once as an event
record with a quote (ADR-023).
- A direct request ("add the dentist on Thursday at 10 to my calendar") is added to the calendar
  right away when an Always allow grant for that calendar exists; otherwise the first such
  request shows the prompt with Always allow offered.
- A mention in passing ("I have the dentist Thursday"), or one where the date, time, or calendar
  is not certain, is not added: Jaari offers to add it, or asks to confirm the uncertain part.
- An event with attendees is never added without its own approval.

**Contacts.** CardDAV, Google, and Microsoft, synced read-only into person records; merges are
proposed with a quote, never applied silently; writes to the address book are gated. The
owner's closest contacts (ADR-033) come from this list plus learning.

**File storage.** WebDAV (Nextcloud, many NAS boxes) natively and Google Drive through the OAuth
broker; Dropbox, OneDrive, and others through MCP servers (ADR-034). Files read land in the
ADR-038 store and follow its rules; uploads and changes are gated.

**Notes.** Jaari's memory is the notes app. An Obsidian vault or Markdown folder is read through
`files.read`; Notion and Apple Notes through MCP. Nothing is imported into memory without a
preview.

**Accounts and credentials.** Each account (work and personal calendars, for example) is
configured separately and a write always names its account. App passwords (iCloud) are
`secretRef`s; OAuth tokens stay in the vault and are never seen by the model (ADR-062).

Borrowed: the free/busy, read, and write split and the stricter tag for tools that change a
calendar from open-instinct `packages/apps/src/capabilities.ts`.

## Alternatives rejected
A hosted connector broker for calendar and contacts (not self-hosted; tokens leave the box);
one `calendar` capability without the free/busy split (a scheduling helper would see every
event); adding passing mentions to the calendar automatically (wrong dates land silently);
standing grants for invitations (they message other people); native adapters for every service
(MCP covers the long tail).

## Amendments
- **ADR-072:** the own-calendar grant follows the one grant model; invitations are never grantable.
- **ADR-095:** contacts are `contacts.read` and `contacts.write`; remote file storage is
  `storage.read` and `storage.write`.

## Consequences
_TODO: fill in as implementation reveals them._
