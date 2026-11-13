# ADR-098: Owner-account browsers may run on any host with direct egress; only home sites use the owner exit

- **Status:** Accepted
- **Date:** 2026-11-13

## Context
ADR-017's placement rule kept a browser signed in to the owner's accounts on the owner's network
identity (home hardware, an owner node, or through an owner exit), and ADR-048 kept third-party
browser providers for anonymous work "unless the owner pins it", with "pin" undefined (OQ-82).
OpenMausBot sends only the sites that turn away data centres (Google sign-in and search, YouTube,
Instagram) through the owner's lent computer and loads every other site, signed-in ones included,
from the cloud, because a distant home connection is slow (measured 58 s against 2 s); it hands
log-ins to the person through a live view (`refs/openmausbot/docs/cloud-pro.md`,
`docs/plans/browser-engine.md`, commit `b802268`). open-instinct keeps owner log-ins in a hosted
microVM desktop at a data-centre address and hands every log-in, code, and payment form to the
owner (`refs/open-instinct/skills/maritime-computer/SKILL.md`, commit `2e5e71b`). Study:
`docs/learning/12-browser-placement.md`.

## Decision
**Placement rule, replaced.** A browser signed in to the owner's accounts may run on any host:
home hardware, an owner node, the daemon's datacenter host, or a third-party browser provider the
owner has enabled for owner accounts. Its egress is the host's direct route.

**Home sites are the only owner-exit route.** The ADR-053 `homeSites` list goes through an owner
exit, re-checked there (ADR-053). It ships with a default list of sites known to turn away data
centres (Google sign-in and search, YouTube, Instagram, Reddit), extended by entries suggested
from vault log-in URLs (ADR-053), and the owner confirms and edits it. When no owner exit is up, a
home site in an owner-account session refuses and notifies once (ADR-017); anonymous traffic to it
uses the anonymous pool.

**Third-party browser providers for owner accounts.** Off by default. The owner enables a
provider for owner accounts with one confirm prompt that names it and says it will hold the
signed-in sessions; an `outside` run cannot (ADR-075). Home sites on such a provider go through an
owner exit only when the adapter can pass a proxy through; otherwise they are refused on that
provider. Disabling it deletes the provider's stored context where its API allows that.

**Log-ins.** Log-ins and one-time codes on a third-party provider go through takeover (ADR-055);
the vault never fills credentials into a third-party browser. Jaari's own browser on its own host
keeps executor fill (ADR-016).

**Unchanged.** A dedicated profile, never the owner's own browser profile (ADR-005); the gate,
the commitment classifier, and shadow mode (ADR-051, ADR-068); signing rules for owner accounts
(ADR-054).

## Alternatives rejected
All owner-account traffic through the owner exit (slow from a distant VPS, and a single home link
for every signed-in site); third-party providers for anonymous work only (excludes hosted setups
like open-instinct's); vault fill into third-party browsers (credentials leave to a third party).

## Consequences
_TODO: fill in as implementation reveals them._
