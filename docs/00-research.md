# 00 — Research: Instinct AI, how it works, and open-source equivalents

> Captured 2026-10-28. Reconstruction from public sources; Spear Street has published no
> architecture docs. Treat as "well-supported reconstruction," not an official spec.

## 1. What Instinct is

Instinct is a personal AI agent from Spear Street Technology (San Francisco), founded in
April 2026 by Noah Shinn, a former Sierra research scientist and first author of
*Reflexion* (NeurIPS 2023) — the paper on agents that learn from their own mistakes by
storing summaries of past failures as memory. You reach it by text or phone call, not an
app; as of September 2026 it was invite-only. It raised a $1B Series C at a $10B valuation
on Sept 28, 2026, and investor Sheel Mohnot summed it up as "OpenClaw for normal people."

## 2. How it works — the four layers

| Layer | What's known | Confidence |
|---|---|---|
| **Interface (zero-UI)** | A single continuous thread over iMessage, WhatsApp, SMS and phone calls; no project/workspace structure. Since Sept 2026 it also has its own email address and can phone businesses. | High (observable) |
| **Persistent cloud computer** | Each user gets a persistent machine on Spear Street infra with browser access and cached credentials, so it keeps working between messages. The agent uses vision-language models / computer vision to click, fill forms and navigate anti-bot challenges like a human, which lets it drive sites with no API — at the cost of handing over session tokens, passwords and MFA codes. | High |
| **Model** | One proprietary "core model," no model choice; the company says it's trained for "the personal texture of everyday life" (following up on dropped threads, texting you first). The teardown author guesses the *answering* model is open-weights-based, but can't confirm. | Low — unverified |
| **Authority & data** | ToS appoint Instinct as your legal agent authorized to enter binding agreements; it receives screen captures, cursor movements, keystrokes, email, audio and location. Perpetual, irrevocable, sub-licensable license on your materials incl. for training; opt-out is forward-only. | High (in ToS) |

Investor Anish Acharya's framing — the clearest technical read on record — is: persistent
agents with cloud computers, browser access, cached credentials, recurring loops, and a
top-level agent that dispatches work, with Instinct hiding nearly all the machinery.

## 3. The memory system (reverse-engineered)

The most detailed technical trace is supermemory's teardown, done by probing the agent
over several days:

- **Storage:** git-tracked Markdown files, not a vector DB. Directory taxonomy:
  `entities/people/`, `entities/orgs/`, `knowledge/facts|preferences|decisions/`,
  `comms/phone/` (conversation digests), `timeline/daily|weekly/`,
  `workstreams/active|completed/`.
- **Record format:** YAML-ish header with `id`, `type`, and `aliases`, then a bullet list
  of dated facts with `[[id]]` wiki-links to related records — making the file set
  graph-like.
- **Retrieval:** no vector indexing or BM25 — pure grep/keyword matching, which is why
  every file carries aliases. `pasta` and `takeout` hit the dining record; "Italian
  noodles I enjoy" and `pazta` returned nothing.
- **Context assembly per turn:** conversation context + a ~4,250-token user "profile"
  (life context, autonomy calibration, communication style) + a memory one-pager + a
  ~10k-token compaction recap + a todo board.
- **Tools:** bash-like grep/list/git-inspect tools plus todo-management tools. **Memory is
  read-only for the conversational agent**; writes happen in a background process.
- **Reconciliation ("dreaming"):** a ~daily batch job (one preference took ~23h to land in
  a reported commit) that moves temp details into workstreams, compresses records,
  generalizes examples into traits, scrubs one-time codes, and replaces wrong facts with
  dated corrections. If you text too much in 24h it tells you to come back tomorrow
  because compaction has a token ceiling.
- **Weak spots:** multi-hop recall across sessions, implicit personalization,
  procedural/skill memory, multimodal memory, and automatic forgetting.

This is consistent with the Reflexion lineage — verbal, file-based reflective memory
rather than fine-tuning.

## 4. Known failure modes

Early testers hit CAPTCHAs and 2FA walls (the cloud box has no cookies or residential
IP), a successful prompt injection via email, retained inbox data after disconnect, and an
email sent without approval.

## 5. Closest open-source options

Three projects are explicit Instinct clones; the rest are general-purpose harnesses people
use to rebuild the same "ops shape."

