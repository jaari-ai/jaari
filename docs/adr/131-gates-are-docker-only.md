# ADR-131: Phase gates check Docker only; host-specific work lives in HOSTS.md, outside the roadmap phases

- **Status:** Accepted
- **Date:** 2026-11-21

## Context
ADR-128 made Docker Compose the main install and kept bare-metal hosts optional, but it left a host
item in Phase 0 (0.19, Windows, "On request"), and an exit criterion still named Linux, macOS, and
Windows. The Phase 0 gate then waited for a run on a Windows machine. The owner said on 2026-11-21
that no gate depends on anything but Docker, and that host-specific work goes in a separate checklist.

## Decision
1.  **An exit criterion names only checks against the image under Docker Compose:** CI on every pull
    request, and the owner's local Docker. It never names an operating system or a machine.
2.  **Host-specific work is not a roadmap item.** It lives in [HOSTS.md](../HOSTS.md), as a checklist
    with the steps to run it, per host: what it needs, what was found, and what is left. Item 0.19
    (Windows on bare metal) moves there; its ID is not reused.
3.  **A host check that passes is recorded in HOSTS.md,** with the date and the evidence (ADR-128,
    point 4). It changes no phase status.

## Alternatives rejected
- **Keep host items in the phases as "On request":** they still look like phase work, and a
  criterion that names a host makes the gate wait for a machine.

## Consequences
- Phase 0 exit criterion 21 checks the Compose file under Docker, not per operating system. Runs on
  Windows and other hosts are HOSTS.md checklist items.
- The roadmap status "On request" is no longer used.
- Amends ADR-125 (0.19 leaves the roadmap for HOSTS.md) and ADR-128 (points 4 and 5: host items are
  not in the roadmap, and gates are Docker only).
