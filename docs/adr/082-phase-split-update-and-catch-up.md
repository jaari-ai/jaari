# ADR-082: Phase split for update and laptop catch-up

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-057 places laptop catch-up in Phase 0, but the job engine it replays ships in Phase 1, and
the rule for approvals that expired during sleep needs the real gate (Phase 3). `jaari update`
snapshots the stores first (ADR-056), but backup ships in Phase 3 (ADR-027), and automatic patch
installs need quiet hours and the digest (ADR-033, Phase 2). Both Phase 0 items bundle parts of
later phases (OQ-74). This ADR changes when parts ship, not what they do.

## Decision
**Laptop (ADR-057).** Phase 0: sleep detection, wake events, the power assertion, the battery
pause, and the network re-probe on wake. Catch-up of missed jobs ships with the job engine
(Phase 1). Asking again for approvals that expired during sleep ships with the real gate
(Phase 3). Late delivery of reminders ships with reminders.

**Update (ADR-056).** Phase 0 ships a manual `jaari update`: signature and provenance check,
version swap, `jaari rollback`, and `jaari doctor` after the swap with automatic rollback. Before
the swap it takes a local pre-update snapshot: a SQLite online backup, a copy of the config, and a
git tag on the memory repository, kept in the data directory at mode 0700, last two only. It
adds no exposure beyond the data directory itself. The Phase 3 backup work replaces it with the
ADR-027 encrypted bundle. Automatic patch installs turn on with quiet hours and the digest
(Phase 2); until then Jaari only says a patch is available.

## Alternatives rejected
Moving the job engine or backup into Phase 0 (pulls large items forward for a feature with no
users yet); updating without a snapshot (ADR-056 rejects it).

## Consequences
_TODO: fill in as implementation reveals them._
