# ADR-057: Laptop as host and node: sleep detection and capped catch-up, power and battery rules, a published macOS permission matrix

- **Status:** Accepted
- **Extended by:** [ADR-082](082-phase-split-update-and-catch-up.md)
- **Date:** 2026-11-11

## Decision
**Laptop as the daemon host.**
- Sleep detection: a 30-second tick compares the monotonic and wall clocks; a gap over 2 minutes
  means the machine slept. OS events are used where available for a faster response (a small
  macOS helper for power notifications, Linux logind `PrepareForSleep`).
- Catch-up on wake: each scheduled job missed during sleep runs once (never once per missed
  slot), at most 5 on wake, oldest first; the rest wait for their next slot. A job whose window
  has passed is skipped with one digest note (a missed 8:00 morning brief still runs at 11:00 the
  same day, not the next day). Reminders due during sleep are delivered marked late. Approvals
  that expired during sleep are asked again if still relevant, never dropped or executed silently.
- Staying awake (owner's choice at init): by default, while a job runs and the laptop is on mains
  power, Jaari holds a power assertion until the job ends or hits its limits (ADR-031). Other
  options: never, or always.
- Battery: below 20% on battery (configurable), background work (curiosity, canonicalize,
  local-model jobs) pauses; the main session and reminders continue; one notice per battery cycle.
- Network changes: on change or wake, channels and the overlay reconnect and egress is re-probed
  (ADR-053). Owner-account browser sessions away from home go through the owner's home exit by
  default when one exists; the owner may choose the local network instead.

**Laptop as a node** (the daemon runs elsewhere, ADR-015). A task that needs a sleeping node waits
with its expiry, and Jaari says once "waiting for your MacBook to wake". Gated actions are never
re-routed to another host without the owner's approval.

**Install rules on macOS.** Never under Documents, Desktop, or Downloads; signed with a stable
identity so permission grants survive updates (ADR-056).

**macOS permission matrix**, published per capability manifest:

| Capability | macOS permission |
|---|---|
| `browser.*` with Jaari's own Chromium | none |
| Controlling the owner's Safari or Chrome | Automation |
| `computer.use` | Accessibility and Screen Recording |
| `files.read` outside the drop folder | the folder's privacy permission, or Full Disk Access |
| iMessage channel (`chat.db`) | Full Disk Access; Automation (Messages) to send |
| Voice, live calls (later) | Microphone |
| Notifications | Notifications |

`jaari doctor` and the panel show granted and missing permissions per capability with a button to
the right Settings pane; permissions are re-probed every 5 seconds while it is open, and the
capability attaches or detaches without a restart. Linux covers the Wayland screen-capture portal;
Windows comes later.

**Phasing.** Sleep, wake, catch-up, power, and battery in Phase 0; the permission matrix with the
desktop capability in Phase 6.

Borrowed: 5-second permission re-probes and attach without restart from openinstinct
`bootstrap/probes.ts`; stable binary identity and install location rules from openinstinct
`install/plist.ts` (behaviour only); the gajae-way runbook (docs only).

## Alternatives rejected
Replaying every missed slot after sleep; dropping missed jobs silently; keeping the laptop awake
on battery by default; re-routing gated node actions to another host automatically; discovering
permissions only when a capability fails.

## Amendments
- **ADR-082:** catch-up of missed jobs ships with the job engine (Phase 1), asking again for
  expired approvals with the real gate (Phase 3); the rest of the Phase 0 list is unchanged.

## Consequences
_TODO: fill in as implementation reveals them._
