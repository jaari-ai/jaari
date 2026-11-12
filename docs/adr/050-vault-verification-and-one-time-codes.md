# ADR-050: Vault verification: no paid tier required, owner-chosen vault layout, one-time codes from the vault or the owner's channels

- **Status:** Accepted
- **Extended by:** [ADR-063](063-agent-mailbox.md)
- **Date:** 2026-11-11

## Decision
**Verified against vendor docs (2026-11-11).**
- `bw serve` ([Bitwarden CLI](https://bitwarden.com/help/cli/)) starts a local REST server on port
  8087, bound to `localhost` by default, and blocks requests with an `Origin` header unless
  `--disable-origin-protection` is set. No paid plan is stated. Secrets Manager is not required.
- Bitwarden Lite ([deploy](https://bitwarden.com/help/install-and-deploy-lite/)) needs a free
  installation id and key from bitwarden.com/host and is meant for personal use and home labs.
  Self-hosting is free, but premium features and self-hosted organizations need a licence file
  ([licensing](https://bitwarden.com/help/licensing-on-premise/)). TOTP generation is a Premium
  feature.
- 1Password service accounts
  ([get started](https://www.1password.dev/service-accounts/get-started/)) cannot be granted the
  built-in Personal, Private, or Employee vault or the default Shared vault, which matches
  ADR-013's dedicated vault. Plan eligibility and request limits are not stated there and are
  checked on a real account at the start of Phase 3; without service accounts, the fallback is the
  `op` CLI with desktop-app integration, on desktop hosts only.

**The owner chooses the vault layout at `jaari init`**, with the trade-offs shown:
- A separate Bitwarden account for Jaari holding only the items it may use (free on any server;
  the bootstrap credential opens nothing else).
- A collection in an organization (Vaultwarden, Bitwarden cloud, or a licensed self-hosted
  organization).
- A dedicated 1Password vault with a service account.

**Premium is the owner's call.** `init` explains that TOTP from a Bitwarden vault needs Premium on
the account Jaari uses, and the owner decides. `jaari doctor` shows which mode applies.

**One-time codes, in order.**
1. Vault: if the item has a TOTP secret and the account can generate codes (Bitwarden Premium,
   1Password), the executor reads the code at fill time.
2. The owner's channels: if Jaari can read the inbox or messages where the code arrives (email or a
   messenger), the executor takes it from a message that arrived after the
   login step began, within 10 minutes, from a sender matching the site, with a deterministic
   pattern match (not the model). After using it, Jaari notifies the owner: "used the code from
   your email from example.com". The owner can turn this off per site or entirely.
3. Otherwise Jaari asks the owner for the code (an ADR-035 input prompt) or hands over the step
   (ADR-005).

In every case the code goes straight from the executor into the page: it is never shown to the
model, logged, or stored, and the message it came from is still untrusted content for the reader
role.

**`jaari doctor` checks** that `bw serve` is bound to loopback with origin protection on, that the
Jaari account or collection exposes only the intended items, and that a 1Password service account
reaches only the Jaari vault.

ADR-013 is accepted with these amendments (OQ-64, resolved 2026-11-12).

## Amendments
- **ADR-063:** no SMS gateway node is planned; codes come from email or messenger channels Jaari
  already reads.

## Alternatives rejected
Requiring Secrets Manager or a paid organization; one fixed vault layout; always handing over
two-factor steps (nagging when the code is already reachable); letting the model read the code
from the message (it would enter model context and logs); using codes from messages silently.

## Consequences
_TODO: fill in as implementation reveals them._
