# Jaari: Security model

This file designs the controls. Who attacks what, and which controls answer it, is in
[THREAT_MODEL.md](THREAT_MODEL.md) (ADR-069).

## Approval gate (ADR-006)
1. Model proposes an action: `{capability, target, params, amount?, expiresAt}`.
2. Gate serializes it to canonical JSON and hashes it (SHA-256).
3. Owner sees a plain summary + short digest and approves or denies.
4. Executor recomputes the digest; mismatch, reuse, or expiry → refuse.
5. Decision appended to `audit.jsonl`. No LLM in this path.

Additions from ADR-016 (accepted; from the OpenMausBot study):
- The owner is shown the whole action, never a truncated one. If it does not fit a card,
  the card links to the full canonical JSON whose digest is being approved.
- Re-check at dispatch: after the digest matches, the executor re-reads capability state,
  standing policy, account scope, kill switch, and shadow mode, and refuses if any changed.
- A deterministic classifier that cannot read an action to the end returns "unreadable",
  which is handled as "ask the owner".
- `audit.jsonl` is hash-chained (each row holds the SHA-256 of the previous one) and
  records the deciding rule, the actor, whether the owner was present, and the medium.
  An action whose audit row cannot be written does not run.
- After a crash, a cut turn reruns at most once and never if an effectful action had
  started in it.
- Standing grants ("always allow"): one grant model with exact-match keys, a 90-day expiry,
  and a closed list of grantable capabilities; sends, `publish`, `pay`, and `repo.write` are
  never grantable; each use is an audit row with its digest and grant id (ADR-072).
- Pinned jobs: a recurring script approved once for one exact digest is its own approval kind,
  listed and revoked with the grants; host jobs expire after 90 days, sandboxed jobs get a 90-day
  check-in; only the owner creates one, and it cannot use `pay` (ADR-092).

## Secrets (ADR-007)
`secretRef:<name>` in config and tool args; resolved only inside executors.

Additions from ADR-016 (accepted): resolved values are scrubbed by exact value (and common
encodings) from tool results and logs; the model names a credential by a typed target id,
never a path or URL; a value sent to a node is for one action and is then discarded (ADR-015); while a filled secret is on a
page, screenshots and page evaluation are refused.

Vault (ADR-013, ADR-050): Jaari reads only a dedicated vault or collection that the owner
chooses at `jaari init`; the vault client runs as a separate process; secret zero stays in the
OS keychain and is never in a backup. On a server or container without a keychain it comes from
the `host-credential` provider: a file supplied by systemd (`LoadCredentialEncrypted=` by
default) or a Compose secret, refused if others can read it or it is in the data directory or
the backup set; never an environment variable (ADR-079). Vault
writes go through the gate. OAuth tokens are vault items, refreshed by the executor (ADR-062);
rotating an existing token skips the gate only within the ADR-090 bounds (same item and
account, value from the listed token endpoint), is written before use, and is audited. Payment-card fields are not resolvable in v1 (ADR-040).

Secrets pasted in chat (ADR-081): every owner message is scrubbed at channel ingress, before
the transcript, the daily log, or any model: known key and token formats, labelled passwords,
Luhn-valid card numbers, and exact vault values become `[secret removed: <kind>]`. The value is
never kept; Jaari deletes the message where the channel can, advises rotation, and offers the
single-use secret-entry page (until Phase 3, `jaari secret set <name>`, ADR-088). A bare
unlabelled password is not recognised.

## Capabilities (ADR-018)
The only names the model can ask for. A manifest's `provides` lists these and nothing else;
host (`daemon` or `node`) and provider (`local-profile`, `remote-cdp`, `macos`, `xvfb`) are
separate manifest fields.

| Capability | Class | Notes |
|---|---|---|
| `web.search`, `web.fetch` | read | Results are untrusted content (reader role) |
| `browser.read` | read | Page content is untrusted; a browser worker child with task data only sees it (ADR-052) |
| `browser.act` | gated by classifier | Ordinary clicks and typing; commitments (pay or order, book, send, consent, account changes, upload) escalate to `browser.submit` (ADR-051) |
| `browser.submit` | gated | Forms, purchases, consent |
| `computer.use` | gated per action | Desktop control on a node or the host virtual desktop |
| `shell`, `files.write` | gated | Sealed sandbox runs need no approval; otherwise Allow once or a 90-day target grant (ADR-036) |
| `files.read` | read | |
| `email.read` | read | Content is untrusted |
| `calendar.freebusy`, `calendar.read` | read | Mirrored into event records (ADR-039) |
| `calendar.write` | gated | Own calendar without attendees: Allow once or a 90-day grant; invitations always ask (ADR-039) |
| `email.send`, `publish`, `repo.write` | gated | Never grantable (ADR-072); 5-minute approval expiry for `email.send` and `publish` |
| `pay` | reserved | No executor in v1; checkouts end at an owner takeover (ADR-040) |
| `llm.escalate` | policy-checked | Children only (ADR-011) |
| `mcp.read`, `mcp.act` | read, gated | MCP tools that match no other name; unconfirmed or unreadable tools are `mcp.act` (ADR-034) |

Gated effects that have no name in this table yet (vault writes, address-book writes,
file-storage uploads, memory erase), the internal read tools, and the `takeover` class of
ADR-018 are OQ-79.

