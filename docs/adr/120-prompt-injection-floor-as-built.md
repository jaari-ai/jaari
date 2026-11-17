# ADR-120: The prompt-injection floor as built: model calls are not scanned, the fence id lasts one run, the canary lives with the conversation, and an unlabelled turn is the owner

- **Status:** Accepted
- **Date:** 2026-11-17

Roadmap 0.16 built the Phase 0 part of [ADR-104](104-prompt-injection-defence-in-depth.md).
Building it showed two contradictions and several gaps in the text. This ADR decides them. It
amends ADR-104, [ADR-080](080-egress-core-in-phase-0.md) (the scan in the egress core),
[ADR-042](042-prompt-versioning.md) (the fingerprint), [ADR-024](024-context-assembly.md) (the
canary in the Stable part), and [ADR-117](117-owner-replies-are-pointers.md) (the reply line).

## Decision

1. **Model calls are not scanned.** ADR-104 section 6 says `@jaari/http` scans every outbound
   URL and body for the canary and the fence id. The system prompt holds both, and it goes to
   the model provider in every call, so that rule would block every turn. `createEgress` takes
   the scan as an option (`scan`, `onLeak`). The daemon builds two egresses: one for
   `@jaari/llm` without the scan, and one with it for everything else. The address check is the
   same in both.
2. **An unlabelled owner turn is the owner.** ADR-104 section 1 says that only lines labelled
   `owner` are requests; section 2 says that owner turns carry no note. Both hold: the owner's
   words are the plain text of a user turn outside any block, or a block marked
   `authority=owner` (owner words that arrive another way, for example a held message handed
   back). The safety section says so in rule 1.
3. **The fence id lasts one daemon run.** The main session never ends (ADR-065), so "per
   session" cannot mean the stored session: an id that leaked once would stay valid for ever.
   `createMarkers` makes a new id at every start. A fenced block from an earlier run stays in
   the transcript with its old id. The safety section tells the model that a marker with
   another id is data, which is the safe reading. The locked file cannot hold a value that
   changes, so code states the id once, right after the safety section. Only the current id is
   scanned for.
4. **The canary is made by the daemon and kept in `session.db`.** 24 random base32 characters,
   written once to the `state` table at the first start. `jaari init` writes only the config
   file, which owners edit and share. The keychain is for secrets, and the canary is not one:
   the provider sees it in every call. A restored backup keeps its canary.
5. **What a hit does.** The check runs before anything is sent. It writes one `leak.blocked`
   line to the event log with the path (`egress` or `channel`), the marker's name (`canary` or
   `fence-id`), and the host or channel. The value is never logged. The event log is the audit
   record until the action log ships with the gate (Phase 3). The owner is told in the active
   conversation: a blocked reply is replaced by a fixed notice, and a blocked outbound call
   sends one through `ingress.tell`. That notice goes direct until the notification ledger
   exists (roadmap 2.3).
6. **What the scan finds.** A marker as written, in another letter case, percent-encoded, or
   split by invisible characters. It reads the URL, every header, and the body. It does not
   find a base64, compressed, or reworded leak (THREAT_MODEL.md, "Any path out").
7. **The order on a channel.** The reply marker filter runs first, then the scan, then the
   split into messages, so a marker cut in two cannot pass. A reply that held only markers is
   replaced by a fixed line. A prompt is scanned before it opens, so an answer word cannot
   settle a prompt that the owner never saw.
8. **`defuse` removes every Unicode format character** (general category Cf) and every
   variation selector, not only the ranges ADR-104 lists, so a character that Unicode adds
   later is covered. Bidi controls and line separators become a space first. Its steps are a
   named list, and a test removes one step at a time to prove that each is needed.
9. **`from` and `kind` are names set by code** (lowercase letters, digits, `.`, `_`, `:`, `-`).
   `fence()` refuses anything else, so a value copied from content cannot add a field to the
   marker.
10. **Left for context assembly (roadmap 1.3).** `fence()` has no caller in Phase 0, because
    no tool reads untrusted content yet. Two lines that code writes into a user turn still
    carry no harness note: the ADR-117 reply line and the compaction summary (ADR-065). The
    reply line stays one line with its fixed prefix, because capture strips it by that prefix
    (roadmap 1.8). The per-turn prompt fingerprint of ADR-042 had no roadmap item; it is now
    part of 1.3. Until then `daemon.start` logs the safety section's version and SHA-256.

## Alternatives rejected
- **Scanning model calls with the system prompt cut out:** each provider encodes the prompt in
  its own way, so the cut would be fragile, and a mistake blocks every turn.
- **A fence id stored with the session:** one leak would let content forge fences for ever.
- **The canary in the config file, written by `jaari init`:** owners paste their config into
  issues and chats, and a known canary is useless.
- **The canary in the keychain:** it is not a secret, and a keychain read at start is one more
  way for an unattended start to fail (ADR-079).
- **Fencing the ADR-117 reply line now:** a fence is three lines, and ADR-117 and capture need
  one line with a fixed prefix; 1.3 decides the label for both together.
- **Letting an egress hit only throw:** the model would see the error and the owner would not;
  ADR-104 says the owner is told.

## Consequences
- The scanned egress has no user until the first tool that fetches (roadmap 4.5). The daemon
  returns it, and the smoke test proves the block and the audit line through it.
- Until 1.3, a compaction summary reaches the model as an unlabelled user message. It can
  repeat text from quoted content. Nothing untrusted is read before Phase 4, so the gap cannot
  be used yet; 1.3 must close it before 4.3 ships.
- The safety section is `packages/core/prompts/safety.md`, version 1. Any change to it is a
  release change with a new version line (ADR-042).
