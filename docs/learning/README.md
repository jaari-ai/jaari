# Learning log

One file per topic studied, named `NN-topic.md`, written at the end of the conversation
that covered it. Each file answers three questions:

1. What does the source project (open-instinct / openinstinct / gajae-way / OpenMausBot / Instinct / Pally / Muse) do?
2. Why does it do it that way (what failure is it preventing)?
3. What did Jaari do, and where does it differ?

Written:
- [07-computer.md](07-computer.md) — cloud computers vs local drivers, credential fill,
  egress gatekeepers, the vendor toolsets (2026-11-09)
- [08-egress-identity-and-takeover.md](08-egress-identity-and-takeover.md) — IP reputation,
  proxies vs the owner's own connection, signed agents, owner takeover (2026-11-09)
- [09-openmausbot.md](09-openmausbot.md) — OpenMausBot's features and architecture, what
  Jaari borrows (ADR-016), what it rejects (2026-11-10)
- [10-open-questions-review.md](10-open-questions-review.md) — a recommendation per open
  question, borrowed from open-instinct, openinstinct, gajae-way, Pi, and OpenMausBot (2026-11-10)
- [11-pally.md](11-pally.md) — Pally, a second commercial reference: cloud plus a Mac companion
  app, what Jaari borrows, and alternatives to the note-10 recommendations (2026-11-10)
- [12-browser-placement.md](12-browser-placement.md) — where the references run signed-in
  browsers, which traffic uses the owner's connection, and log-in handling (2026-11-13)
- [13-prompt-injection-and-system-prompts.md](13-prompt-injection-and-system-prompts.md) — how
  the references and the commercial agents build system prompts and resist prompt injection;
  the gaps that ADR-104 closes (2026-11-14)

Planned (optional, not scheduled; ADRs have since decided these topics):
- 01-session.md — persistent session, steering, segments, compaction
- 02-ingress-and-channels.md — OwnerTurnIngress, ChannelAdapter, identity binding, cursors
- 03-memory.md — axes, capture, canonicalize, audit, closure ladder
- 04-persona-and-profile.md — PERSONA.md, owner profile curation, gap queue
- 05-gate-and-policy.md — digests, approvals, tiers, grants
- 06-children-and-monitors.md — receipts, propagation state machine, curiosity budgets
