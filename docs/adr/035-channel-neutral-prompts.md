# ADR-035: Channel-neutral prompts: Jaari asks in types, each channel renders what it can

- **Status:** Accepted
- **Extended by:** [ADR-037](037-voice.md), [ADR-117](117-owner-replies-are-pointers.md)
- **Date:** 2026-11-11

## Decision
**Jaari asks in types, never in channel formats.** An approval, a choice, or a question reaches a
channel as a typed `Prompt` on the `OutboundMessage` (ARCHITECTURE.md, Channels):
`approval` (digest code, summary, options `once` / `always` / `deny`, optional details link,
expiry), `choice`, `confirm`, `input`, and `link` (panel, takeover, pairing). "Approval card"
elsewhere in the docs means this typed prompt, not a widget of one messenger.

**Each channel declares what it can show.** The manifest field `prompts` is `buttons` (Telegram
inline keyboard, the web panel), `quickReplies` (tap-to-send replies), or `text` (iMessage,
SMS, email, CLI). The host renders the prompt for that level; for `text` it writes the reply
grammar into the message ("Reply *once 4821*, *always 4821*, or *no 4821*"). Plugins never
format prompts themselves, so a plugin without buttons works unchanged.

**Answers come back typed.** A tap arrives as `InboundMessage.answer = { promptId, option }`. A
text reply is parsed by the host with a fixed grammar (code plus option) in deterministic code;
no LLM reads the answer (ADR-006). Both reach the gate as the same answer.

**Rules that do not depend on the channel.**
- The answer binds to the digest through the code; a tap carries the prompt id, which the host
  maps to the digest.
- A bare "yes" counts only when exactly one prompt is open in that conversation; otherwise the
  code is required.
- Expired or already answered prompts are refused with one line.
- Only the owner on a paired channel can answer (ADR-022).
- Details that do not fit a message (a full script, a diff, a long draft) sit behind a panel
  link; the message carries a summary and the code.
- Secret entry is always a panel link, never chat text (ADR-021).
- Prompts go to the active channel (ADR-022) through the outbox (ADR-033).

Spoken answers are OQ-16.

## Alternatives rejected
Each plugin formatting approvals itself (inconsistent wording and a second parser per plugin); a
model reading free-text replies to decide what was approved (puts an LLM in the approval path);
accepting a bare "yes" with several prompts open (ambiguous binding); buttons only (excludes
text-only channels such as iMessage and SMS).

## Amendments
- **ADR-037:** decides spoken answers (left here as OQ-16): a spoken approval is one rendering of the prompt.
- **ADR-117:** in a direct owner conversation, a reply to an open approval whose whole text is an
  answer settles that prompt, like a tap; the reply id maps to the prompt id.

## Consequences
- Roadmap 0.8 (2026-11-17): `createPrompts` in `@jaari/channels` parses answers in code; open
  prompts live in memory and are lost on restart until the gate persists them (Phase 3). The
  gate stub has nothing to approve yet, so `onAnswer` is wired with the gate.
