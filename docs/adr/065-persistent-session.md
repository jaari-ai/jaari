# ADR-065: Persistent session: one daemon-owned main session on pi-agent-core, one serial queue, Pi's compaction thresholds, no server-side state for the main session

- **Status:** Accepted
- **Extended by:** [ADR-081](081-secrets-pasted-in-chat.md)
- **Date:** 2026-11-11

## Decision
**One main session per owner, persistent.** The daemon stores the transcript in SQLite (backed up,
ADR-027). After a restart, host move (ADR-058), or upgrade (ADR-056) the session reopens over its
transcript; a fresh session never starts silently.

**Engine.** `@jaari/core` builds on `pi-agent-core` with Jaari's own durable queue (ADR-025), the
`pi-durable` contract copied in shape; revisited when `pi-durable` leaves Experimental.

**One serial queue.** Turns, reloads, and compactions run in one queue; compaction runs only after
a turn has settled.

**Steering.** An owner message during a turn is added at the next step boundary (Pi steering).
"Stop", "wait", and "pause" are handled by code at once (ADR-031), never queued behind the model.

**Compaction** is daemon-managed with Pi's absolute thresholds: 16,384 tokens reserved and the most
recent 20,000 tokens kept verbatim. Facts are already captured to memory (ADR-023); open approvals,
commitments, pending tasks, and active routines are re-injected by code from state, not from the
summary. The summary prompt is a versioned built-in (ADR-042) covered by fixtures (ADR-041).

**Orientation.** After a start, reload, or compaction the first turn gets an orientation block of
about 6,000 characters: the tail of the map, then today's log, or yesterday's if today has none
(ADR-024).

**Rolling to a new segment** only after two context failures and a failed compaction. The old
segment stays archived and searchable; the roll is logged and the owner is told once.

**Prompt cache.** The Stable layer comes first and is fingerprinted (ADR-042). The tool list is kept
byte-identical across turns, pinned by a test, only on models that cannot change tools
mid-conversation; on models that can, a newly enabled capability applies at once. Keep-warm pings
are off by default and, when the owner enables them, run only when the estimated saving exceeds
their cost.

**No server-side state for the main session in v1.** Provider compaction, server threads, and
stored responses are not used for the main session, so provider failover (ADR-019), host moves
(ADR-058), and forget and erase (ADR-029) keep working. They may be enabled per provider for
children later, once fixtures show a gain.

**Client identity.** Jaari sends its own client identity, not Pi's default.

**Transcript retention.** Everything is kept by default and searchable; forget and erase apply to
the transcript (ADR-029). The owner may turn on pruning of raw segments older than a chosen number
of months down to their summaries.

Borrowed: session, steering, and compaction from Pi (`durable/src/harness/agent.ts`,
`DEFAULT_COMPACTION_POLICY`); the serial queue and orientation block from openinstinct `main.ts`
(behaviour only); the stable prefix and keep-warm cost guard from OpenMausBot (learning/09).

## Alternatives rejected
A fresh session per restart; compaction at 50% of the window; a byte-identical tool list on every
model; provider-held conversation state for the main session; `pi-durable` while it is
Experimental; pruning old transcripts by default.

## Amendments
- **ADR-081:** the transcript stores the owner's message after the ingress secret scrub.

## Consequences
Built in `@jaari/core` (roadmap 0.5, 2026-11-16):
- Pi's "turn" is one model response with its tool calls. Jaari calls that a step, and calls the
  whole answer to one owner message a turn. Pi's `finishTurn` hook runs after every step.
- The transcript table keeps every user, assistant, and tool-result message. System messages are
  not stored: Pi rebuilds the leading one from the prompt and the tool list at each start.
- A compaction is one state row (the summary, the first kept message, the last message at that
  time); the context is the summary plus the kept messages. The summary comes from the `summarize`
  role, so the session refuses to start without a model for it.
- A model whose context window is not above the 16,384 reserved tokens is refused at start. On a
  small window the kept part is at most half of what the window leaves after the reserve.
- Token counts are the provider's last reported total plus 4 characters per token for later
  messages. A failed compaction is logged and tried again after the next turn. After a context
  failure the provider's word wins over the estimate, so the next compaction runs anyway.
- The cut lands on an owner or a model message, never on a tool result. An empty summary counts as
  a failed compaction. Pause and emergency stop abort a compaction in flight, and nothing is applied.
- Compaction is its own job in the serial queue: the reply returns first, and the next turn waits
  for the compaction. One compaction is also queued when the session opens, so a context stored
  under a larger model fits the one configured now.
- Rolling: after two turns in a row that failed on context length (pi-ai's `isContextOverflow`)
  and a compaction that did not apply, the context restarts after the last stored message. The
  transcript keeps the old segment; the event log gets `segment.roll`, and the next reply carries
  a one-time `notice`.
- Not built yet: the orientation block (1.3), re-injection from state (when approvals and tasks
  exist), the versioned summary prompt (2.4), and keep-warm pings. Searching an archived segment
  comes with transcript search.
- Open: OQ-94, what "stop" and "wait" do. Only "pause", "stop everything", "stop now", and
  "resume" are matched, ignoring case, extra spaces, and a trailing `.` or `!`.
