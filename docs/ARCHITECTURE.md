# Jaari: Architecture

## Principles
1. Single owner, self-hosted, owner-controlled data. The owner chooses where it runs: a VPS, a
   remote server, home hardware, or a laptop (ADR-017).
2. Memory is git-backed Markdown that a human can read and fix (ADR-003).
3. Model proposes, policy disposes: external effects need owner approval bound to a digest (ADR-006).
4. Secrets never enter model context; only `secretRef` handles do (ADR-007).
5. A proactive message must earn the interruption (ADR-008).
6. Personality is enforced by a monitor, not just a prompt (ADR-008).
7. Plug and play: every external dependency sits behind a provider interface with a
   self-hosted default and hosted alternatives.
8. Untrusted content (email, web, documents) is read by a tool-less `reader` role first.
9. Approvals, spend, and digests are deterministic code, never an LLM.
10. `refs/` is reference only; openinstinct is a spec, never a code source (ADR-009).
11. Model proposes, policy disposes, for model choice too (ADR-011).
12. Cheapest capable option first: small model before large, http before browser.
13. Always on, reachable anytime: one daemon on an always-on host; capabilities are
    installed where they run, on that host or on owner devices as nodes (ADR-015). A laptop
    is a supported host, with the cost that work pauses while it sleeps.
14. Identity follows the owner's network: a browser signed in to the owner's accounts runs on
    or through the owner's connection; rotating addresses are for anonymous traffic only
    (ADR-017).
15. The gate exists from the first line of executor code: Phase 0 ships it deny-all
    (ADR-018). Phases are a soft plan (ADR-020).

## Non-goals for v1
- Agent-to-agent networking (tiers, grants, A2A envelopes from the merge plan): reconsidered
  after Phase 8, behind the same gate.
- Payments: none in v1 (ADR-040); checkouts end at an owner takeover. Link one-time cards and the Visa/Mastercard agent
  directories are the rail to evaluate when that changes.
- Multiple owners: one owner per instance in v1 and one Jaari per person; every record carries an `ownerId` so multiple owners can come later (ADR-044).

## Packages
| Package | Responsibility |
|---|---|
| `@jaari/core` | Agent loop on Pi, sessions, children, tool registry; job engine (ADR-025), routines (ADR-064), skills (ADR-060), the `CliEngine` interface (ADR-077), the event log and the OpenTelemetry adapter (ADR-032) (ADR-086) |
| `@jaari/capabilities` | Capability and package manifest schema, loader, and the daemon–node contract; the single capability vocabulary lives in SECURITY_MODEL.md (ADR-015, ADR-018, ADR-071) |
| `@jaari/llm` | Wraps `@earendil-works/pi-ai`; tiers + fallback chains, role routing, escalation, budgets, local-only privacy, usage log, `jaari llm eval` (ADR-011); speech roles `stt` and `tts` (ADR-037, ADR-086) |
| `@jaari/memory` | Git-backed memory repo, write path, canonicalize, daily audit, gap queue; file store (ADR-038, ADR-086) |
| `@jaari/persona` | Curiosity/Proactivity dials, monitor, quiet hours, notification ledger |
| `@jaari/gate` | Action digests, approvals, re-check at dispatch, hash-chained `audit.jsonl` (ADR-006, ADR-016) |
| `@jaari/secrets` | `secretRef` resolution for executors only, through pluggable providers: `os-keychain` and `host-credential` from Phase 0 (ADR-018, ADR-079), then the vault providers (Bitwarden, 1Password; ADR-013, ADR-050); exact-value scrubbing of resolved secrets (ADR-016) |
| `@jaari/http` | Egress gate: resolve, classify every address against one address-class table, dial only checked addresses; SOCKS5 listener for the browser; per-capability allowlists (ADR-016); egress providers `owner-exit`, `direct`, `mobile`, `residential-proxy`, `vpn` (ADR-017, ADR-030, ADR-053) |
| `@jaari/web` | `web.search`, `web.fetch`, fetch escalation ladder (ADR-012) |
| `@jaari/computer` | Browser/desktop control behind one neutral surface with pluggable adapters (Playwright MCP, Stagehand, remote CDP, remote desktop), local profile, takeover (ADR-005, ADR-048, ADR-055) |
| `@jaari/channels` | `ChannelAdapter` contract and its shared contract suite (`@jaari/channels/contract`, ADR-084), ingress (principal resolution), delivery outbox, built-in adapters |
| `@jaari/integrations` | GitHub, npm, PyPI, email; mailbox adapters (ADR-063); OAuth broker, with tokens written through the gated vault write (ADR-062) (ADR-086) |
| `@jaari/mcp` | MCP client for configured servers, with generated manifests (ADR-034); the two-tool MCP server for paired apps (ADR-076); served by `jaari mcp` (ADR-086) |
| `apps/daemon` | Long-running process: scheduler tick, channels, jobs |
| `apps/hooks` | Separate hook listener: the only optionally public port; checks signatures and hands verified events to the daemon over the local socket (ADR-073, ADR-086) |
| `apps/cli` | `jaari init`, `jaari doctor`, `jaari llm eval`, `jaari llm usage`, `jaari pair` and `jaari devices` (ADR-022), `jaari run`, `wait`, `status`, `export`, and `mcp` (ADR-076), admin commands; `jaari doctor` collects each package's `health` (ADR-032, ADR-086) |
| `apps/node` | Capability host on an owner device: `jaari capability install <name>` pairs it as a `device`, it advertises installed capabilities, runs gate-approved actions, hosts takeover and live view. Capabilities on the daemon host run through the same contract in-process (ADR-015) |

