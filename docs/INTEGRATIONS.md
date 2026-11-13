# Jaari: Integrations and project identity (ADR-010)

| Asset | Status |
|---|---|
| Domain `jaari.org` | Owned |
| GitHub org `jaari-ai`, repo `jaari-ai/jaari` | Created |
| npm org `jaari` (scope `@jaari`), npm `jaari`, PyPI `jaari` | **Not yet secured** (nothing published as of 2026-11-05). Steps: [guides/namespaces.md](guides/namespaces.md). Trusted publishing (OIDC) only |

Agent-facing integrations use `secretRef` credentials and gated capabilities. Email uses
`email.read` and `email.send`. There are no GitHub, npm, or PyPI integrations; `repo.write` and
`publish` are reserved names with no executor (ADR-103). Personal data sources: calendar first, then contacts, then file storage; notes come
through memory, files, and MCP (ADR-039). Google and Microsoft sign-in uses the owner's own
OAuth client (ADR-062); the agent's mailbox options are ADR-063.
