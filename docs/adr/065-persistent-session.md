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
_TODO: fill in as implementation reveals them._
