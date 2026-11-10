# Jaari: Integrations and project identity (ADR-010)

| Asset | Status |
|---|---|
| Domain `jaari.org` | Owned |
| GitHub org `jaari-ai`, repo `jaari-ai/jaari` | Created |
| npm org `jaari` (scope `@jaari`), npm `jaari`, PyPI `jaari` | **Not yet secured** (nothing published as of 2026-11-05). Steps: [guides/namespaces.md](guides/namespaces.md). Trusted publishing (OIDC) only |

Agent-facing integrations (GitHub, npm, PyPI, email) use `secretRef` credentials and
gated capabilities (`repo.write`, `publish`, `email.send`). Personal data sources
(calendar, contacts, notes) are open (OQ-18).
