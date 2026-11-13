# ADR-049: Fetch ladder: pluggable rungs, Lightpanda optional and off by default, decided from usage data

- **Status:** Accepted
- **Extended by:** [ADR-071](071-capability-packages.md)
- **Date:** 2026-11-11

## Decision
**Pluggable rungs.** Each step of the `web.fetch` ladder (ADR-012) is a `FetchRung` adapter with a
manifest: runs JavaScript or not, rough memory cost, local or hosted, and licence (separate
process or not). The ladder order is config.

**Default ladder.** http + readability → Chromium (local or a remote browser adapter, ADR-048) →
hosted reader (Jina) when hosted readers are allowed. Escalation signals stay as in WEB.md (403,
429, challenge page, under about 500 characters of text, JavaScript required).

**Lightpanda is optional and off by default.** When enabled it sits between http and Chromium.
`jaari init` offers it on low-memory targets (a VPS, a laptop). It runs as a separate process or
container (AGPL-3.0, ADR-014) in the sealed sandbox (ADR-036), with network only through
`@jaari/http`.

**Decided from data.** Every fetch logs the rung that answered, latency, bytes of text, and the
rungs that failed and why (ADR-032 usage log). At most once a month, `jaari doctor` and the digest
suggest a change: turning Lightpanda on when Chromium answers many JavaScript pages it could
likely handle, or off when it often falls through to Chromium.

**Per-site memory.** A domain that repeatedly needs a higher rung starts there for 30 days.

## Alternatives rejected
Lightpanda on by default (incomplete Web API coverage breaks some sites); dropping it (cheap
JavaScript rendering matters on small hosts); a fixed ladder in code; asking more than once a
month.

## Amendments
- **ADR-071:** fetch rungs are capability packages with a checked manifest.

## Consequences
_TODO: fill in as implementation reveals them._