| Project | License | Architecture | Channels | Models | Closest-to-Instinct features |
|---|---|---|---|---|---|
| **open-instinct** (mariagorskikh) | MIT | One Maritime microVM with Linux desktop per person; Pi agent loop; Composio for apps; policy guard before every tool; Stripe Link wallet; 7-tier agent-to-agent trust network | iMessage/SMS/email via Inkbox; outbound phone calls via Inkbox Voice AI | Default Claude; any Pi provider | Most faithful: own computer per user, texting, calls, memory/scheduler/approvals/audit in `packages/core`; v0.1 beta, 837 tests |
| **OpenInstinct** (Merit Systems) | LICENSE file present, type not stated in README | Next.js/TypeScript "Eve" agent; Kernel cloud browsers; Neon Postgres; encrypted vault with autofill that keeps passwords out of model context; workstreams memory; scheduled runs | iMessage via Linq | Any model via Vercel AI Gateway | Cloud browser + iMessage + Gmail/Calendar + Stripe Link purchases; one-click Vercel deploy. Marked "not intended for production" |
| **openinstinct** (Yeachan-Heo) | Not stated | Runs entirely on your Mac: `openinstinctd` daemon reads/sends via Messages.app on a separate Apple ID; dedicated Chrome profile; git-backed memory repo with daily notes rolled up into people/projects/decisions — the closest match to Instinct's memory design | iMessage (your phone → your Mac) | Claude, ChatGPT, API key, or custom endpoint | Background child sessions, scheduled watches, no telemetry/server |
| **OpenClaw** | MIT | Locally run TypeScript/Swift agent; skills system (`SKILL.md` dirs); local config/history for persistence | Signal, Telegram, Discord, WhatsApp; iMessage via community openclaw-sendblue plugin | Claude, DeepSeek, GPT, etc. | The project Instinct was literally compared to; recommended default for "Instinct-like life admin" because of browser and tool breadth |
| **MausBot** | Apache 2.0 | Localhost harness driving `claude`/`codex`/`grok` CLIs; OAuth via Composio with tokens on disk; allow/deny card before every action (as marketed; the code defaults to Full access, see [learning/09](learning/09-openmausbot.md)); optional cloud desktop per bot | Own desktop app + iOS/Android companions — not iMessage/WhatsApp | Claude, Codex, Grok, Cursor, Kimi, Qwen CLIs | Multi-agent/multi-thread, browses from your own IP (avoids Instinct's CAPTCHA problem) |
| **Hermes Agent** | MIT | Self-hosted, self-improving (builds its own skills) | Sendblue webhook/community plugin | BYOK | Best if memory continuity is the priority |
| **OpenOpenInstinct** | — | Self-hosted, local SQLite WAL, WebCrypto P-256 device auth, browser execution | iMessage + web | — | Minimal-infra variant |

## 6. DIY recipe matching Instinct's shape

The commonly cited three-layer build: messaging pipe (Sendblue iMessage/SMS API +
webhooks) → always-on isolated host (any VPS) → agent runtime (OpenClaw, Hermes, or
Claude Code) with Composio/MCP for app connections and your own keys. Suggested rollout:
start with an allowlist of low-risk tasks (inbox triage, calendar holds) before granting
shopping/booking permissions.

## 7. Bottom line

- **Closest overall clone:** `mariagorskikh/open-instinct` — per-user cloud desktop,
  iMessage + voice calls, policy guard, agent network.
- **Closest memory implementation:** `Yeachan-Heo/openinstinct` (git-backed Markdown memory
  rolled up into people/projects/decisions) — nearly the same design the supermemory
  teardown found.
- **Most production-ready foundation:** OpenClaw (large community, MIT), with the Sendblue
  plugin for iMessage.
- **If you want "asks first" instead of Instinct's "acts first":** MausBot's marketing says
  so, but its source defaults to Full access (learning/09); Merit's OpenInstinct (vault-based
  autofill keeps credentials out of the model) is the safer pick.

## 8. Persona/proactivity reference (added 2026-11-04)

Meta's Muse (the "personal superintelligence" assistant) is the reference for Jaari's
persona and proactivity design: one long conversation with persistent memory; nameable
with its own avatar and style; can message you first, but "the bar for sending one has to
be high — genuinely helpful and worth the interruption," with a user-controlled dial;
generates ideas from goals, patterns and what it learned in conversation; notifies only
when something is meaningfully new or needs input; "forget X" on demand. Muse does not
expose a curiosity dial — that is Jaari's addition (see PERSONA.md).

## 9. Computer use landscape (added 2026-11-09)

Every personal-agent product above now ships "computer use". Two shapes exist; both
matter for ADR-005 and ADR-012. The three-question analysis is in
[learning/07-computer.md](learning/07-computer.md); this section is the reference table.

