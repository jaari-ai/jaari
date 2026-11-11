# 11 — Pally: a second commercial reference, and what Jaari borrows

Studied 2026-11-10 from Pally's own public pages: the facts page, the changelog (June and
August to November 2026 read; July not read), the privacy policy, the MCP, group-chat, and
Trusted Pals pages, and its Pally-vs-Instinct comparison. Reference table and links:
[00-research.md §11](../00-research.md). There is no source code, so everything is a
**vendor claim** unless noted, and the comparison page is Pally's own marketing. No decision
taken; the proposals below sit next to those in
[10-open-questions-review.md](10-open-questions-review.md).

## 1. What Pally does

**Product.** A personal assistant you text. Made by Pally Technologies, Inc. (Y
Combinator-backed, two founders, $5.2M raised at a reported $30M valuation). Its changelog
dates the launch to 2026-06-11; Product Hunt lists 2026-07-30. Free with usage limits, a paid
"Cloud Mac" add-on, and a planned fee from merchants when you buy through it.

**Shape.** A cloud service (`agent.pally.com`), not self-hosted. Each user gets an assistant
phone number and, on first need, an email address. Around that core:

| Part | What the pages say |
|---|---|
| Channels | iMessage or RCS (SMS only as fallback), WhatsApp, Telegram, inbound and outbound phone calls, email, and an MCP server so other AI apps can talk to it |
| Mac companion app | Pairs with a code. Reads and sends the owner's own iMessages (with confirmation), X and LinkedIn DMs, the address book, and runs terminal commands. Several Macs can be paired and Pally "picks the one that has what each task needs". Actions wait while the Mac is offline and run on reconnect. Disconnecting a Mac "erases what Pally learned from its messages" |
| Cloud Mac | Paid, always-on Mac that Pally sets up after the owner signs in to Apple (listed as in progress) |
| WhatsApp | The owner's own account "through WhatsApp's Linked Devices flow" |
| Browser | Cloud browser with one profile per website, kept signed in. Saved logins are filled from a vault. The owner can take over through a live link; "a purchase never completes while you are driving the browser yourself" |
| Vault | Passwords are saved "on a secure page, never in chat". An API key pasted into chat is removed and rotation suggested. Passwords, codes, and card details are hidden "in page text, history, and screenshots" |
| Connectors | Gmail, Outlook, calendars, Slack, Drive, Notion, Linear, GitHub, Jira, a read-only bank link, custom MCP servers by address, Zapier |
| Memory | "Tidies it up every night". "Each fact carries its evidence, and a newer fact replaces an older one on the same topic". A dashboard shows "Knows" (what it knows about you) and "People" (a personal CRM); view, edit, delete, export |
| Proactivity | Morning brief, important-message alerts, automations on schedules and on connected-app events |
| Multi-party | Group chats (mostly listens, approvals always in the private chat) and Trusted Pals (per-person, per-capability sharing between two people's assistants) |
| Payments | Card wallets (Link, AgentCard); "Pally no longer stores card numbers" |

**Not published:** the models, the memory store and retrieval method, the subprocessors, and
whether approvals are enforced by code or by the model. The privacy policy names no AI or
hosting vendor and says Pally trains on user data by default (opt-out), though never on
connected accounts. A claim seen in third-party listings that data "stays on device" on
"locked-down GPUs" does not appear on Pally's own pages and is treated as unverified.

## 2. Why it does it that way

| Failure prevented | Mechanism (Pally's wording where quoted) |
|---|---|
| A cloud agent cannot reach iMessage, X, or LinkedIn | A companion app on the owner's Mac does those reads and sends; the cloud holds the conversation |
| The Mac is asleep or offline | Actions wait and run on reconnect; it reports the Mac asleep "only when it is"; a Cloud Mac for people who want always-on |
| Approving something other than what was shown | "Saying yes binds to the exact draft you saw"; a yes "approves the most recent draft Pally showed you" |
| Approval fatigue | "After repeated similar approvals, Pally can offer a standing permission"; "Tell Pally once what it may send"; anything beyond named recipients stays "a draft for your go-ahead" |
| A standing permission that covers too much | Under a saved "run anything" terminal permission, "commands that read your Keychain or use sudo still ask first" |
| Injected text causing an action | "Content inside emails, pages, or tool results can never trigger Pally to send a message on its own" |
| Stopping at every click | The browser "pauses only before a real commitment, such as a payment, order, booking, or message" |
| Claiming success that did not happen | Results are checked "against what actually happened before they go out"; it says when an app "only acknowledged a change and did not confirm it"; "its own claims do not count as your confirmation" |
| A secret typed into chat | Removed before storage; a "secure one-time page" for a password a Mac command needs |
| Approvals leaking into a group | "In group chats, approvals, connect links, and sign-in codes go to your private chat"; "only your own message can change your permissions" |
| Notification overload | Alerts "interrupt only for money, deadlines, commitment changes, and urgent news"; each new message is checked once and "the rest waits for your morning brief" |
| Messaging someone who stopped listening | "After 7 days with no reply or reaction, Pally pauses its own messages" and says so once; "stop" silences everything, and a vague stop gets a question before automations are cancelled |
| Running out of budget mid-job | "When you reach it, chat keeps working on a faster model and background work waits"; it checks in once before one job uses up the limit |
| A provider outage or rate limit | Switches "to a backup model instantly"; "holds only the limited part" and resumes when the limit lifts |
| Data that outlives its source | Deleting a conversation "also erases what Pally learned from it"; disconnecting an app deletes its stored messages; copies of other people's messages "expire after 30 days" |
| Another AI app impersonating the owner | The MCP link is completed by sending a single-use code in the owner's own chat within 10 minutes; "Pally never messages first" |
| Two assistants looping | It "stops replying to an AI assistant that loops with it in a group chat" |

## 3. What Jaari does, and where it differs

**Confirmed by Pally.** The Mac companion app is ADR-015's node, built by a commercial team
for the same reason: some capabilities exist only on the owner's device. Their Cloud Mac is
the always-on node, and their per-website browser profile, vault fill, and hidden secrets
match ADR-005, ADR-007, and ADR-016. "Yes binds to the exact draft" is ADR-006 in product
words. The owner's own network identity for owner accounts (ADR-017) is what the Mac app
buys them.

**Where Jaari stays different.**
- Self-hosted and owner-controlled, not a cloud service; no training on the owner's data; no
  merchant fee, so nothing pulls recommendations toward a seller.
- Approvals are deterministic code bound to a SHA-256 digest (ADR-006, principle 9). Pally
  does not say what enforces its approvals.
- Pally "follows each connected MCP server's full instructions". For Jaari a server's
  instructions are untrusted content and its annotations are never trusted (OQ-14).
- A saved "run anything" terminal permission is outside what Jaari grants; `shell` stays
  gated (ADR-018).
- Payments stay out of v1 (OQ-19); Trusted Pals is the deferred multi-party design (ADR-020).

**Worth borrowing (proposals).**

| Topic | From Pally | Proposal for Jaari | Affects |
|---|---|---|---|
| Node routing | Several Macs; picks the one that has what the task needs; the request names the device | The loader picks a node by capability and provider, and the approval card names the node | ADR-015, OQ-50 |
| Node offline | Wait and run on reconnect; say "asleep" only when true | Already in ADR-015 (queue with expiry); add a real asleep or offline state to node health | OQ-36, OQ-37 |
| Node removal | Disconnecting erases what was learned from its messages | Unpairing a node or disconnecting an account forgets everything derived from it | OQ-09, OQ-37 |
| Forget by source | Deleting a conversation erases what was learned from it | Every canonical fact line carries a source id, so "forget this source" is mechanical, not a search | OQ-09, OQ-53 |
| Evidence | Each fact carries its evidence; newer replaces older on the same topic | A second reference (after OpenMausBot) for the quote check; supersede by topic key | OQ-53, OQ-09 |
| Commitment classes | Pause only before payment, order, booking, message | These four are the target list for the deterministic classifier; everything else in a session is ordinary `browser.act` | ADR-051 |
| Takeover safety | A purchase never completes while the owner drives | While the owner holds the browser, the agent cannot submit; a commitment made by the owner is the owner's own act and is logged as such | OQ-34, ADR-016 |
| Result honesty | Verify before saying done; separate "acknowledged" from "confirmed"; own claims are not the owner's confirmation | Receipts carry `confirmed`, `acknowledged`, or `ambiguous`, and the reply text is generated from the receipt | OQ-13, OQ-40 |
| Interruption rules | Interrupt only for money, deadlines, commitment changes, urgent news; check once, rest waits for the brief | Seed list for the monitor's "urgent" class; each inbound item is scored once | PERSONA, OQ-13 |
| Silence | Pause proactive messages after 7 days without a reply, say so once; "stop" silences everything; ask on a vague stop | Monitor rule: no reaction for 7 days lowers Proactivity to 0 until the owner replies, with one notice | PERSONA, ADR-008 |
| Budget | At the limit, chat moves to a cheaper model and background work waits; one check-in before a job exhausts it | `onExceeded`: main session downgrades within its chain, children and routines queue; warn once at a job-level threshold | ADR-046 (owner chooses instead of a downgrade), OQ-38 |
| Rate limits | Hold only the limited part | Per-provider and per-connector holds, not a global pause | OQ-38 |
| Routines | Show requested and effective cadence; cap live searches per hour; learn from approved, declined, and expired drafts | Each routine shows both cadences and a per-routine call cap; draft outcomes feed the notification ledger | OQ-43, OQ-40 |
| Secrets in chat | A pasted key is removed and rotation suggested; a one-time secure page for typing a secret | Channel ingress scrubs a pasted secret before the transcript is stored and tells the owner to rotate it; secret entry happens in the panel, never in chat | ADR-007, OQ-46 |
| External AI apps | An MCP server with two tools (send a message, collect a long job by handle), linked by a code typed in the owner's chat | The smallest useful MCP surface for Jaari; approvals never pass through it | OQ-55 |
| Panel | "Knows", "People", and "what Pally decided for each message and why" | Three panel views: profile facts, people, and a decisions view over `audit.jsonl` | OQ-46 |
| Groups (later) | Approvals, links, and codes only in the private chat; only your own message changes your permissions; stop answering a looping assistant | Already in ARCHITECTURE for approvals; add the loop breaker when groups ship | ADR-044 |

**Alternative recommendations to learning/10.** Where Pally points somewhere else:

| OQ | learning/10 proposed | What Pally adds | Alternative |
|---|---|---|---|
| 51 Standing grants | Keep read-shaped only; no standing grants for sends | Pally offers a standing permission after repeated similar approvals, for named recipients; openinstinct also allows exact-recipient send rules. Two references now disagree with the leaning | After shadow mode, allow a standing send grant for one exact recipient and one topic. Code offers it after N identical approvals; it is revision-fenced, re-checked at dispatch, listed, and revocable. Never for `publish`, `pay`, `shell` with elevated rights, credentials, or calls |
| 30 Consequential actions | Gate every click, type, and fill inside owner-account sessions | Pally pauses only at four commitment classes | Gate by verb during shadow mode, then move to the four classes once the classifier has fixtures; "unreadable" still asks |
| 55 External control | Local socket, `jaari run` and `wait` | Two-tool MCP server with a handle for long jobs | Ship both: the socket for scripts, and the two-tool MCP server as the only remote surface |
| 09 Forgetting | Supersede, plus an explicit forget command | Forget cascades from a source (conversation, account, device) | Add source ids to facts so a cascade is possible; the forget command takes a fact or a source |
| 25 / 38 Budget and degraded mode | Cap is Jaari's own; send stamp for failover | Downgrade chat, pause background, hold only the limited part | Make that the default `onExceeded` behaviour |
| 13 Notifications | Only the main session speaks; outbox ladder | Four interruption classes and a 7-day silence rule | Add both to the persona monitor defaults |

**Open after this study.** Nothing new is opened. OQ-51 now has two references against its
leaning and should be decided before Phase 3. What enforces Pally's approvals, which models
it runs, and how its memory is stored remain unknown.

**Numbers worth keeping.** MCP linking code: single use, 10 minutes. Proactive pause: 7 days
without a reply. Copies of other people's messages: 30 days. Voice-note audio: 30 days. Gmail
event latency: about 5 minutes. Fare watch: at most one live search per hour. Contact added
after two emails. Changelog cadence: near-daily, which is itself a signal of a small team
shipping with coding agents.
