# 08 — Egress identity and owner takeover: IP blocking, bot detection, handing off to a human

Studied 2026-11-09: proxy providers and self-hosted alternatives, Cloudflare Web Bot Auth,
hCaptcha's position, anti-detect browser benchmarks, hosted live-view products, and the
takeover protocol in `refs/open-instinct/skills/maritime-computer/SKILL.md`. Reference
tables and sources: [00-research.md §10](../00-research.md). No decision was taken; the
open questions are OQ-32, OQ-33, OQ-34 (and the driver part of OQ-27).

> Since decided: OQ-32 → ADR-053; OQ-33 → ADR-054; OQ-34 → ADR-055; OQ-27 → ADR-048.

## 1. What the sources do

**Where the traffic comes from.** Cloud agents (Muse, Grok Bot, Instinct) browse from
datacenter IPs and fall back on handing the owner the browser when a site objects.
Local-first projects (openinstinct on the owner's Mac, MausBot) browse from the owner's own
connection and report far fewer walls. Self-hosters who need a residential IP away from home
use a Tailscale or WireGuard exit node at home, or a 4G/5G dongle on a Raspberry Pi
(Proxidize publishes an open-source script); carrier CGNAT addresses are shared by thousands
of people, so sites rarely block them. Scrapers buy rotating residential proxies: Decodo is
the most recommended, Oxylabs the premium option with published sourcing documentation,
Bright Data requires KYC, IPRoyal and Webshare are the budget picks, Evomi the cheapest with
mixed reliability reports. Hosted agent browsers (Browserbase, Steel, Hyperbrowser, Kernel,
Browser Use Cloud) bundle proxies, fingerprint rotation, and CAPTCHA solving.

**Identity instead of disguise.** Cloudflare's Web Bot Auth lets an agent sign each request
(RFC 9421, Ed25519, a JWKS at `/.well-known/http-message-signatures-directory`, a
`Signature-Agent` header). Its Signed Agents class is for agents "operating on behalf of…
the end users themselves", distinct from verified-bot crawlers; founding members are
ChatGPT agent, Goose, Browserbase, and Anchor. AWS AgentCore Browser signs and auto-registers
with Cloudflare, HUMAN, and Akamai to "reduce friction with CAPTCHAs on domains that allow
verified bots". Visa and Mastercard are building agent directories for payments. hCaptcha
says "Legitimate agents should clearly identify themselves" and that disguise is "not
behavior that should be normalized". Browser Use ships a reverse CAPTCHA for agent sign-up.

**Disguise.** Anti-detect browsers (Camoufox, Patchright, nodriver, rebrowser) patch
automation markers and fingerprints. Benchmarks disagree with each other and change
monthly; defenders are reported to have caught up with flag patching.

**Handing off to a human.** Every serious product pauses and asks the owner: Grok Bot hands
over for SSO, passkeys, CAPTCHA, and bank-card checks and is told to "pause and notify you
rather than attempting to work around the check"; Skyvern pauses and notifies; Cloudflare
Browser Run and Browserbase expose a Live View; BrowserAct shares the session to a phone.
open-instinct's skill is the most precise: `request_takeover(reason)` returns
`{success, note, screenshot}`, screenshots stop while the owner has the desktop, a
`human_in_control` result means wait, "never type a code the owner texts you into a site",
three failed attempts means stop and tell the owner. Paid solver farms (2Captcha, CapSolver)
are the other kind of human forwarding: anonymous workers solve challenges for the bot.

## 2. Why they do it that way

| Failure prevented | Mechanism |
|---|---|
| Datacenter IP gets challenged or blocked outright | Residential or mobile egress; for a personal agent, the owner's own connection is both the cheapest and the most consistent |
| Login from a strange city trips fraud detection | Keep `browser.*` on the owner's accounts on the owner's identity; rotation helps only anonymous reading |
| Challenge pages escalate as detection layers stack | Pass the earlier layers (IP, profile, consistent fingerprint) so the challenge never fires |
| Arms race with anti-detect patches | Signed identity: the site decides by policy, not by guessing. Cloudflare, AWS, Akamai, HUMAN, Visa, Mastercard are converging on this |
| Agent types a one-time code or password into a page | Takeover: the owner does only that step; the agent never holds the secret (same reason as ADR-007) |
| Agent loops on a wall it cannot pass | Bounded retries, then pause and notify; "do not retry" after a failed takeover |
| Owner cannot see what the agent sees | Live view of the exact session; stopping screenshots during takeover keeps the owner's typing out of the model's context |
| Buying IPs that were never consented | Sourcing documentation and provider vetting; the market's "ethically sourced" label is self-certified |

## 3. What Jaari does, and where it differs

**Confirmed.** ADR-005's pinned local profile is the single biggest anti-blocking measure
and it costs nothing: the owner's residential IP, cookies, and history. Takeover for login,
2FA, and CAPTCHA is already in ADR-005 and `SECURITY_MODEL.md`; open-instinct's protocol is
the shape to copy (with attribution, MIT) when `@jaari/computer` is built. `@jaari/http` as
the single egress path is where a signature or a proxy would attach.

**Where Jaari differs.**
- No disguise. Jaari acts as the owner's delegate from the owner's identity. Driver hygiene
  against automation markers (Patchright-level) is proportionate; anti-detect browsers and
  solver farms are not, and they contradict "model proposes, owner disposes".
- Human forwarding means forwarding to the owner, never to a solver farm.
- Commercial residential proxies, if ever, serve only anonymous `web.fetch` and sit behind
  a provider interface with a documented sourcing check (OQ-32). They are never used for
  `browser.*` on the owner's accounts.
- Signed-agent identity fits a self-hosted agent better than any vendor: the key is the
  owner's, generated at `jaari init`, and the agent says what it is (OQ-33). Whether the
  registries accept individuals is unknown.
- The missing piece in the open-source world is the owner's phone: see the session and act
  within seconds. That is a `@jaari/channel-web` feature over Tailscale plus a takeover
  state machine (OQ-34), not a browser-driver feature.

**Open after this study.** OQ-32 (egress identity off the home network), OQ-33
(signed-agent identity), OQ-34 (takeover transport); the driver part of OQ-27.

**Numbers worth keeping.** Residential proxies: ~$2–6/GB mid-market, $0.49/GB at the
bottom, $5–12/GB inside hosted browsers. DIY 4G proxy: ~$80–130 per modem plus a SIM.
hCaptcha claims a WAF alone misses over 90% of residential-proxy requests. Anti-detect
benchmarks: 66–83% pass rates, changing monthly; not a foundation.
