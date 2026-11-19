# 16: pi-agent-core as the agent loop

Written 2026-11-16, while building roadmap 0.5 (`@jaari/core`). Source: the `Agent` class, the loop,
and the durable harness's compaction, read to build ADR-065 and ADR-031.

| Ref | Pinned commit |
|---|---|
| `refs/pi` | `469d8651b59069d7bd907c7da84597865e114da6` (pi-agent-core 1.5.0), when written |
| `refs/pi` | `1e34c3b4c7df78e716a8f53ad0bcf3a00feceedc` (pi-agent-core 1.5.2), checked again 2026-11-19 |

The installed pi-agent-core is 1.5.2 (2026-11-19, Dependabot PR #43), as at the pin. At the new pin a
second `prompt()` during a run still throws (`agent.ts:384`), and `finishTurn` and `steeringMode` are
unchanged.
Jaari builds its `Agent` without a `sessionId`, so the Anthropic message threads added in 1.5.1 stay
off (learning/15).

## 1. What pi-agent-core does
- `Agent` holds the state (model, tools, messages) and runs one prompt at a time; a second
  `prompt()` during a run throws (`refs/pi/packages/agent/src/agent.ts`).
- The loop (`agent-loop.ts`, `runLoop`) repeats: send the context, stream the answer, run the tool
  calls, append the results. Pi calls one such round a turn. An `error` or `aborted` answer always
  ends the run.
- `finishTurn` runs after each round and may return `{ action: "end" }`; `beforeToolCall` may block a
  call; `prepareRequest` may replace the context before each request.
- `steer()` queues a message that joins the run after the current round. A run that ends by
  `finishTurn`, an error, or an abort leaves the queue as it is.
- The model call is a `streamFn` the host passes in, so the loop does not know providers or keys.
- The leading system message is built from `systemPrompt` and the tool list; a tool change is
  announced to the model with a later system message.
- pi-ai adds an empty result for a tool call that has none (`ai/src/api/transform-messages.ts`), so a
  transcript cut by a crash is still accepted by providers.
- The durable harness picks a compaction cut by walking back until the kept tokens are reached,
  then cutting at a user or assistant entry, never between a call and its result
  (`durable/src/harness/compaction.ts`, `selectCut`).

## 2. Why
Hooks instead of a fixed policy let each host set its own limits without a fork. Steering at a round
boundary keeps a tool call and its result together. A stream function from the host keeps keys and
network clients out of the loop.

## 3. What Jaari did, and where it differs
- `@jaari/core` uses `Agent` as it is and adds its limits through `finishTurn` (steps per turn, the
  stall guard) and `abort()` (emergency stop, the watchdog). Pi has no step limit of its own.
- `@jaari/llm` supplies the `streamFn`, so the key still comes from a `secretRef` just before the
  call and every call reaches the usage log (ADR-114).
- Jaari reads the steering queue after a cut run, so the owner's message is held or run next and
  never lost.
- Jaari stores the transcript in its own SQLite table and does not use `pi-durable` (ADR-065). Only
  the cut rule is borrowed, as a design; the code is Jaari's. It cuts at an owner or a model message,
  never at a tool result, so one long turn with a single owner message can still be compacted.
- Jaari sends its own client identity (`jaari`, no attribution headers).