### 9.1 Cloud computer per user

| | Meta Muse (Sep 2026) | xAI Grok Bot (Aug 2026) |
|---|---|---|
| Where it runs | "Muse Secure VM": a persistent, isolated Linux VM with a full browser, one per user | A persistent cloud computer with browser, command line, and filesystem, "assigned to your user account, not an individual Bot"; several Bots share it, one screen each ("separate work surfaces, not separate security boundaries") |
| Egress control | **Sentinel**, a separate agent "kept apart from Muse at the system level": "nothing Muse does reaches the internet unless the Sentinel approves it"; allow / deny / ask | Not documented |
| Credentials | "Secure storage, so Muse can use them without seeing them"; Muse "cannot see passwords a person types into the browser themselves" | Vault → connected 1Password → "Secure Form"; values are "filled into the page without the Bot seeing them"; one-time codes read from connected Gmail/Outlook or the Bot's own address |
| Human in the loop | Watch, take control, stop; allow once / always / deny; audit trail of actions done *and planned* | Live preview; **takeover** for SSO, passkeys, CAPTCHA, bank-card verification; "pause and notify you rather than attempting to work around the check" |
| Payments | Stripe Link one-time cards (Shop Pay, 1Password announced) | Vault card, Secure Form, or Link / X Money |
| Developer API | None | None; extension only by adding MCP servers |
| Model choice | Meta only | xAI only |

ChatGPT agent (Operator + Deep Research, Jul 2025) used the same shape; it was removed in
Aug 2026 and folded into ChatGPT Work.

### 9.2 Local desktop driver

| Product | What it does | Controls |
|---|---|---|
| Grok Computer (xAI, Apr 2026) | "Sees your screen in real time, controls your mouse and keyboard … across any apps" | Thin public detail; Grok Bot's later local mode defaults to **"Ask every time"** per command, with "Always allow" / "Never allow" |
| Muse for Mac (Sep 2026) | "Muse can now drive any app on your Mac" (Messages, Calendar, Notes, files, browser tabs) via macOS Automation and Files permissions | Approval before sensitive actions; no published permission matrix; a local-process token-hijack bug was hotfixed within 12 hours |
| ChatGPT Work desktop mode (Jul 2026, GPT-5.6) | Clicks, types, moves files across apps; one-off or scheduled | Background mode on macOS; foreground takeover on Windows |

### 9.3 Developer primitives

| Vendor | Primitive | Observation | Safety hooks |
|---|---|---|---|
| Anthropic | `computer_toolset_20260801` (17 members, ~4.5k tokens of definitions) and `browser_toolset_20260801` (27 members + opt-in `javascript_exec`, `file_upload`, `read_console`, `read_network`); client-side, GA, no beta header | Browser: accessibility-tree refs preferred, viewport coordinates as fallback, `browser_state` block. Computer: screenshots only | SDK driver classes with `urlPolicy`, `confirm` callback, file policy; batch actions run in order and halt on first failure; prompt-injection classifiers on returned screenshots. Partner drivers: Browser Use, Browserbase Stagehand, Daytona, E2B |
| Google | `computer_use` tool, environments `browser` / `desktop` / `mobile`; Gemini 3.8 Flash recommended | Screenshots; coordinates normalised 0–999 | `safety_decision: require_confirmation` must be answered with `safety_acknowledgement`; injection detection opt-in; Playwright reference loop |
| OpenAI | CUA model inside ChatGPT Work (GPT-5.6) | Screenshots | Product-level approvals; no public API detail found |
| xAI | None public | — | — |
| Open source | UI-TARS (ByteDance, pixels only), OpenCUA (45% OSWorld-Verified), Agent S (Simular), Browser Use, Stagehand, trycua sandboxes | | Self-reported benchmarks |

Two facts that bear on Jaari: `refs/pi` (`pi-ai`, commit in `refs/INDEX.md`) has no toolset
support, and Anthropic's own docs say the `confirm` hook cannot distinguish a purchase or
a sent message from an ordinary `left_click` / `type`.

## 10. IP reputation, bot detection, and owner takeover (added 2026-11-09)

Analysis in [learning/08-egress-identity-and-takeover.md](learning/08-egress-identity-and-takeover.md);
open questions OQ-32 to OQ-34. This section is the reference table.

### 10.1 What blocks an agent

