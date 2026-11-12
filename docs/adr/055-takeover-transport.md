# ADR-055: Takeover transport: per-adapter live view behind one panel view, a non-blocking state protocol, codes from chat scrubbed before the model

- **Status:** Accepted
- **Extended by:** [ADR-081](081-secrets-pasted-in-chat.md), [ADR-095](095-missing-capability-names.md)
- **Date:** 2026-11-11

## Decision
**Transport per adapter, one panel view.** Each browser adapter's manifest (ADR-048) declares its
takeover transport, and the panel's takeover view in `@jaari/channel-web` shows whichever applies:
- CDP screencast: any Chromium over CDP, headless included; frames stream to the panel and taps
  and keys go back as CDP input. Default for local, MCP, and remote-CDP adapters.
- noVNC: headful remote-desktop adapters and `computer.use` desktops; proxied by the daemon,
  never exposed directly.
- Provider live view (Browserbase, Steel, and similar): a short-lived signed URL generated per
  takeover, embedded or opened.

An adapter without takeover cannot run owner-account tasks that may need a human step, and its
manifest says so.

**Reaching the owner.** The worker calls `takeover(reason)`; Jaari sends a `link` prompt
(ADR-035) through the active channel ("Login needed on mybank.com: Take over"). The link opens the
takeover view over the overlay (ADR-030) with touch, keyboard, and zoom for phones; it is
single-use and expires in 10 minutes.

**States.** `pending → active → completed | failed | timeout | cancelled`. The request does not
block; the worker waits on the status for up to 10 minutes, then the state is `timeout`, the
owner gets one notice, and the task pauses (it is not dropped). The owner ends a takeover with
Done or Failed (optional note); Failed means the agent does not retry and reports back. Hold rules
stay as in ADR-016: drain, refuse new agent input, release 2 minutes after the last view closes or
after 5 idle minutes.

**While the owner holds.** No screenshots or snapshots for the model and no logging of the
stream; after Done the worker takes one fresh snapshot. What the owner types never reaches the
model or the logs.

**Codes the owner sends in chat.** A code is best given through the masked `input` prompt
(ADR-035), which goes straight to the executor. A code pasted as an ordinary chat message is also
accepted: while a code request is pending for a task, the daemon matches a code-shaped token in
the owner's next message deterministically, hands it to the executor, and replaces it in the
transcript with "[code used]" before any model sees the message. On channels whose manifest
supports deleting messages, Jaari also deletes the owner's message; otherwise it notes that the
code remains in that app's history. Codes are never logged.

**Safety.** Every takeover targets the task's own profile and tab. After 3 failed takeovers on the
same step, Jaari stops and tells the owner.

**Phase 6**, with the browser adapters.

Borrowed: the takeover state protocol, Done and Failed, and "failed means do not retry" from
open-instinct `computer/src/desktopd.ts` and `skills/maritime-computer/SKILL.md`; own-profile
targeting from openinstinct `browser/enforce.ts` (behaviour only).

## Alternatives rejected
One transport for every adapter (providers and desktops differ); a blocking takeover call; an
unbounded wait; dropping the task at timeout; refusing codes pasted in chat (friction when the
owner is in a hurry); letting the model read a pasted code.

## Amendments
- **ADR-081:** codes pasted in chat are one case of the general ingress scrub; "[code used]" is
  kept for a pending code request.
- **ADR-095:** a takeover is requested with the capability `takeover.request`.

## Consequences
_TODO: fill in as implementation reveals them._
