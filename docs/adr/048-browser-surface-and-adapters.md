# ADR-048: Browser surface: one neutral tool surface, pluggable browser adapters, any egress route, native toolsets mapped in Phase 6

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**One neutral surface, owned by Jaari** (`@jaari/computer`), shaped like the vendor action sets:
- `browser.*`: `navigate`, `snapshot` (accessibility tree with refs), `click` (ref or x,y),
  `type`, `key`, `scroll`, `select`, `wait`, `tabs`, `screenshot`, `back`, `upload` (files from
  the ADR-038 store), `takeover`.
- `computer.*`: `screenshot`, `zoom`, mouse actions, `key`, `type`, `scroll`, `wait`.
- Capabilities (ADR-018): snapshot, screenshot, and navigate are `browser.read`; click, type,
  key, scroll, and select are `browser.act`; an action the classifier flags (OQ-30) and every
  upload are `browser.submit`.
- No `javascript_exec` or `browser_run_code_unsafe` member; console and network reading are off
  by default.

**Every call goes through Jaari's loop.** Tools reach `@jaari/gate` through Pi's
`beforeToolCall`, with tool execution set to sequential. On the first failure or hold in a batch,
the remaining calls are answered "not executed: an earlier action in this turn failed".

**Pluggable browser adapters.** A `BrowserAdapter` contract, with a manifest like a channel's
(ADR-035), declares headful or headless, takeover (live view), persistent profile, fingerprint
spoofing, and supported exit routes. Every adapter runs the same surface, so automation, the gate,
and takeover behave the same whichever is used. Kinds:
- Remote-desktop headful: Chromium on the host's virtual desktop or an owner node, with a VNC or
  noVNC takeover view (ADR-005).
- Headless, local or remote, through MCP (Playwright MCP).
- Third-party providers over remote CDP (Browserbase, Steel, Kernel, Browser Use).
- Custom adapters written by the owner or the community, including anti-detect adapters that
  spoof fingerprints (for example Camoufox, Patchright, nodriver).

Adapters run as separate processes, so AGPL- or MPL-licensed browsers stay outside Jaari packages
(ADR-014). Jaari core ships automation-marker hygiene only (`navigator.webdriver`, CDP
`Runtime.enable` leaks, a real user agent); fingerprint spoofing exists only in an adapter the
owner installs and enables, and its manifest flags it. Before a spoofing adapter is used with a
profile signed in to the owner's accounts, `jaari doctor` and the panel warn once that a
mismatched fingerprint can get the account flagged.

**Any egress route, under the placement rule.** Each adapter or profile picks its route from the
egress pool (ADR-017, ADR-030): `owner-exit` (the owner's desktop or home box), `vpn`,
`residential-proxy`, `mobile`, or `direct` (the datacenter IP). Owner-account sessions stay pinned
to one owner exit or run on owner hardware; anonymous work may rotate. A third-party provider uses
its own exit or a proxy passed through where it supports one, and is for anonymous work unless the
owner pins it.

**Native vendor toolsets in Phase 6.** Anthropic's browser and computer toolsets and Gemini's
`computer_use` are planned for Phase 6 as an `@jaari/llm` mapping (pi-ai has no toolset support).
The native tool may be declared to the model, but each returned call is translated into the
neutral member and run by Jaari's adapter, never by the SDK's driver, so the gate sees every
action. Gemini's `require_confirmation` is an extra signal to treat the action as
`browser.submit`, never a substitute for the gate. Enabled per route once the Phase 6 fixtures
show a gain.

**Cost.** The accessibility snapshot first; screenshots when needed; keep the last 3 and prune
every 25 turns; 1280×720 by default, 1080p for small text. Whether snapshots and screenshots count
as untrusted content under the reader rule is OQ-31.

Borrowed: the member set and the "not executed" rule from the Anthropic toolsets (learning/07);
the action enum from open-instinct `computer/src/schema.ts`; adapter manifests from Jaari's
channel contract.

## Alternatives rejected
Vendor-native toolsets as the only surface (model lock-in; the SDK's driver would act outside the
gate); one built-in browser (no choice of host, provider, or anti-detect); fingerprint spoofing in
core (it belongs to an owner choice, and it can get owner accounts flagged); a JavaScript
execution member.

## Consequences
_TODO: fill in as implementation reveals them._