| Layer | Signals | Why cloud agents fail it |
|---|---|---|
| IP reputation | ASN type (datacenter, residential, mobile), abuse history, impossible travel on logins | Muse, Grok Bot, and Instinct run on cloud VMs with datacenter IPs; this is Instinct's documented CAPTCHA and 2FA wall |
| Browser identity | TLS fingerprint, `navigator.webdriver`, CDP markers, canvas and font consistency | Fresh headless profiles. DataDome, Akamai, and HUMAN are reported to have "caught up to flag-patching" |
| Behaviour and challenge | Turnstile, hCaptcha, DataDome; pointer cadence | Turnstile "integrates signals from all previous detection layers into its challenge decision" |

A pinned profile on the owner's home connection (ADR-005) already passes layer 1 with the
owner's own IP, cookies, and history. openinstinct (owner's Mac) and MausBot ("browses from
your own IP") rely on the same fact.

### 10.2 Egress identity options

| Option | Mechanism | Cost | Fit for a single-owner agent |
|---|---|---|---|
| Owner's home IP, self-hosted | Tailscale (Headscale, plain WireGuard) exit node on a Pi or home server; a VPS-hosted browser routes through it | None; bounded by home uplink and Pi CPU | Default for the owner's accounts (pinned, ADR-017). Same IP the owner browses from, so login patterns stay consistent; may also join the anonymous rotation pool |
| Owner's mobile IP, self-hosted | 4G/5G USB dongle on a Pi (Proxidize's open-source `4g-proxy` or manual); carrier CGNAT IPs are shared by thousands of real users; rotate by reconnecting | ~$80–130 per modem + SIM | Cleanest reputation; overkill for one owner; fallback for hostile sites |
| Commercial residential proxies | Decodo (most recommended, ~$2–6/GB), Oxylabs (premium, publishes sourcing docs), Bright Data (KYC, business accounts, open-source proxy manager), IPRoyal and Webshare (budget; Webshare has a free tier), Evomi (cheapest, mixed reliability) | Per GB | Anonymous `web.fetch` only. A rotating IP in another city on the owner's accounts triggers fraud flags rather than avoiding them |
| Commercial VPN (Gluetun and similar) | Datacenter IPs | Subscription | Privacy only; worse than nothing against bot detection |
| Hosted agent browsers | Browserbase, Steel, Hyperbrowser, Kernel, Browser Use Cloud ($5/GB proxies) bundle residential proxies, fingerprint rotation, and CAPTCHA solving | Per hour or GB | Already listed as remote CDP in WEB.md; bypass rates are vendor-reported |

Sourcing: residential IPs come from SDKs in free apps and consumer devices with consent of
varying quality, all self-certified. NetNut was linked to the Popa botnet (Jun 2026, one
source); Google shut down ten proxy brands (Jan 2026). Any proxy provider interface needs a
documented sourcing check.

### 10.3 Identify instead of disguise

| Effort | What it is | Status |
|---|---|---|
| Web Bot Auth / Signed Agents (Cloudflare, IETF draft) | RFC 9421 HTTP Message Signatures; Ed25519 key; JWKS at `/.well-known/http-message-signatures-directory`; `Signature-Agent` header. "Signed agents" act for end users, "verified bots" for their operator | Founding members ChatGPT agent, Goose, Browserbase, Anchor; Cloudflare Browser Rendering. Registration per operator through the dashboard. An Aug 2026 probe found live keys only at chatgpt.com and browserbase.com |
| AWS AgentCore Browser | Signs requests and auto-registers with Cloudflare, HUMAN, Akamai; reduces challenges "on domains that allow verified bots" | Preview; keys are AWS's, customer keys planned |
| Visa / Mastercard agent directories | Registered agents for payments, nonce against replay | Announced |
| hCaptcha position | "Legitimate agents should clearly identify themselves"; disguise is "not behavior that should be normalized" | Agent detection and policy controls in hCaptcha Enterprise |
| Browser Use "Agent CAPTCHA" | Reverse CAPTCHA: an agent proves it is an agent to sign up | Apr 2026 |
| Stealth browsers | Camoufox (Firefox), Patchright (Playwright patch), nodriver, rebrowser | Benchmarks conflict: nodriver 28/31 Cloudflare targets unblocked (May 2026); another table gives 83% to Camoufox/nodriver and 66% to Patchright |

### 10.4 Human handoff implementations

