# ADR-095: Capability names for vault, contacts, storage, memory, skills, and takeover

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
The capability table is the only list of names the model can ask for (ADR-018), and an unknown
name fails closed (ADR-071). Gated effects had no name (vault writes, ADR-013; address-book
writes and file-storage uploads, ADR-039; erase, ADR-029); the read tools `memory.search`,
`records.query` (ADR-023, ADR-024), and `skill.load` (ADR-060) had no capability; and no
capability had ADR-018's `takeover` class (OQ-79). A new name takes an ADR (ADR-071).

## Decision
| Name | Class | Covers | Approval |
|---|---|---|---|
| `vault.write` | gated | New or changed vault items | Allow once, never grantable; OAuth rotation within ADR-090 is exempt |
| `contacts.read` | read | Synced contacts and person records from the address book | None |
| `contacts.write` | gated | Address-book changes | Allow once |
| `storage.read` | read | Remote file storage (WebDAV, Drive, OneDrive) | None |
| `storage.write` | gated | Uploads and changes to remote file storage | Allow once |
| `memory.read` | read | The tools `memory.search` and `records.query` | None |
| `memory.erase` | gated | Erase and `jaari memory purge` | Allow once, never grantable |
| `skill.read` | read | The tool `skill.load` | None |
| `takeover.request` | takeover | Asking the owner to act (log-in, CAPTCHA, a human-only step) with the ADR-055 states | No digest: the owner does the act; Jaari's own actions on that session are refused while the owner holds it |

`storage.*` is remote file storage; `files.*` stays local files. Correct and forget stay
memory writes the owner asks for; only erase is gated. None of these names joins ADR-072's
grantable list.

## Alternatives rejected
Treating the read tools as internal and outside the vocabulary (breaks "every tool maps to a
capability"); reusing `files.*` for remote storage (one name for two trust boundaries); making
contacts and storage writes grantable now (can be added later through ADR-072).

## Consequences
_TODO: fill in as implementation reveals them._
