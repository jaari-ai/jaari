# ADR-073: Inbound triggers: polling first, a separate hook listener with opt-in public exposure offered at hook creation, signed deliveries, hooks bound to one routine

- **Status:** Accepted
- **Date:** 2026-11-12

## Decision
**Polling first.** Where an app has an API, a watcher routine (ADR-064) polls it; no public URL is
needed. This covers mail, calendar, feeds, and GitHub. Events from the owner's devices come over
the node link (ADR-058).

**Webhooks through a separate hook listener.** A process separate from the daemon API and the
panel serves only `/health` and `/hooks/<id>`, on loopback by default.

**Public exposure is opt-in, offered when it is needed.** A pluggable exposure adapter (ADR-071)
publishes the hook listener's port only, never the panel or the API: Tailscale Funnel,
Cloudflare Tunnel, or a custom adapter. It is off by default. When the owner creates a webhook
and exposure is off, Jaari offers to enable it with one prompt (ADR-035) that names the adapter
and what becomes public; otherwise the owner decides, and the hook works on loopback or over the
overlay only. `jaari doctor` checks that only hook paths answer from outside. This is the one
exception to ADR-030's no-public-ports rule, limited to the hook listener.

**Authentication before the body is read.**
- Default: HMAC-SHA256 over the delivery id, timestamp, and raw body, with a 300-second window
  and a nonce.
- A sender's own signature scheme (for example GitHub `X-Hub-Signature-256`, Stripe) through a
  verifier adapter.
- A bearer token only for senders that cannot sign, with a warning at setup.
- Secrets are held in the vault (ADR-050) and compared in constant time; a new hook's secret is
  shown once on a secret-entry page (ADR-067).

**Limits and reliability.** Body cap 256 KiB by default, configurable up to 1 MiB; 10 requests a
minute per hook; dedup by delivery id; the receipt is written to disk before the 2xx response,
then processed through the job queue (ADR-025).

**What a hook can do.** A hook starts only the routine it is bound to (ADR-064); the routine's
prompt is the instruction. The payload is untrusted data for the `reader` role and never commands
Jaari. Effects that follow are self-initiated, so shadow mode (ADR-068), approvals, and grants
(ADR-072) apply.

**Management.** `jaari hook create <routine>` makes the URL and secret; `jaari hook list |
rotate | revoke` and the panel manage them; each hook shows deliveries, rejections, and the last
delivery.

**No hosted broker** run by the project. **Phase 5.**

Borrowed: HMAC over delivery id, timestamp, and raw body with a window and nonce, and the receipt
written before acknowledging from open-instinct `packages/inkbox/src/signature.ts` and
`inbox.ts`; the separate loopback listener, auth before body, body cap, rate limit, and dedup
from OpenMausBot `server/webhooks.ts` (learning/09).

## Alternatives rejected
Webhooks on the daemon API port; exposing the panel or API with the hooks; public exposure on by
default; a project-hosted relay; bearer tokens as the default; payloads acting as instructions;
hooks that start arbitrary work instead of one bound routine.

## Consequences
_TODO: fill in as implementation reveals them._
