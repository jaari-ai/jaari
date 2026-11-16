# 14: The egress core (resolve, check, dial)

Written 2026-11-16, while building roadmap 0.15 (`@jaari/http`). Source: OpenMausBot's browser
egress gate, read for design only (no code copied).

| Ref | Pinned commit |
|---|---|
| `refs/openmausbot` | `b8022684d1f519d49a776e00900ae9c65daa357d` |

## 1. What OpenMausBot does
- `electron/egress-addresses.mjs` gives every address one class (metadata, loopback, reserved,
  link-local, this-machine, private, public). It unwraps NAT64 and 6to4 to the IPv4 address
  inside, drops an IPv6 zone (`%eth0`), and reads the machine's own interface addresses. Its
  header says the ranges and the unwrapping are adapted from T3 Code (MIT).
- `server/browser/egress/policy.ts` turns a class into a refusal per host kind (desktop,
  server, cloud). An allow entry is an IP or CIDR with an optional port; an entry for one
  loopback address and port also covers the other family, because `localhost` resolves to both.
  **Every** address a name returns must pass, or the connection is refused.
- `server/browser/egress/gate.ts` is a SOCKS5 gate for the browser that resolves, checks, and
  connects to the checked address.

## 2. Why
DNS rebinding (a public name that answers with a private or loopback address) and redirects
to internal hosts reach services that trust their network position, such as cloud metadata
at `169.254.169.254` or a local admin port. Checking a URL's name is not enough: the address
must be checked, and the connection must go to the address that was checked, not to a fresh
lookup.

## 3. What Jaari did, and where it differs
- **Own table, written from the IANA special-purpose registries** (`packages/http/src/address.ts`).
  The IPv6 expansion runs on the WHATWG URL parser's normal form, not on hand-parsed dotted tails.
  It also unwraps IPv4-mapped addresses (`::ffff:a.b.c.d`).
- **At the HTTP connection, not a SOCKS gate.** Node's own `fetch` gets an undici `Agent` whose
  connector resolves, checks, and dials (ADR-113). Redirects and IP-literal URLs open
  connections through it, so they are checked too. The browser's SOCKS5 listener is Phase 6.
- **Dial only passing addresses instead of "all must pass".** When a name returns some refused
  addresses, Jaari dials the first address that passed and never a refused one. This is as safe
  against rebinding, since a refused address is never dialled, and it makes `localhost` work with
  one allowed loopback address without OpenMausBot's mirroring of the other family.
- **One host kind.** Jaari is self-hosted only (ADR-017), so there is no desktop or cloud branch.
  The daemon's own ports are refused on every address that is not public.