| Source | Behaviour |
|---|---|
| open-instinct `maritime-computer` skill (`refs/open-instinct/skills/maritime-computer/SKILL.md`) | `request_takeover(reason)` → `{success, note, screenshot}`; `human_in_control` state; screenshots stop while the owner holds the desktop; "never type a code the owner texts you into a site"; three failed attempts means stop |
| Grok Bot | Hands over for SSO, passkeys, CAPTCHA, bank-card verification; "pause and notify you rather than attempting to work around the check" |
| Skyvern | Pauses and notifies the operator on CAPTCHA or 2FA |
| Cloudflare Browser Run | Live View URL per session (Apr 2026); a handoff flow where the agent signals for help and gets control back was announced |
| Browserbase | Live View iframe as a human-in-the-loop escape hatch without ending the session |
| BrowserAct Remote Assist | Shares the live session to a phone or desktop, then resumes in the same session |
| Open source | noVNC over loopback `x11vnc`; request-takeover endpoints with states pending / active / completed / timeout / cancelled |
| Paid solver farms (2Captcha, CapSolver) | Human workers solve challenges for the bot. The impersonation that hCaptcha and Anthropic's terms push back on |

The unsolved part (a Reddit thread of Apr 2026 says it plainly): no standard way for the
owner to see and touch the session from a phone within seconds. Hosted live views work
only on their own platforms.

## Sources

- open-instinct — https://github.com/mariagorskikh/open-instinct
- OpenInstinct (Merit Systems) — https://github.com/Merit-Systems/OpenInstinct
- openinstinct (Yeachan-Heo) — https://github.com/Yeachan-Heo/openinstinct · https://openinstinct.org/
- OpenClaw — https://github.com/openclaw/openclaw
- openclaw-sendblue plugin — https://github.com/njerschow/openclaw-sendblue
- MausBot, "Instinct AI alternative" — https://mausbot.com/blog/instinct-ai-alternative
- OpenMausBot source — https://github.com/milind-soni/OpenMausBot (studied 2026-11-10 in
  [learning/09-openmausbot.md](learning/09-openmausbot.md); `refs/openmausbot`)
- OpenOpenInstinct — https://maceip.github.io/OpenOpenInstinct/
- supermemory teardown of Instinct's memory system (blog post, Oct 2026)
- Instinct Terms of Service; press coverage of the Series C (Sept 28, 2026); investor posts
  by Anish Acharya and Sheel Mohnot
- Meta Muse announcement and help pages (Nov 2026)
- §9: xAI Grok Bot docs — https://docs.x.ai/grok-bot/computer-and-apps · Grok Computer
  announcement — https://x.com/grok/status/2043719086270447897
- §9: Meta Newsroom, "Introducing Muse" — https://about.fb.com/news/2026/09/introducing-muse-personal-ai-agent/ ·
  https://ai.meta.com/muse/ · Forkast on the Sentinel architecture (secondary)
- §9: Anthropic computer use tool — https://platform.claude.com/docs/en/agents-and-tools/tool-use/computer-use-tool ·
  browser use tool — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-tool ·
  SDK toolsets and drivers — https://platform.claude.com/docs/en/agents-and-tools/tool-use/browser-use-sdk ·
  best practices — https://claude.com/blog/best-practices-for-computer-and-browser-use-with-claude
- §9: Google AI Studio, computer use — https://aistudio.google.com/docs/computer-use
- §9: ChatGPT Work coverage (MacRumors, The Neuron, PCWorld; Jul–Sep 2026); OpenCUA (NeurIPS 2025)
- §10: Cloudflare, "Signed Agents" — https://blog.cloudflare.com/signed-agents/ · agentic commerce —
  https://blog.cloudflare.com/secure-agentic-commerce · IETF draft-meunier-webbotauth-registry-01
- §10: AWS, Web Bot Auth in AgentCore Browser — https://aws.amazon.com/blogs/machine-learning/reduce-captchas-for-ai-agents-browsing-the-web-with-web-bot-auth-preview-in-amazon-bedrock-agentcore-browser/
- §10: hCaptcha on bots and agents (2026) — https://www.hcaptcha.com/post/hcaptcha-captchas-are-highly-effective-against-bots-and-agents-in-2026
- §10: Cloudflare Browser Run Live View changelog (2026-04-15); Browserbase Live View; BrowserAct Remote Assist
- §10: Proxy reviews (Proxyway, Cybernews, Hackernoon, ScrapeCreators; affiliate-funded) ·
  residential SDK sourcing (Level Up, Peakhour) · Proxidize `4g-proxy` — https://github.com/proxidize/4g-proxy
- §10: anti-detect benchmarks (ianlpaterson, May 2026; techinz/browsers-benchmark); Web Scraper on Turnstile
- §10: `refs/open-instinct/skills/maritime-computer/SKILL.md` (commit in `refs/INDEX.md`)
