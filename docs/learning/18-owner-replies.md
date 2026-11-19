# 18: How channels and the references handle replies to earlier messages

Written 2026-11-17, for ADR-117. Sources: the channel APIs' own docs (links below), and the five
reference repos, searched for inbound reply fields, quoted text, and outbound quote-replies.

| Ref | Pinned commit |
|---|---|
| `refs/openmausbot` | `b8022684d1f519d49a776e00900ae9c65daa357d` |
| `refs/open-instinct`, `refs/openinstinct`, `refs/gajae-way`, `refs/pi` | See `refs/INDEX.md` |

## 1. What the sources do

**Channels.** Every planned channel says which message a reply points to, by id. Only some send the
quoted text, and two take it from the sender's own app.

| Channel | Inbound | Outbound | Id to keep | Quoted text |
|---|---|---|---|---|
| Telegram ([Bot API](https://core.telegram.org/bots/api#replyparameters)) | `reply_to_message`; partial `quote` | `reply_parameters` (Bot API 7.0) | `chat_id` + `message_id` | Full original, from Telegram |
| WhatsApp Cloud API ([contextual replies](https://developers.facebook.com/documentation/business-messaging/whatsapp/messages/contextual-replies)) | `context.id` | `context.message_id` | wamid | None |
| WhatsApp, Baileys ([source](https://github.com/WhiskeySockets/Baileys/blob/master/src/Utils/messages.ts)) | `contextInfo.stanzaId` | `{ quoted }`, needs the full stored message | `key.id` + `remoteJid` | Copy from the sender's client |
| iMessage, BlueBubbles or `chat.db` ([BlueBubbles](https://github.com/BlueBubblesApp/bluebubbles-server)) | `thread_originator_guid` | `selectedMessageGuid`, Private API only | `guid` | None |
| Signal, signal-cli ([docs](https://github.com/AsamK/signal-cli)) | `quote.id` (a timestamp) + author | `quoteTimestamp` + `quoteAuthor` | timestamp + own number | Copy from the sender's client |
| Email ([RFC 5322 §3.6.4](https://www.rfc-editor.org/rfc/rfc5322#section-3.6.4)) | `In-Reply-To`, `References` | the same headers | `Message-ID` | Unstructured body only |

Slack has threads (`thread_ts`), not quotes; Discord has `message_reference`. The meanings of the
`chat.db` columns come from reverse engineering; Apple publishes no schema.

**References.**
- **OpenMausBot** handles replies in its own app only. The client sends `replyToId`; the server finds
  the message in its stored thread and refuses an unknown id (`server/replies.ts`, `replyTargetIn`).
  The quote reaches the model fenced as untrusted text, and a reply can answer a card or a 👍/👎,
  known only from the route that checked it, "never read back from the message text".
- **Pi** (`apps/p2` chat mode): "a client only names the entry"; the worker reads the excerpt from
  its durable store (`plugins/chat-mode/contract.ts`).
- **gajae-way** reads Telegram, Discord, and Slack replies, puts `reply to our msg:<id> "<excerpt>"`
  in the prompt, and treats a reply to the bot as a mention. It trusts the platform's excerpt and
  defuses it (`gateway/src/server/speaker.ts`, `headerSafeExcerpt`). A Slack thread is its own
  session. The model writes `[REPLY:<id>]` to quote-reply.
- **openinstinct** reads iMessage reply guids but uses them only to target its outbound, and refuses
  an owner approval command that comes with quoted content (`daemon/src/owner-turn.ts`).
- **open-instinct** carries reply ids and uses none of them.

## 2. Why
A reply is the owner saying which thing they mean, so it is worth reading. But the quoted text is a
claim, and on Baileys and Signal the sender's client writes it. The careful sources accept only the
pointer and read the content from their own record, so a forged quote cannot change what the agent
thinks was said. openinstinct goes further and keeps quotes out of approvals altogether.

## 3. What Jaari did, and where it differs
- Borrowed the OpenMausBot and Pi rule: the contract carries only the id; code looks it up in the
  store (`message_ref`), and an unknown id means no reply target.
- Differs from gajae-way: no thread sessions (one main session, ADR-065), no trust in the platform
  excerpt, and code, not the model, decides when Jaari quote-replies.
- Differs from openinstinct: a reply whose whole text is an answer word settles the one approval it
  replies to, like a button tap, in a direct owner chat only. Code maps reply id → prompt id → digest.
- New: a reply target may widen a brake (pause the routine it replies to, as well as the turn) but
  never narrow it. No source routes a stop by reply.
