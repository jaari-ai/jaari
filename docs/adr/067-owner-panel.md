# ADR-067: Owner panel: one PWA served by the daemon over the overlay, an optional passkey, untrusted content as text, views grown by phase

- **Status:** Accepted
- **Extended by:** [ADR-088](088-overlay-panel-and-node-link-phasing.md)
- **Date:** 2026-11-12

## Decision
**One PWA served by the daemon.** `@jaari/channel-web` is served only over the owner's overlay
with TLS (ADR-030); no public ports. The panel uses the same daemon API as the CLI, so it can do
nothing the CLI cannot. The daemon pushes live updates. The panel installs on a phone as an app.

**Signing in.** The panel is a paired `device` (ADR-022) and can be revoked from any trusted
channel. An optional passkey (WebAuthn) asks again before secret entry and before taking over an
owner-account session (ADR-055). Pause and emergency stop (ADR-031) never ask for it. Approvals
are already bound to the action's digest, so the passkey is not asked for each approval. Opening
the panel does not make it the active channel (ADR-022).

**Safety rules.**
- Only the panel's own bundled code runs: no third-party scripts or CDNs, and a strict content
  security policy.
- Untrusted content (email, web pages, text read from documents and photos) is shown as plain
  text, never rendered as HTML.
- Offline, the panel shows the last status it fetched, read-only; it cannot approve offline.
- Secret-entry pages are single-use (ADR-007, ADR-035).

**Views.**

| View | Contents |
|---|---|
| Home | Status strip (ADR-032), waiting approvals, running tasks, Pause and Stop always visible |
| Approvals | ADR-035 cards with the full digest summary |
| Live view | Watch and take over (ADR-055) |
| Memory | Browse and edit, each edit a commit through the single writer with a diff preview (ADR-026); "Knows" (profile facts); "People"; "What Jaari learned" (ADR-061); photos (ADR-066); forget and purge (ADR-029); export |
| Activity | Audit viewer and a "why" view: what Jaari decided for each message and why |
| Routines and skills | ADR-064 and ADR-060 |
| Usage | Budgets, spend, and the projection (ADR-046) |
| Settings | Persona dials; notifications and urgency (ADR-033); devices (ADR-022); network (ADR-030); capabilities and the permission matrix (ADR-057); prompt layers (ADR-042); disk use (ADR-038); voice (ADR-037) |

**Web push** only while the panel is the active channel (ADR-033).

**Phasing.** Phase 2: Home, Approvals, secret entry, Memory (browse and edit, "Knows", "People",
forget), Activity, Usage, and Settings. Each other view ships with its feature: photos in Phase
5, live view in Phase 6, routines and skills as they ship.

Borrowed: the "Knows", "People", and per-message decisions views from Pally (learning/11, product
behaviour only).

## Alternatives rejected
A separate panel service or a hosted dashboard; panel-only API endpoints; a passkey on every
approval (nagging, since approvals are digest-bound); a passkey for pause or stop; rendering
untrusted content as HTML; approving from an offline cache; shipping every view in Phase 2.

## Amendments
- **ADR-088:** Approvals and the audit part of Activity ship with the real gate (Phase 3), and
  secret entry with the vault work (Phase 3); the other Phase 2 views are unchanged.

## Consequences
_TODO: fill in as implementation reveals them._
