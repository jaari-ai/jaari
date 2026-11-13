# ADR-087: Safety pieces ship in the phase of the first thing they protect

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
The agent loop (Phase 0), the job engine and canonicalize (Phase 1), and curiosity (Phase 2)
ran before pause, runaway limits, budgets, the event and usage logs, the pre-write secret scan,
and snapshots, which were Phase 3 or had no phase (ADR-027, ADR-028, ADR-031, ADR-032,
ADR-046). The deny-all gate stub blocks every gated effect before Phase 3 (ADR-018), so the
risks are spend, message volume, unscanned derived facts, and no copy of memory (OQ-71). This
ADR changes when the pieces ship, not what they do.

## Decision
| Piece | Phase | Ships with |
|---|---|---|
| Pause and emergency stop (ADR-031) | 0 | The agent loop; job-tree abort with the job engine (1), child abort with children (4) |
| Steps per turn, stall guard, sleep-aware watchdog (ADR-031) | 0 | The agent loop |
| Event log (ADR-032) | 0 | `@jaari/core` (ADR-086) |
| Usage log (ADR-032, ADR-011) | 0 | `@jaari/llm` |
| Monthly budget with the 100% prompt; spike alerts (ADR-046, ADR-031) | 1 | The first background jobs; the prompt uses the Phase 0 typed prompts |
| 50% and 80% budget warnings (ADR-046) | 2 | The digest |
| Pre-write secret scan of derived facts and files (ADR-028) | 1 | The memory write path; the ADR-081 rules |
| Nightly local snapshot of memory, SQLite, and config, last 7 kept, mode 0700 (ADR-027) | 1 | The memory repository; the ADR-082 mechanism |
| Memory push to remotes, encrypted bundles, monthly drill (ADR-027, ADR-028) | 3 | Unchanged; until then memory never leaves the host |
| Child limits (ADR-031) | 4 | Children |
| Loop breaker for other bots (ADR-031) | 2 | Telegram, the first channel with other bots |
| Lowering a permission stops the turn (ADR-031) | 3 | The real gate |
| Repeated-failure rule; 7-day quiet rule (ADR-031) | 2 | The persona monitor and proactive messages |

**Left over.** Until Phase 3 the local snapshots are on the same disk as the data: they protect
against bad writes, not against disk loss.

## Alternatives rejected
All safety pieces in Phase 3 (Phases 0 to 2 run loops and background jobs without them); all in
Phase 0 (several protect parts that do not exist yet).

## Consequences
_TODO: fill in as implementation reveals them._
