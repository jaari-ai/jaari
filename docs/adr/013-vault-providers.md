# ADR-013: Pluggable vault providers: Bitwarden first, 1Password second

- **Status:** Accepted
- **Extended by:** [ADR-018](018-capability-vocabulary-and-phase-0-floor.md), [ADR-040](040-no-payments-in-v1.md), [ADR-050](050-vault-verification-and-one-time-codes.md), [ADR-063](063-agent-mailbox.md), [ADR-071](071-capability-packages.md), [ADR-072](072-standing-grants.md), [ADR-079](079-secret-zero-on-servers.md)
- **Date:** 2026-11-05

## Decision
`@jaari/secrets` resolves `secretRef:` handles through a `VaultProvider` interface (`resolve`, `list` metadata only, `health`); the handle's prefix selects the provider (`secretRef:bw:<item>/<field>`, `secretRef:op:<vault>/<item>/<field>`; bare names map via config). Providers: `bitwarden` first, talking to `bw serve` bound to localhost as a separate process, which covers the official self-hosted server (Bitwarden Lite, the recommended default), Vaultwarden, and Bitwarden cloud with one backend; `onepassword` second, via the official SDK and a service account scoped to a dedicated Jaari vault; `env`/`file` for development and tests only. Jaari reads from a dedicated vault or collection, never the owner's whole vault. The bootstrap credential (secret zero) is kept in the OS keychain, never in config or memory. Resolved values exist only inside the executor for the duration of the call and are never cached to disk, logged, or returned to the model. Vault MCP servers are not exposed to the model. Payment-card fields are not resolvable by default; enabling them requires an explicit per-item config flag, and any payment still goes through `@jaari/gate` with a digest-bound approval and a spend check (rail choice in ADR-040). Writes to the vault (new or rotated credentials) are an effectful capability and also go through the gate.

## Alternatives rejected
1Password only (not self-hostable, closed source); Vaultwarden as the reference target (no audit, no Secrets Manager; still supported through the `bw` backend); linking Bitwarden or 1Password SDKs whose licences restrict use, instead of calling a separate process; giving the model the vendor MCP server (puts credentials in model context, violates ADR-007); a Jaari-built encrypted store (re-solves sync, backup, and audit that vaults already provide).

## Amendments
- **ADR-018:** Phase 0 ships the resolver and an `os-keychain` provider; `env` and `file` stay development-only with a `jaari doctor` warning.
- **ADR-050 (accepted 2026-11-12, resolves OQ-64):** vendor docs checked; no paid tier is required.
  The owner chooses the vault layout at `jaari init` (a separate Bitwarden account, an organization
  collection, or a 1Password vault with a service account); Bitwarden Lite is one option, not the
  recommended default. TOTP from a Bitwarden vault needs Premium, which is the owner's call.
  One-time codes come from the vault, then the owner's channels, then the owner.
- **ADR-063:** no SMS gateway node.
- **ADR-071:** vault providers are a package kind with a checked manifest.
- **ADR-072:** vault writes are never grantable; each is Allow once.
- **ADR-040:** the payment-card flag stays off and is not offered in v1.
- **ADR-079 (resolves OQ-67):** on a host without an OS keychain, secret zero comes from the
  `host-credential` provider: a file supplied by systemd (`LoadCredentialEncrypted=` by default)
  or by a Compose secret, checked for owner-only access and kept out of the data directory and
  backups.

## Consequences
_TODO: fill in as implementation reveals them._
