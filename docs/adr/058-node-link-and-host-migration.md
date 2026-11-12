# ADR-058: Node link and host moves: pinned TLS over the overlay, results that survive a disconnect, generation-fenced host migration

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Node link.** A WebSocket over TLS 1.3 across the overlay (ADR-030). The daemon's key is pinned
at pairing (from the QR code); each node proves itself with a signed challenge from its device key
plus its token (ADR-022), the same authentication the panel uses. Reconnect with backoff from 1 s
doubling to 60 s, with jitter; on reconnect the node re-advertises its capabilities and
permissions (ADR-057).

**Actions across a disconnect.** A node keeps only a small outbox of results for actions that
finished while disconnected, for up to 1 hour. The daemon asks for the status of every in-flight
action and never resends one that may already have been accepted (ADR-016); if the status cannot
be learned, the action is marked "outcome unknown" and the owner is told.

**No relay in v1.** Overlay only. A relay, if one is ever added, may see only ids, timing, and
volume.

**Moving the daemon (`jaari migrate-host`, any direction).**
1. Pending approvals first. If any are open, the move stops with a warning listing them and two
   options: cancel them and ask again after the move, or carry them over. A carried approval keeps
   its digest and is shown again from the new host; prompts from the old host stop working.
2. Export: the old daemon pauses, drains running work, and writes one bundle encrypted with a
   passphrase the owner types: memory repository, SQLite, audit log, config, device registry, and
   the file store (ADR-038).
3. Import: `jaari init --import <bundle>`. Secret zero is entered again (it is never in a bundle,
   ADR-027); local models are qualified again on the new hardware (ADR-045); the placement rule is
   checked again (ADR-017).
4. No split brain: each install has a generation number and the bundle raises it. Nodes, channels,
   and backup remotes accept only the highest generation. If the old daemon starts again, it says
   "this install moved to <host> on <date>" and refuses all effects and channel polling.
5. Nodes follow without pairing again: the old daemon signs a handoff naming its successor's key;
   nodes pin the new key. A node that was offline during the move fetches the handoff from the new
   daemon and checks it against the old key.
6. Browser profiles (cookies) move only if the owner chooses; otherwise the owner signs in again
   on the new host's browser.

Background: Pi `RemoteExecutionEnv` (`packages/env`, docs only) as a candidate shape for node
execution; the relay rule from learning/09.

## Alternatives rejected
A Noise handshake (a second protocol to maintain with no gain over pinned TLS); a relay in v1;
resending in-flight actions after a reconnect; moving the daemon with approvals silently dropped
or silently carried; re-pairing every node after a move; two daemons answering at once.

## Consequences
_TODO: fill in as implementation reveals them._