## Channels
Every way of talking to Jaari (CLI, web panel, messengers, email) is a plugin behind one
`ChannelAdapter` contract in `@jaari/channels`. A plugin only moves messages; the host
side of `@jaari/channels` (ingress and the delivery outbox, run by `apps/daemon`) owns
everything else. Plugin authors: see [guides/channel-plugins.md](guides/channel-plugins.md).

### Contract
A channel is an npm package (or local path) exporting an adapter. The daemon loads it by
name from config: `"channels": ["@jaari/channel-web", "./plugins/example"]`.

Packaging (ADR-071): a channel is a capability package with a checked `jaari` manifest
(`kind: channel`), installed and pinned like any other package. A third-party channel runs in
its own process with only its declared egress and secrets; a local path is for development
only and makes `jaari doctor` warn. The manifest is the `jaari` key of the package's
`package.json`; the channel's own fields are its `channel` section (ADR-084):

~~~jsonc
"jaari": {
  "id": "telegram", "version": "1.2.0", "kind": "channel",
  "interfaceVersion": 1, "minJaari": "0.3.0", "hosts": ["daemon"],
  "egress": ["api.telegram.org"], "secrets": ["telegram.token"],
  "channel": { "capabilities": { "text": true, "media": true },
               "identity": "account", "prompts": "buttons", "maxMessageChars": 4096 }
}
~~~

The host checks it before loading any plugin code and passes it to the adapter. Every plugin
passes the shared suite in `@jaari/channels/contract` (ADR-084).

~~~ts
// The `channel` section of the package manifest (ADR-084); id and version are in the shared part.
export interface ChannelManifest {
  capabilities: {
    text: true;
    media?: boolean; reactions?: boolean; typing?: boolean;
    groups?: boolean; readReceipts?: boolean; edits?: boolean;
    deletes?: boolean;               // can delete the owner's message (ADR-055, ADR-081)
  };
  identity: "carrier" | "account" | "device" | "none";  // see Identity binding
  prompts: "buttons" | "quickReplies" | "text";          // how the host renders a Prompt (ADR-035)
  maxMessageChars: number;           // delivery splits long replies to fit
}

