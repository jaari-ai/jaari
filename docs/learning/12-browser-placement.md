# 12: Browser placement and owner accounts in the references

Written 2026-11-13 for OQ-82 (decided in ADR-098).

## 1. What do the sources do?
- **OpenMausBot** (`b802268`): one engine, `agent-browser`, driving a real Chrome over CDP on
  desktops and servers; Steel, browser-use, Stagehand, Playwright MCP, browserless, and
  Lightpanda were compared and not bundled; hosted browsers only as a user-added MCP server
  (`docs/plans/browser-engine.md`). Each bot has its own Chrome profile; the person's own profile
  is never touched (`docs/browser-packaging.md`); teams get one profile per person and room
  (`docs/team-cloud.md`). On a cloud server every browser leaves through a per-session SOCKS
  gate; while the owner lends a computer, only sites that turn away data centres (Google sign-in
  and search, YouTube, Instagram) travel over a WebSocket link to it, which resolves and checks
  addresses itself; every other site loads from the cloud; Reddit is refused from cloud browsers
  (`docs/cloud-pro.md`, "The internet connection"; `electron/device-egress.mjs`). Log-ins happen
  in a live view.
- **open-instinct** (`2e5e71b`): the agent's own persistent Linux desktop with Chromium on a
  hosted microVM (Maritime), keeping cookies there at a data-centre address; `request_takeover`
  at any log-in, 2FA code, CAPTCHA, payment form, or signature; the agent never types passwords,
  codes, or card numbers (`packages/computer/README.md`, `skills/maritime-computer/SKILL.md`).
- **openinstinct** (`213120c`): a dedicated persistent Chrome profile with a CDP port on the Mac;
  the owner signs in once in it; the tool is pinned to it and never touches the personal Chrome
  (`docs/runbook.md`, "Gajae's own Chrome profile").
- **gajae-way** and **pi**: no browser of their own.

## 2. Why?
A home connection far from the server is slow, so routing every signed-in site through it costs
seconds per page; only a few sites refuse data-centre addresses outright. A human at the log-in
step avoids CAPTCHA walls and keeps credentials out of the agent's hands. A dedicated profile
keeps the agent's sessions apart from the owner's.

## 3. What did Jaari do, and where does it differ?
ADR-098: owner-account browsers may run on any host with direct egress, including an enabled
third-party provider; only the `homeSites` list (ADR-053, with a shipped default of data-centre-
hostile sites) goes through the owner exit. Unlike OpenMausBot, Jaari integrates third-party
providers as adapters (ADR-048) and does not refuse Reddit outright: it is a default home site.
Like open-instinct, log-ins on a third-party provider go through takeover, and Jaari never fills
vault credentials there.
