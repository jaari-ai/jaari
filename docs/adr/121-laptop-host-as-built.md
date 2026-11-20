# ADR-121: The laptop host as built: sleep is a clock gap, OS tools instead of a native helper, and detectors that only emit events

- **Status:** Accepted
- **Extended by:** [ADR-125](125-windows-host.md)
- **Date:** 2026-11-17

Roadmap 0.13 built the Phase 0 part of [ADR-057](057-laptop-host-and-node.md), as split by
[ADR-082](082-phase-split-update-and-catch-up.md). Building it showed that most of the list has
nothing to act on in Phase 0, and that one part needs signed native code that 0.12 has not
decided. This ADR decides what 0.13 ships. It amends ADR-057 and ADR-082.

## Decision
1.  **One module detects, and it only emits events.** `createPowerWatch` in `@jaari/core`
    ticks every 30 seconds. It emits `power.wake`, `power.source`, `power.battery.low`,
    `power.hold.failed`, and `network.change`. The daemon writes each one to the event log.
    What reacts to an event ships with its own feature: catch-up with the job engine (1.4),
    the battery notice with the notification ledger (2.3), reconnects with the first network
    channel (2.8) and the overlay (2.12), the egress re-probe with the `owner-exit` provider (4.4).
2.  **Sleep is the larger of two clock gaps.** ADR-057 compares the monotonic and the wall
    clock. Node's monotonic clock stops during sleep on Linux and may count it on macOS, and
    the wall clock can be set back during sleep. So the gap between two ticks is measured on
    both clocks, and the larger one counts. A gap over `limits.sleepGapMs` (2 minutes) emits
    `power.wake` with the gap. A process that was frozen that long, or a wall clock set forward
    by that much, is reported as a wake too: both need the same reaction.
3.  **No native helper and no logind listener in Phase 0.** ADR-057 names a small macOS helper
    and logind `PrepareForSleep` for a faster response. A helper is native code that must be
    signed (ADR-056; ADR-122 moved that to 7.7), and a logind listener needs a D-Bus client. Phase 0
    has nothing that needs the speed: a wake is seen at most 30 seconds late. Both stay
    allowed by ADR-057 and are added when a feature needs them.
4.  **The power assertion uses the tools of the OS.** macOS: `caffeinate -i -w <daemon pid>`.
    Linux: `systemd-inhibit --what=idle` around `tail --pid=<daemon pid>`. Both end when the
    daemon dies, however it dies. They hold idle sleep only: a closed lid still sleeps the
    machine, under every option. A tool that is missing or refuses emits `power.hold.failed`
    once, and no hold is tried again until the next start.
5.  **"While a job runs" is "while a turn runs" in Phase 0.** There is no job engine yet. The
    daemon holds the assertion from the moment a message reaches the session until its reply
    is ready. The job engine holds its own jobs through the same call (1.4).
6.  **Config: a `power` section.** `stayAwake` is `"working"`, `"never"`, or `"always"`;
    `batteryPausePercent` is 1 to 100, default 20. With no `stayAwake`, a host whose
    `deployment.target` is `laptop` uses `"working"` and every other host `"never"`.
    `jaari init` asks the question only on a laptop. `"working"` holds on mains power or on a
    machine with no battery; `"always"` holds on battery too, as the owner chose.
7.  **The detector runs on every host.** A virtual machine is suspended too, and a host with
    no battery reads none, so nothing depends on the target but the default of point 6.
8.  **The battery pause is a state, and the notice waits.** `backgroundPaused()` is true below
    the threshold on battery. `power.battery.low` is emitted once per battery cycle; a cycle
    ends on mains power. Phase 0 has no background work, so no message goes to the owner: a
    notice that says "paused" about nothing would be noise, and proactive output goes through
    the notification ledger (ADR-033), which is 2.3.
9.  **A network change is a changed set of addresses.** Each tick compares the addresses of
    the interfaces that are not loopback or link-local. Phase 0 has nothing to reconnect or
    re-probe: the CLI socket is local, and the egress resolves each call by itself (ADR-080).
    The first egress whose route depends on where the laptop is, `owner-exit` (4.4), re-probes
    on `power.wake` and `network.change`.

## Alternatives rejected
- **A native macOS helper now:** it needs the signing identity that 0.12 decides, for a
  30-second gain nothing uses yet.
- **The difference of the two clocks (wall minus monotonic):** it is zero on a system whose
  monotonic clock counts sleep, so sleep would never be seen there.
- **A battery notice now:** it would report a pause of work that does not exist.
- **Running the detector only when the target is a laptop:** a wrong `deployment.target`
  would switch sleep detection off silently.
- **Retrying a failed hold on every turn:** a missing tool stays missing, and each try starts
  a process.

## Amendments
- **ADR-125:** on Windows, the stay-awake hold is a PowerShell child that calls `SetThreadExecutionState`, and the battery is read with `Get-CimInstance Win32_Battery`.

## Consequences
- The sleep-aware watchdog of the session (ADR-031) keeps its own wall-clock check; it runs
  only during a turn and needs no event.
- `jaari doctor` should report `power.hold.failed` and what `"always"` does not cover (a
  closed lid) when it ships (0.12). Done: ADR-122.
- The Linux paths (`/sys/class/power_supply`, `systemd-inhibit`) are tested with fakes and a
  temporary folder only; the macOS tools were run on a real machine.
- A laptop with two batteries reports the first one.