export interface Attachment {
  kind: "image" | "audio" | "video" | "file";
  mimeType: string; name?: string; bytes: number;
  ref: string;                       // host-side storage handle, never inline data
}

// What Jaari asks, independent of the channel (ADR-035). The host renders it for the
// manifest's `prompts` level; for "text" it writes the reply grammar into the message.
export type Prompt =
  | { kind: "approval"; id: string; code: string; summary: string;
      options: ("once" | "always" | "deny")[]; detailsUrl?: string; expiresAt: string }
  | { kind: "choice"; id: string; question: string; options: { id: string; label: string }[] }
  | { kind: "confirm"; id: string; question: string }
  | { kind: "input"; id: string; question: string }
  | { kind: "link"; id: string; label: string; url: string };  // panel, takeover, pairing

export interface InboundMessage {
  channel: string; conversationId: string; messageId: string;
  senderHandle: string;              // raw transport identity (phone, user id, email)
  isGroup: boolean; participants?: string[];
  text?: string; attachments?: Attachment[];
  answer?: { promptId: string; option: string };  // a tap on a rendered Prompt
  sentAt: string; receivedAt: string; // ISO 8601
}

export interface OutboundMessage {
  channel: string; conversationId: string;
  text?: string; attachments?: Attachment[];
  idempotencyKey: string;            // from the outbox; the adapter must dedupe on it
  replyTo?: string;
  prompt?: Prompt;                   // rendered by the host for this channel, never by the plugin
}

export type DeliveryReceipt =
  | { status: "confirmed"; providerMessageId: string }
  | { status: "failed"; retryable: boolean; error: string }
  | { status: "ambiguous"; error: string };  // outbox reconciles before any retry

export interface ChannelHealth { ok: boolean; detail?: string }

export interface ChannelContext {
  manifest: ChannelManifest;         // checked by the host before the plugin loads
  emit(msg: InboundMessage): Promise<void>;   // hand a message to ingress
  secrets: { get(ref: string): Promise<string> };  // this plugin's own secretRefs only
  log: { info(msg: string): void; warn(msg: string): void; error(msg: string): void };
  signal: AbortSignal;               // aborted on stop()
}

export interface ChannelAdapter {
  start(ctx: ChannelContext): Promise<void>;
  stop(): Promise<void>;
  send(msg: OutboundMessage): Promise<DeliveryReceipt>;
  cursor(): Promise<string>;         // opaque position for replay protection
  health(): Promise<ChannelHealth>;
}
~~~

### Rules the host enforces, not the plugin
- The plugin never sees memory, tools, the gate, persona, or the LLM. `ctx.secrets.get`
  resolves only the `secretRef`s declared for that plugin (ADR-007, ADR-013); values are
  never logged.
- Every inbound message goes through principal resolution in the host before ingress.
  The plugin reports the raw `senderHandle` and never decides who the owner is.
- Prompts (ADR-035): the host renders them and parses answers. A tap's `answer` and a text
  reply in the fixed grammar (code plus option) reach the gate as the same answer, decided by
  deterministic code. A bare "yes" counts only when exactly one prompt is open in that
  conversation. Long details and secret entry are panel links.
- Only the delivery outbox calls `send()`; nothing else imports an adapter. Proactive
  messages reach the outbox only through the persona monitor and notification ledger.
- `send()` must be idempotent on `idempotencyKey`. An `ambiguous` receipt is never
  blindly retried.
- Cursor fingerprint: on first start, anchor at the current position and replay nothing.
  If the bound identity changes, reset and replay nothing. (An early openinstinct build
  texted 21 stale failures to its owner; this rule prevents that.)
- Untrusted message content (anything not an owner turn) is read by the `reader` role
  first, like web pages and documents.

### Identity binding
The manifest's `identity` says what the transport can prove. Decided in ADR-022, which also
sets pairing, revocation, and the single active channel:

