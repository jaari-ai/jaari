# ADR-062: OAuth broker: bring-your-own client with a wizard, grouped consent per connection, tokens in the vault, no hosted broker

- **Status:** Accepted
- **Extended by:** [ADR-090](090-oauth-token-rotation.md)
- **Date:** 2026-11-11

## Decision
**Bring your own client.** `jaari connect google` (or the panel) walks the owner through creating
a Google Cloud project, enabling the APIs, and setting up a personal-use consent screen in
production status; the same for Microsoft (an Entra app registration). The client details are
stored in the vault. No shared Jaari client in v1: it would need Google's app verification (a paid
security assessment for Gmail's restricted scopes) and would make `jaari.org` a party to every
install. No hosted broker.

**Flow.** PKCE with a state parameter; a pending flow expires after 10 minutes. The redirect goes to
the panel over the overlay (HTTPS, ADR-030), or to a loopback address through the CLI on the device
where the owner signs in; device-code flow where the provider supports it for those scopes
(Microsoft broadly). Each provider's exact redirect and device-flow rules are verified in Phase 5
(for example, Google refresh tokens for apps left in testing status expire after 7 days, which is
why the wizard sets production status).

**Grouped consent.** At connect time the owner picks the capabilities wanted for that account (for
example `calendar.freebusy`, `calendar.read`, `calendar.write`, `email.read`), and Jaari asks for
all their scopes in one consent screen. Scopes for capabilities not chosen are not requested;
adding one later is a new consent for the added scopes. A data file per provider maps each
capability to its smallest scopes.

**Tokens.** Refresh tokens are vault items (ADR-013) read only by executors; access tokens live in
memory only and refresh 5 minutes before expiry; rotated tokens are written back through the gated
vault write. The model never sees a token.

**Enforcement.** Grants are checked against the real tool name at call time and logged; with
several accounts the account is always named (ADR-039).

**Revocation.** `jaari connect revoke <account>` and the panel revoke at the provider and delete the
vault item. When the provider reports the grant revoked (`invalid_grant`), Jaari tells the owner
once and detaches that account's capabilities.

**Admin consent.** For work accounts (Google Workspace, Microsoft Entra) that need an admin to
approve the app, Jaari recognises the error, explains it, and gives the admin-consent link; there
is no workaround.

**MCP servers** authenticate through pi-mcp's OAuth client, with tokens in the vault as well.

**Phase 5.**

Borrowed: PKCE, early refresh, pending-flow expiry, and revoke on disconnect from open-instinct
`payments/src/wallet.ts`; the MCP OAuth client from Pi `packages/mcp`.

## Alternatives rejected
A hosted broker (tokens leave the box); a shared project client in v1; requesting every scope a
service offers; one consent screen per capability (more prompts than the owner wants); tokens in
config or model context.

## Amendments
- **ADR-090 (resolves OQ-75):** rotating an existing token is a bounded maintenance write with
  no approval (same item and account, value from the listed token endpoint, only the refresh
  token and expiry change); written before use and audited.

## Consequences
_TODO: fill in as implementation reveals them._
