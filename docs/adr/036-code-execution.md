# ADR-036: Code execution: sealed runs never ask, allow once or for 90 days, pinned recurring jobs

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Backend.** The Phase 4 sandbox of ADR-034: a Docker or Podman container by default, bubblewrap
on Linux without a container runtime. Firecracker is an optional stronger backend on Linux hosts
with KVM, in Phase 7. Code execution for the main session and children ships in Phase 4.

**Sealed runs never ask.** A run with no network and no secrets is sealed: it gets a scratch
workspace, and the owner's files only read-only and only when the task names them. Nothing it
does can leave the box, so it runs without approval (calculations, documents, charts,
conversions). Web work is split: pages are fetched with `web.fetch` (read class, through the
egress gate and the `reader` role), then processed in a sealed run.

**Everything else asks with two options** (rendered per channel, ADR-035):
- **Allow once:** a normal digest-bound approval of this run.
- **Always allow:** a standing grant for one target (a host the code may reach, a folder it may
  write), 90 days by default and configurable, keyed on the target, not the code. Grants are
  listed and revoked with `jaari grants` and the panel; each use is an audit row naming the
  grant; Jaari reminds once before expiry.
- Commands on the host outside the sandbox are always Allow once.
- A run with both the owner's files mounted and network to a host outside the starter list
  always asks, even when each part has a grant (the one path for data to leave).

**Starter list.** `jaari init` suggests a network allowlist the owner turns on or off per entry
(PyPI, npm, and their mirrors suggested on; GitHub raw and release downloads suggested off),
editable later in config or the panel. Hosts on it need no approval.

**Recurring jobs are approved at creation.** A recurring command or script (ADR-025), written by
the owner or proposed by Jaari (for example an hourly health check of an owner URL), is approved
once on a prompt that shows the script, where it runs (sandbox or host), its `secretRef`s, its
hosts, and its schedule. The approval binds to a digest of all of these. Every scheduled run then
proceeds without asking, with no expiry, until the owner edits, pauses, or deletes it. Any change
to the script file, secrets, hosts, or placement holds the job until the owner re-approves the
difference. Host jobs are allowed this way and show an "unsandboxed" warning at creation. Jaari
cannot approve its own job. Pinning covers the registered files only; code a script downloads
is not pinned, and a host job's prompt says so.

**Every run.** The ADR-016 re-check at dispatch (pause, revoked secret, lowered permission);
only declared secrets injected, output scrubbed of their values, and provider keys never inside
the sandbox (an API call uses a short-lived broker token through the proxy); output that came
from the web goes through the `reader` role; failures follow ADR-031; every run is audited.

**Limits** (configurable): 1 CPU, 1 GB RAM, 5 minutes, 1 GB disk, 256 processes per run; a run
that hits one stops and says which. Workspaces are deleted 24 hours after the session goes idle.

**Sandbox self-check.** At boot Jaari verifies that the sandbox has no network, a read-only root,
no home directory, and working limits; a failure disables code execution and shows in
`jaari doctor`. CI mutation tests remove one protection at a time to prove the check catches it.

Borrowed: the self-check, mutation tests, and broker tokens from OpenMausBot (learning/09);
allow once or always from common chat assistants; grants and their limits feed OQ-51.

## Alternatives rejected
Approving every run (owners would approve calculations blindly); no approval for networked runs
(code could send mounted files anywhere); standing grants keyed on code (code differs every run,
so they would never match); grants without expiry for one-off targets; Always allow for host
commands; code execution only in Phase 7 (the sandbox exists in Phase 4).

## Consequences
_TODO: fill in as implementation reveals them._
