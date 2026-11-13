# ADR-054: Signed-agent identity: Web Bot Auth signing built in, off by default, per site, key directory on the owner's own domain only

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Signing is built, off by default.** `@jaari/http` and the browser adapters (ADR-048) can sign
requests per Web Bot Auth (RFC 9421 HTTP Message Signatures, `Signature-Agent` header) with a
per-install Ed25519 key generated at `jaari init`, stored in the vault or OS keychain, and
rotatable.

**The owner chooses per site.** Modes: off (default); sign on listed sites (sites the owner marks
as agent-friendly, or that present a challenge signing is known to pass); sign all anonymous
traffic. Owner-account sessions and home sites (ADR-053) are never signed unless the owner lists
that site explicitly, because signing announces automation and some sites block agents.

**Key directory on the owner's own domain only.** The `Signature-Agent` header must point to a
public HTTPS key directory (`/.well-known/http-message-signatures-directory`). Jaari produces the
file for the owner to host on their domain, or serves it through a tunnel if the owner allows.
Without an owner domain, signing stays off. The project hosts no shared directory: it would make
`jaari.org` a central party every install reports to.

**Registration** with Cloudflare's Signed Agents or the IETF registry
([draft-meunier-webbotauth-registry](https://datatracker.ietf.org/doc/draft-meunier-webbotauth-registry/))
is revisited when they state whether individuals can register. `jaari doctor` shows the signing
status and the sites that rejected signed requests.

**Phasing.** HTTP signing in Phase 4; browser signing in Phase 6 with the adapters.

Background: [Cloudflare signed agents](https://developers.cloudflare.com/bots/concepts/bot/signed-agents)
(an agent "controlled by an end user", submitted through the Cloudflare dashboard, checked
2026-11-11); learning/08.

## Alternatives rejected
Signing everything by default (announces automation on owner-account sessions that today look
like the owner); not building signing (sites are converging on signed identity); a shared
`jaari.org` key directory (a central party and a list of installs).

## Consequences
_TODO: fill in as implementation reveals them._