Login and CAPTCHA go to owner takeover. One-time codes come from the vault, then from a message on the owner's channels (read by the executor, never the model, with a notice), then from the owner (ADR-050).

## Approval card (ADR-006, ADR-018, ADR-035)
The card is a typed prompt each channel renders as it can: buttons, quick replies, or a text
reply grammar.
The short code the owner types or taps is only a lookup of the digest. There is no amount
or parameter tolerance: a different action is a different digest. Default expiry 15
minutes; 5 for `email.send` and `publish`; overridable per capability.

## Phase 0 floor (ADR-018)
`@jaari/gate` ships as a deny-all stub: gated capabilities refuse, read ones run. The
`secretRef` resolver and the `os-keychain` and `host-credential` providers (ADR-079) ship in
Phase 0; `env` and `file` are
for development and make `jaari doctor` warn. Third-party skills install disabled until
the `reader` role exists.

## Untrusted content
Email, web pages, search snippets, and documents go through the tool-less `reader`
role before the main session sees them. Webhook and app-event payloads are untrusted
content too (ADR-073). Every run carries a
code-set origin (`owner`, `routine`, `event`, `outside`). `outside` sticks to everything it
spawns, cannot settle approvals or use grants, and each of its effects is Allow once with an
origin line on the card (ADR-075).

## Egress
All network calls via `@jaari/http`; containers via an egress proxy that blocks private
ranges and cloud metadata. The `@jaari/http` core (resolve, check, dial; `direct`) ships in Phase 0 and every outbound
call uses it; a lint rule refuses other network clients, and an adapter that cannot take the
injected `fetch` stays off. Local model servers the owner runs are reached only on their
configured endpoint; their downloads are their own traffic (ADR-080). Tool-level origin allowlists are not a security boundary.

Mechanism (ADR-016, accepted):
- Resolve, check, dial: the gate resolves the name, classifies every address, and
  connects only to the addresses it checked. This closes DNS rebinding and redirects.
- One address-class table for the HTTP client, the browser, and sandboxes. Always denied:
  cloud metadata, link-local, `0.0.0.0/8`, multicast, benchmark ranges, and the daemon's
  own ports. NAT64 and 6to4 addresses are unwrapped before classification. Private ranges
  are denied unless the owner allows a host.
- The browser reaches the network only through a per-session loopback SOCKS5 listener;
  Chromium's loopback bypass is removed and non-proxied WebRTC UDP is disabled.
- A refusal is returned to the model in the tool result, so it stops retrying.

Egress pool (ADR-017): the SOCKS5 listener and `@jaari/http` choose a provider per session:
`owner-exit` (Tailscale, Headscale, or WireGuard exit node on owner hardware), `direct`,
`mobile` (owner 4G dongle), `residential-proxy` (sourcing check), `vpn` (consumer VPN such as
WARP; anonymous only). `owner-exit` may be a WireGuard peer or a SOCKS5/HTTP proxy (ADR-030). Rotation is for anonymous
traffic only and may mix owner exit nodes with proxies. Owner-account sessions are pinned to
one owner node (or direct from home hardware), fail over only to another owner node, and
refuse when none is up; they never fall back to a rotating or datacenter address.

## Owner hold (ADR-005, ADR-016)
Takeover is a hold owned by the owner, not by one window: accepted agent calls drain,
new agent input is refused (never queued), and the hold ends on release, two minutes
after the last view closes, or after five idle minutes. Transport and states: ADR-055.

## Pause, stop, and limits (ADR-031)
Pause stops new work and survives restarts; emergency stop also aborts running work and cancels
pending approvals. Step, child, stall, watchdog, loop, and spend-spike limits are enforced in
code, configurable, and logged when they fire.

## Encryption at rest (ADR-028)
Memory writes are scanned for secrets before they are stored. The host relies on full-disk
encryption; remotes the owner does not control get age-encrypted bundles or `git-remote-gcrypt`;
`jaari memory purge` rewrites history everywhere Jaari can reach. Owner-facing trade-offs:
[guides/securing-your-install.md](guides/securing-your-install.md).

## MCP servers (ADR-034)
Servers are added by the owner; one the model proposes arrives switched off. Each tool is
pre-classified and the owner confirms the mapping in one step; until then it is `mcp.act`.
Config and tool list are pinned by SHA-256, and any change holds the server for re-approval.
Server text is untrusted and results are capped at 20 KB. Local servers run in a sandbox whose
only network is a loopback proxy into `@jaari/http`; without a backend they run only after a
per-server "unsandboxed" warning the owner accepts.

## Code execution (ADR-036)
Sealed runs (no network, no secrets, owner files read-only) never ask. Otherwise Allow once,
or Always allow for one host or folder for 90 days; host commands are always Allow once; files
plus a host off the starter list always ask. Recurring jobs are approved once at creation,
pinned to a digest of script, placement, secrets, hosts, and schedule; any change holds them.
A boot self-check disables code execution if the sandbox is weakened.
Engine runs (subscription CLIs, ADR-077) are not sealed: they reach the provider's declared hosts
with the CLI's sign-in. On owner files the first run per workspace asks Allow once or a 90-day
`engine.run` grant, and the card says the workspace goes to the provider; a scratch workspace
runs without asking once the engine is enabled; web access on makes the run `outside`; 30-minute
limit (ADR-091).
