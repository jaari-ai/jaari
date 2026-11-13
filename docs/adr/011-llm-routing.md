# ADR-011: LLM routing: owner policy, role-based tiers, request-only escalation

- **Status:** Accepted
- **Extended by:** [ADR-019](019-model-pinning-and-local-only-defaults.md), [ADR-037](037-voice.md), [ADR-077](077-subscription-cli-engines.md), [ADR-085](085-refusal-in-the-pinned-main-session.md)
- **Date:** 2026-11-05

## Decision
`@jaari/llm` groups models into small/medium/large tiers with fallback chains; each role (main, child, canonicalize, curiosity, classify, summarize, title, reader, vision) maps to a tier. Code escalates on measurable signals; children may request escalation via a policy-checked tool; the main session is pinned to one model. Owner policy sets budgets and local-only roles. Models qualify for tiers via `jaari llm eval`. A provider refusal (`stop_reason: refusal` with its category) is an escalation signal like any other: code moves to the next model in the chain, except for categories that mean the task itself is off limits (impersonation, CAPTCHA solving), which end the attempt and go to the owner as a takeover or a plain report, never to another model.

## Alternatives rejected
Model self-selects per message (unauditable); trained router in v1 (trained on chat, not agentic tool use); one model for everything (expensive or weak); per-turn switching of the main session (cache loss, persona drift).

## Amendments
- **ADR-019:** "Pinned" allows outage failover at a turn boundary with one notice; local-only defaults for canonicalize and curiosity are decided at `jaari init` by `jaari llm eval`.
- **ADR-037:** adds the `stt` and `tts` roles, routed like the other roles.
- **ADR-077:** children may run on a subscription CLI engine, accounted in runs and time per engine, not in dollars.
- **ADR-085 (resolves OQ-86):** the refusal rule ("next model in the chain") applies to roles
  that are not pinned; in the main session a refusal ends the turn with one notice and the owner
  decides; refusals are detected from the provider's raw stop reason.

## Consequences
_TODO: fill in as implementation reveals them._
