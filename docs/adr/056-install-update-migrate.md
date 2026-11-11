# ADR-056: Install, update, migrate: owner-chosen install method, automatic patch updates, migrations when a store opens

- **Status:** Accepted
- **Date:** 2026-11-11

## Decision
**Install methods (the owner picks).**
- Compose for a VPS or home box: `jaari init` writes a `compose.yaml` for the owner's choices
  (the daemon, plus SearXNG, a browser, Ollama, and the egress proxy only when chosen).
  Multi-arch images (amd64, arm64), signed with cosign (Sigstore). The code sandbox (ADR-036) never
  gets the Docker socket; under Compose it uses a rootless Podman sidecar or gVisor, settled at
  implementation.
- npm: `npm i -g jaari` (Node 22), for laptops and developers.
- A Homebrew tap on macOS.
- A single binary (Node single-executable application) once the bundling is proven.
- A one-line installer, `curl -fsSL https://jaari.org/install.sh | sh`, offered as a convenience
  that picks one of the above; it is pinned, checksummed, and readable before running.
- `jaari service install` sets up systemd (Linux) or launchd (macOS) outside Compose.
- PyPI `jaari` stays a name holder in v1.

**`jaari init`** is resumable; every step can be skipped and revisited with `jaari config`. It
gathers the init choices made in other ADRs (target, overlay, LLM preset and budget, local
runtime, vault layout, voice strictness, starter allowlist, and so on) and writes versioned config.

**Updates.** Channels `stable` (default) and `beta`.
- Patch releases install automatically during quiet hours (ADR-033), with one digest line saying
  what changed; the owner can turn this off.
- Minor and major releases are never automatic: Jaari notifies once with the release notes, and
  the owner runs `jaari update` (during 0.x a minor release may break, ADR-043).
- `jaari update` verifies the signature and provenance; takes the update lease (pauses new work,
  lets running effectful work finish, holds pending approvals); snapshots the stores (ADR-027);
  swaps versions and keeps the previous one for `jaari rollback`; runs `jaari doctor` after the
  swap and rolls back automatically if the daemon does not come up healthy.

**Migrations.** Config, SQLite (`user_version`), the memory repository (`ops/schema-version`),
and versioned records each carry a schema version; versioned records may define
`migrate(value, fromVersion)`. Migrations run when a store opens, are idempotent and
forward-only, and follow the pre-update snapshot. A memory migration is one commit through the
writer (actor `migration`, ADR-026). A binary older than its data refuses to start and points to
`jaari rollback` and a snapshot restore.

**Uninstall.** `jaari uninstall` removes the app and keeps the data; `--purge` deletes data after
a typed confirmation.

Borrowed: migrations when a store opens from openinstinct `store/migrations.ts` (behaviour only);
versioned documents with `migrate` from Pi `durable/src/documents.ts`; the update lease and
keeping the previous version from gajae-way `docs/deployment.md` (docs only).

## Alternatives rejected
One install method for every target; automatic minor and major updates (they may break during
0.x); no automatic updates at all (security fixes wait on the owner); mounting the Docker socket
into the sandbox; migrations without a snapshot; letting an older binary open newer data.

## Consequences
_TODO: fill in as implementation reveals them._