| `identity` | Transport proves | Can produce owner turns? | Pairing |
|---|---|---|---|
| `carrier` | A phone number (iMessage, WhatsApp, Signal, SMS) | Yes, if the number matches `owner.phones` | Number in config |
| `account` | A platform account (Telegram user id, Discord id) | Yes, after a one-time pairing code issued from the CLI | `jaari pair` code, or another ADR-022 method |
| `device` | A device key (web panel, WebCrypto P-256) | Yes, per enrolled device | QR / device enrolment |
| `none` | Nothing (email: `From` is forgeable) | **No.** Mail from the owner's address is untrusted content, never authority | n/a |

Unknown senders get nothing. Paired channels are equal; only the active channel (the one
the owner's latest message came from) receives replies, approvals, and proactive messages,
and switching channels continues the same session without replaying history (ADR-022).
Revocation: `jaari devices revoke <id>` or the panel (ADR-022).
In group threads other participants' messages are `outside` content (ADR-075); approvals,
links, and codes go only to the owner's private chat, only the owner's own message changes
permissions (ADR-044), and a bare "yes" in a group never settles an approval (approvals bind
to a digest, ADR-006).

### Candidate plugins
v1 ships the CLI (Phase 0), the web panel, and Telegram; email is an input only (Phase 5).
WhatsApp and iMessage come first after v1 (ADR-021).

| Plugin | Backend (OSS first) | Identity | Notes |
|---|---|---|---|
| CLI (in `apps/cli`) | Local socket to the daemon | `device` | Phase 0; development and admin |
| `@jaari/channel-web` | Built-in WebSocket + local panel | `device` | Always-available fallback and approvals UI |
| `@jaari/channel-telegram` | Bot API via grammY | `account` | Easiest real messenger; bots can't message unknown users first |
| `@jaari/channel-signal` | signal-cli (JSON-RPC), separate process | `carrier` | |
| `@jaari/channel-whatsapp` | Baileys (unofficial, ban risk) or Meta Cloud API (needs a Business account) | `carrier` | One plugin with a `mode` setting; document the ban risk |
| `@jaari/channel-imessage` | BlueBubbles (needs a Mac) or local `chat.db` reader + AppleScript sender with a dedicated Apple ID | `carrier` | The openinstinct path |
| `@jaari/channel-email` | IMAP/SMTP | `none` | Inbound email is data, never authority |
| Discord, Matrix, Slack | Community plugins | `account` | Not planned by core; the contract lets anyone add them |

Hosted bridges (Inkbox, Sendblue, Linq) can exist as third-party plugins; none is a core
dependency.

## Trust boundaries
- Owner ↔ channels: authenticated owner only (see [Channels](#channels) and ADR-022).
- Model ↔ tools: every tool maps to a capability; effectful capabilities go through the gate.
- Tools ↔ internet: all egress through `@jaari/http` or the container egress proxy (the core
  ships in Phase 0; ADR-080).
- Untrusted content ↔ main session: `reader` summary only, never raw instructions. Every run
  carries a code-set origin; `outside` sticks to derived work (ADR-075).
- Internet ↔ hook listener: a separate process that serves only hook paths, with signed
  deliveries; public exposure is opt-in (ADR-073).
- Scripts and paired desktop apps ↔ daemon: the local socket and the two-tool MCP server; they
  never approve or change policy (ADR-076).
- Daemon ↔ nodes: a pinned TLS link across the overlay; nodes run only gate-approved actions
  (ADR-015, ADR-058).
- Daemon ↔ third-party packages: their own process, with only declared egress and secrets
  (ADR-071).
- Daemon ↔ vault: a separate vault process or service; Jaari reads only its dedicated vault or
  collection (ADR-013, ADR-050).
- Panel ↔ owner's browser: bundled code only, untrusted content as plain text, overlay only
  (ADR-067).

## Decisions
See [adr/README.md](adr/README.md).
