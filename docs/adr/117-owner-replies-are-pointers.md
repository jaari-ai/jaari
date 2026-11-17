# ADR-117: Owner replies are pointers resolved by code; a reply may widen a brake and may answer one approval

- **Status:** Accepted
- **Date:** 2026-11-17

## Context
Messengers let the owner select an earlier message and reply to it, and let Jaari quote-reply.
The contract had `OutboundMessage.replyTo` but no inbound reply field, although ADR-064 ("stop by
replying") needs one. A study of the channel APIs and the five references ([learning/18](../learning/18-owner-replies.md)) found:
every planned channel reports the replied-to message by id (Telegram `reply_to_message`, WhatsApp
`context.id` or Baileys `contextInfo.stanzaId`, iMessage `thread_originator_guid`, Signal
`quote.id` as a timestamp, email `In-Reply-To`); only some send the quoted text, and Baileys and
Signal send a copy written by the sender's client. OpenMausBot (`server/replies.ts`) and Pi
(`apps/p2` chat mode) accept only the id and read the quote from their own store; gajae-way trusts
the platform excerpt and has to defuse it; openinstinct refuses owner commands that carry quoted
content.

## Decision
- **A reply is a pointer, not a thread.** `InboundMessage.replyTo?: string` is the platform id of
  the replied-to message, unique within `conversationId` (the adapter composes it where needed,
  for Signal `"<timestamp>:<author>"`). `InboundMessage.threadId?: string` (Telegram forum topic,
  Slack thread) is where to deliver, never a separate session: the main session stays one serial
  session (ADR-065). The contract has no field for quoted text.
- **Code resolves the pointer from Jaari's own record.** The store keeps `message_ref`
  (`channel`, `conversation_id`, `message_id` → transcript `seq`, `origin`), written for an owner
  message at ingress and for a Jaari message when its delivery receipt is `confirmed`. `origin` is
  `turn`, `task:<id>`, `routine:<id>`, or `prompt:<id>`. Rows live and are erased with their
  transcript rows (ADR-029). An unknown id means no reply target; the model is told the owner
  replied to a message Jaari has no record of.
- **The quote reaching the model is Jaari's stored copy**, fenced as data with who wrote it and
  when. Content that was `outside` (ADR-075) stays `outside` when quoted.
- **Order at ingress:** owner commands first (ADR-116), then an approval answer (below), then the
  main session, steered or queued as before, with the reply target attached.
- **A reply target may widen a brake, never narrow it.** A brake that replies to a routine's
  output pauses that routine (ADR-064) and still pauses the running turn (ADR-116). `commandOf`
  still reads only the text.
- **A reply may answer one approval, like a tap** (extends ADR-035). In a direct owner
  conversation, never a group (ADR-044), a message that replies to an open, unexpired approval
  prompt and whose whole text is an answer of the fixed grammar (`yes`, `once`, `always`, `no`,
  and their listed forms) settles that prompt: reply id → prompt id → digest, as for a tap. Any
  other text ("yes, but cc Sam") is not an answer and goes to the main session.
- **Jaari's quote-replies are set by code.** `OutboundMessage.replyTo` is set to the owner message
  that started the turn only when that message is no longer the latest owner message in the
  conversation. The model never writes message ids. A channel declares `capabilities.replies`;
  without it the field is dropped.
- **Text channels:** the CLI numbers messages and reads `>N text` as a reply to message N; the
  panel has a Reply action.
- **OQ-95** narrows: a message with a reply target already names the work it is about, so a model
  reading owner messages would only see messages without one.

## Alternatives rejected
- **Trusting the quoted text the platform delivers** (gajae-way): Baileys and Signal take it from
  the sender's client, so it can claim a quote that never happened; cleaning it is a second parser
  to keep right.
- **One session per thread** (gajae-way, Slack): built for many users in a channel; Jaari has one
  owner, and concurrent work already runs as child sessions.
- **A reply target that narrows a brake** (stop only the routine): a misread target would leave
  running what the owner meant to stop.
- **Approval by reply with any text, or in groups:** mixes a steer with an answer, and lets another
  participant's reply count (ADR-044). **Keeping the code always required:** safe but adds a step
  that a reply already makes unambiguous.
- **The model chooses which message to quote** (gajae-way `[REPLY:id]`): it can invent or misplace ids.

## Consequences
- The channel contract suite (ADR-084) tests: unknown reply ids, a reply to a prompt with extra
  text, a reply to an approval in a group, and a brake that replies to a routine.
- THREAT_MODEL gains a row: a forged quote from a client or another participant; mitigated by
  resolving the id against `message_ref` and ignoring delivered quote text.
- Implementation lands with roadmap 0.8.
