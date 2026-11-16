# 17: How the references read stop, pause, and approval messages

Written 2026-11-16, for ADR-116 (resolves OQ-94) and OQ-95. Sources: the five reference repos,
searched for how an owner message is classified, and the notes on the commercial agents in
[00-research.md](../00-research.md) and [11-pally.md](11-pally.md).

| Ref | Pinned commit |
|---|---|
| `refs/openmausbot` | `b8022684d1f519d49a776e00900ae9c65daa357d` |
| `refs/open-instinct`, `refs/openinstinct`, `refs/gajae-way`, `refs/pi` | See `refs/INDEX.md` |

## 1. What the sources do
- **OpenMausBot** matches stop words in code, in about 20 languages taken from its own Stop-button
  translations. A line is a stop when every word is a stop word or a filler, after NFC and lower case;
  quoted text and code are masked out (`server/room-holds.ts`, `isStopCommand`). A stop aborts the
  running turn; in rooms, "stop" near a mention is a durable hold. Approvals are buttons and cards; typed
  text never answers an approval card. The person picks steer, queue, or restart in the message box. A
  small "decider" model routes group rooms and sorts email; any failure means "use the code rule", and its
  label cannot allow anything (`server/decider/types.ts`).
- **open-instinct** has no owner stop. Approvals are parsed in code (English words plus a 4-character
  token; a bare "yes" only with one approval open and a recent question); free-form answers are settled
  by the main model through `approval_settle`, which refuses money and calls and needs the owner's own
  message to have started the turn (`packages/core/src/approvals.ts`, `core-tools.ts`).
- **openinstinct** has no chat stop; pause is a panel button and drops messages that arrive while
  paused. Approvals are only the exact slash command with the action's digest.
- **gajae-way** has no stop; approvals are Slack buttons with a 5-minute expiry. A judge model can only
  keep the bot quiet in group chats, fails open, and never applies to the owner.
- **Pi** stops on the Escape key; Enter steers and Alt+Enter queues a follow-up, so the user chooses.
- **Commercial agents** publish no internals. Pally stops on "stop", asks back on a vague stop, accepts a
  plain-language yes bound to "the exact draft you saw", and pauses its browser only before a commitment.
  Muse has a stop control, approval buttons, and a separate agent that approves each outbound request.
  Instinct documents nothing here; testers reported an email sent without approval.

## 2. Why
The brake is the one control that must work when the model is wrong, slow, or down, so every source
keeps it in code, a button, or a key. Approvals bind to one exact thing (a digest, token, card, or
draft) so a yes cannot drift to another action. Where a small model is used, it routes or vetoes and
falls back to code, so its mistakes cost a wrong route, never an effect.

## 3. What Jaari did, and where it differs
- Borrowed OpenMausBot's word sets and its "only brake words and fillers" rule (ADR-016 attribution in
  `NOTICE`), and added pause words ("wait", "hold on") and the command forms people type.
- A stop word pauses, and a second one within 10 seconds stops the turn. No source has this repeat rule;
  it covers a frustrated owner who types "stop" again.
- Messages that arrive while paused are kept, unlike openinstinct (ADR-031).
- Approvals stay code-only (ADR-035), at the strict end with openinstinct; open-instinct and Pally show
  the convenient end.
- Not adopted yet, recorded as OQ-95: a model that reads what code misses. No source has one for stop
  intent. The case that needs it is a long tool step (browser, search, computer use), when the main
  model is not listening, on a channel with no Stop button.
