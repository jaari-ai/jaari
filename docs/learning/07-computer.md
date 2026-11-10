# 07 — Computer use: cloud computers, local drivers, and the vendor toolsets

Studied 2026-11-09: Meta Muse, xAI Grok Bot and Grok Computer, ChatGPT Work, the Anthropic
computer and browser toolsets, Gemini `computer_use`, and `refs/pi` (for toolset support).
Reference table and sources: [00-research.md §9](../00-research.md). No decision was taken;
the open questions are OQ-27, OQ-30, OQ-31.

## 1. What the sources do

**Cloud computer per user (Muse, Grok Bot, the retired ChatGPT agent, Instinct).** Each user
gets a persistent Linux VM with a browser, a shell, and a filesystem. Work continues when
the phone is off. The owner can watch a live preview, take over, or stop. Credentials never
pass through the model: Muse keeps them in "secure storage, so Muse can use them without
seeing them"; Grok Bot fills from Vault, then a connected 1Password, then a one-time "Secure
Form", with values "filled into the page without the Bot seeing them". Payments use
one-time cards (Stripe Link). Muse adds a **Sentinel**, a second agent isolated at the
system level: "nothing Muse does reaches the internet unless the Sentinel approves it."
Approvals are allow once / always / deny, and Muse shows an audit trail of actions done
*and planned*. Grok Bot hands over for SSO, passkeys, CAPTCHA, and bank-card checks, and is
told to "pause and notify you rather than attempting to work around the check".

**Local desktop driver (Grok Computer, Muse for Mac, ChatGPT Work desktop mode).** The agent
sees the owner's own screen and drives mouse and keyboard. Grok Bot's local mode defaults
to "Ask every time" per command. Muse for Mac works through macOS Automation and Files
permissions. ChatGPT runs in the background on macOS but takes the foreground on Windows.

**Model-side primitives.** Anthropic ships two client-side toolsets: `computer_toolset_20260801`
(17 members: `screenshot`, `zoom`, clicks, `type`, `key`, `scroll`, `wait`…) and
`browser_toolset_20260801` (27 members plus opt-in `javascript_exec`, `file_upload`,
`read_console`, `read_network`). The browser toolset prefers accessibility-tree references
(`link "Getting started" [ref_2]`) and falls back to viewport coordinates; the client reports
tab state in a `browser_state` block. Calls arrive several per turn and must run in order;
on the first failure every later call is answered `Not executed: an earlier action in this
turn failed.` The SDK driver classes (`BetaAbstractBrowserToolset20260801`,
`BetaAbstractComputerToolset20260801`) take a `urlPolicy`, a file policy, and a `confirm`
callback; Browser Use, Stagehand, Daytona, and E2B publish drivers. Gemini exposes one
`computer_use` tool with `browser` / `desktop` / `mobile` environments, 0–999 normalised
coordinates, and a `safety_decision: require_confirmation` the client must acknowledge.
OpenAI's CUA is product-only; xAI has no public API.

## 2. Why they do it that way

| Failure prevented | Mechanism |
|---|---|
| CAPTCHA, 2FA, passkeys, SSO walls (Instinct's early failures) | Takeover: the human does only that step, then the agent continues |
| Credentials in model context or in a provider's logs | Fill from a vault inside the executor; the model sees a placeholder. Muse: the model "cannot see passwords a person types into the browser themselves" |
| Prompt injection turning into exfiltration | A gatekeeper separate from the agent (Muse Sentinel; Anthropic's "allowlist hosts at the network layer"); screenshot classifiers on Anthropic's native toolsets. Meta still calls injection unsolved and aims to shrink the blast radius |
| Irreversible actions without consent | Allow once / always / deny per action; Gemini's built-in `require_confirmation` for payments, communications, consent, account changes |
| A click that is really a purchase | Not solved. Anthropic: "Purchases, sent messages, and accepted terms go through ordinary members such as `left_click` and `type`, so `confirm` can't pick them out by name" |
| Runaway cost | Screenshots cost 1,000–1,800 tokens each; keep the last 3 and prune in batches of 25 so the prompt cache survives; 1280×720 or 1080p screenshots; `high` effort beats `max` on cost per completed task |
| Shared blast radius across agents | Grok Bot: one computer per account, screens are "not separate security boundaries"; Muse: one VM per person, Confidential VM planned |
| Host compromise | Muse for Mac's local-process token-hijack bug (hotfixed in 12 h) shows the local shape inherits every weakness of the owner's OS |

## 3. What Jaari does, and where it differs

**Confirmed by the sources.** ADR-005 (pinned local Chromium profile with takeover) is the
same move Grok Bot's handover and Muse's "take control" make; Jaari keeps it local so the
agent inherits the owner's cookies and residential IP, which is exactly what defeated
Instinct's cloud box. ADR-007 (`secretRef` resolved only inside executors) is the same
contract as Muse's secure storage and Grok's Secure Form. `@jaari/http` plus the gate
(principles 3 and 9) is a Sentinel: the model proposes, deterministic code disposes.
Muse's audit trail of planned actions matches the digest-bound approval of ADR-006.

**Where Jaari differs.**
- The cloud VM is not where the owner's identity lives. ADR-015 and ADR-017 let the daemon run
  on a VPS, but the placement rule keeps a browser signed in to the owner's accounts on home
  hardware, an owner node, or behind an owner exit node; the host's own browser serves
  anonymous work. Muse, Grok Bot, and
  Instinct all default to the cloud because they serve many users; a single-owner agent
  does not need the isolation and loses the owner's browser state.
- No vendor lock on the model. Every product above is tied to its vendor's model; Jaari
  routes by role and tier (ADR-011). That is what makes OQ-27 hard: the richest primitives
  (Anthropic's browser toolset with classifiers) are vendor-specific, and `refs/pi`
  (`pi-ai`, commit in `refs/INDEX.md`) has no toolset support at all.
- Native toolsets reach the gate only through the driver's `confirm` hook, which runs
  inside the SDK loop, not inside Jaari's loop. ADR-012's rule that "browser runs inside
  Jaari's loop so the gate sees every action" is still right; the question is whether the
  gate lives in `@jaari/computer`'s driver or in the tool-call path.
- Payments stay out of v1 (OQ-19); Link one-time cards are the obvious rail later.

**Open after this study.** OQ-27 (neutral `browser.*` surface vs native toolsets per routed
model), OQ-30 (recognising a consequential action behind an ordinary click), OQ-31
(whether screenshots and accessibility trees are untrusted content under the reader rule).

**Numbers worth keeping.** Toolset definitions: ~4.5k input tokens. Screenshot: 1,000–1,800
tokens. Image limit on current models: 2,576 px long edge. Pruning: keep 3, prune every 25
turns. Anthropic recommends 1080p screenshots and `high` effort; Gemini recommends lower
thinking levels for routine automation.
