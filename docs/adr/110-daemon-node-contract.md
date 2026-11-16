# ADR-110: The daemon–node contract is JSON data messages checked on receipt, with one final result per action

- **Status:** Accepted
- **Date:** 2026-11-16

## Context
ADR-015 has Phase 0 define the daemon–node contract and run every capability through it
in-process, "so executors never assume they are local". It gives the content (approved actions
only, secrets resolved by the daemon for one action, results streamed back) but not the shape.
ADR-058 adds re-advertising on reconnect and the "outcome unknown" state.

## Decision
- **Data messages.** The contract is JSON data with a TypeBox schema per message, in
  `@jaari/capabilities` (`contract.ts`): `DispatchRequest` (`actionId`, `packageId`, the action,
  and the `secrets` resolved for it), `Result`, and `Advertisement`. Every message is copied
  through `JSON.stringify` and `JSON.parse`, the way the node link will carry it, and checked
  against its schema on receipt. In-process code therefore sees exactly what a node would: no
  functions, no shared objects, and dates as strings. Objects are closed, as in ADR-108.
- **The action** is `{ capability, target, params, expiresAt }` (SECURITY_MODEL.md). `packageId`
  picks the executor when two packages provide one name with different providers (ADR-018).
- **One final result per action:** `ok` (with optional `output`), `failed`, or
  `outcome-unknown`. The daemon can cancel with an `AbortSignal`. Before an executor starts, every
  refusal is `failed`. After it starts, a throw or an invalid result is `failed` for a read-class
  capability and `outcome-unknown` for any other, because the effect may have happened; an
  `outcome-unknown` action is never sent again (ADR-016).
- **Executor.** A `capability` package exports `executor` with `execute({ action, secrets,
  signal })`, which returns a `Result`.
- **In-process host.** `createInProcessHost(hostId, packages)` takes the loader's packages,
  serves the `capability` packages whose `hosts` include `daemon`, and refuses to build when one
  does not export `executor.execute`. It refuses a request that fails its schema, names an unknown
  package, asks for a capability the package does not provide, has expired, or was aborted.
  An `expiresAt` that `Date.parse` cannot read (a leap second, a `[UTC]` suffix) counts as
  expired. `advertise()` returns a checked copy each time, like every other message.

## Deferred
- The digest the executor recomputes (SECURITY_MODEL.md step 4) joins with the real gate (3.1).
- `amount` joins with spend checks; `pay` is reserved (ADR-040).
- Status queries, the node outbox, re-advertising on reconnect, and granted OS permissions in the
  advertisement ship with the node link (Phase 6, ADR-058).
- Streamed progress and screenshots ship with computer use (Phase 6) as an optional event channel
  next to the final result.
- Results are not yet scrubbed of secret values; exact-value scrubbing ships with
  `@jaari/secrets` (0.11, ADR-016).

## Alternatives rejected
- **A plain TypeScript interface:** simpler now, but nothing stops local-only shortcuts such as
  passing functions or shared objects, and Phase 6 would have to rework it.
- **An event stream from day one:** nothing in Phase 0 sends events.
- **Contract types only, with no host:** nothing would use the types until the gate stub (0.10).

## Consequences
- The JSON copy costs a little on every in-process call; actions are small and few.
