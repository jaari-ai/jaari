# ADR-091: Subscription CLI runs are "engine runs", approved per workspace, with the child time limit

- **Status:** Accepted
- **Date:** 2026-11-12

## Context
ADR-077 runs coding CLIs as children "inside the sealed sandbox" with changes that "need no
approval", but ADR-036 calls a run sealed only with no network and no secrets, and these runs
have network to the provider and the CLI's sign-in. They also send the workspace copy to the
provider, and ADR-036 always asks when owner files meet outside network. ADR-036 limits a run to
5 minutes; children get 30 (ADR-031) (OQ-76).

## Decision
**Name.** These are engine runs, not sealed runs. "Sealed" keeps ADR-036's meaning.

**Box.** The sandbox and a workspace copy; the CLI's sign-in mounted read-only for the run;
network only to the provider hosts in the engine package's manifest `egress` (ADR-084); the
CLI's web access off by default; results only as files or a diff, applied by Jaari's own gated
capabilities (ADR-077).

**Approval** (ADR-036's two options, because the workspace leaves the host):
- On owner files: the first engine run on a workspace asks Allow once or Always allow, a 90-day
  grant keyed on engine id and workspace path. The card says the workspace contents are sent to
  the provider.
- On a scratch workspace with no owner files: no prompt once the owner has enabled the engine;
  enabling it approves that provider egress.
- With the CLI's web access on, the run is `outside` (ADR-075): always Allow once, no grants.

**Grant key.** ADR-072's closed list gains `engine.run`, keyed on engine id and workspace path.

**Limits.** The child time limit, 30 minutes (ADR-031); CPU, memory, disk, and process limits at
the sandbox defaults, configurable per engine; runs and time counted per engine with routine caps
(ADR-077).

## Alternatives rejected
Keeping the word "sealed" (it would stop meaning "nothing can leave"); Allow once for every run
(tiring for delegated work); no approval at all (the owner's code leaves the host unasked).

## Consequences
_TODO: fill in as implementation reveals them._
