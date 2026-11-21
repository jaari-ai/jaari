# Phase 0 exit audit

Written on 2026-11-20, when every Phase 0 item was built. It links each Phase 0 exit criterion of
[ROADMAP.md](../ROADMAP.md) to the check that proves it, and records the review of
[THREAT_MODEL.md](../THREAT_MODEL.md) that a phase exit needs (ADR-069). It is evidence, not an
authority: when it disagrees with an ADR, the ADR wins.

**Result: the 19 exit criteria pass.** `pnpm test` runs every test named here, and CI runs it on
every pull request with lint, the typecheck, the built-daemon start check, and
`scripts/check-release.sh` (`.github/workflows/ci.yml`).

## How it was checked
For each criterion, the body of the test was read to confirm that it asserts what the criterion
says. A matching test name did not count. A criterion with several clauses needed a proof for each
clause. Where a clause had no proof, a test was added in the same change (marked **new**), or the
criterion was corrected (see "Contradictions fixed").

## Evidence

| # | Criterion (short) | Evidence |
|---|---|---|
| 1 | The tier-1 smoke test boots the daemon on the scripted engine in CI, with no API calls | `apps/daemon/src/smoke.test.ts` (scripted provider, no network); CI runs `pnpm test`, then starts the built daemon with `--check` |
| 2 | Through the gate stub, every gated capability refuses and read-class ones run | `packages/gate/src/gate.test.ts`. **New:** a loop over every name in the capability vocabulary, so a capability added later is covered |
| 3 | A manifest with an unknown name or kind fails closed, before any package code runs | `packages/capabilities/src/manifest.test.ts` (unknown name, unknown kind); `packages/capabilities/src/loader.test.ts` (no package code runs when a manifest fails) |
| 4 | The CLI channel passes the shared channel contract suite | `packages/channels/src/cli/adapter.test.ts` runs `channelContract` from `packages/channels/src/contract.ts` |
| 5 | `jaari doctor` exits non-zero on a failed check and zero on warnings; an `env` or `file` secret provider fails the config check | `apps/cli/src/doctor.test.ts` (exit 1 on a failure, exit 0 with warnings); `packages/core/src/config.test.ts` (`env`; **new:** `file`) |
| 6 | A store that a start will migrate is copied first, and `jaari rollback` puts it back | `apps/daemon/src/smoke.test.ts` (snapshot before the migration, kept across failed starts); `packages/core/src/snapshot.test.ts`; `apps/cli/src/rollback.test.ts` |
| 7 | Without a keychain, the daemon starts unattended with `host-credential`, and refuses a credential file that others can read or that is in the data directory | `apps/daemon/src/smoke.test.ts` (starts with `host-credential`; refuses a file open to others); `packages/secrets/src/providers.test.ts` (open to others, inside the data directory: the provider refuses, and the daemon calls its health check before anything else); the CI start check runs on Linux, which has no keychain |
| 8 | `SECURITY.md`, `CONTRIBUTING.md`, the DCO check, gitleaks, the licence check, and the pnpm settings are in the repo | The files exist; `pnpm-workspace.yaml` (`minimumReleaseAge`, `strictDepBuilds`); the `dco`, `gitleaks`, and licence steps of `.github/workflows/ci.yml` |
| 9 | Every record carries an `ownerId` | `packages/core/src/database.test.ts` (`owner_id` on every row; a store of another owner is refused); `apps/daemon/src/smoke.test.ts` |
| 10 | A scripted refusal in the main session ends the turn with one notice and no model change; in a role that is not pinned it stops and is reported | `packages/core/src/session.test.ts` (one model call; **new:** one `turn.end` event, and the next turn uses the same model although the tier has a second one); `packages/channels/src/ingress.test.ts` (**new:** the owner gets exactly one message, "The model refused to answer."); `packages/llm/src/llm.test.ts` (a role that is not pinned stops and reports) |
| 11 | A clock gap over 2 minutes is detected as sleep | `packages/core/src/power.test.ts` (over 2 minutes is a wake, exactly 2 minutes is not); the owner's lid-close test on a Mac on 2026-11-17 (`power.wake`, 202 s) |
| 12 | The npm tarball installs from nothing and the daemon starts from it; on Linux the generated `compose.yaml` comes up and `jaari doctor` passes beside it | `scripts/check-release.sh`, run by CI on Linux on every pull request; the releases `v0.1.0-beta.1` to `v0.1.0-beta.3`; the owner's install of `0.1.0-beta.2` from npm on a Mac |
| 13 | A binary older than its data refuses to start | `packages/core/src/database.test.ts` (a newer store is refused and left as it is); `packages/core/src/config.test.ts`; `apps/cli/src/doctor.test.ts` |
| 14 | "stop now" aborts the running turn and "pause" survives a restart; a turn stops at 25 steps | `packages/core/src/session.test.ts` (abort; pause after a restart; **new:** the default limit is 25, and a turn of 30 tool calls ends after 25 model calls); `apps/daemon/src/smoke.test.ts` (pause across a daemon restart) |
| 15 | `jaari update` takes a local snapshot before the swap and rolls back when `jaari doctor` fails after it | `apps/cli/src/update.test.ts` (`pre-update` snapshot before the swap; version and data restored when the check or doctor fails); the owner's update from `0.1.0-beta.2` to `0.1.0-beta.3` on macOS under launchd on 2026-11-20 |
| 16 | `jaari update` installs nothing from a release whose registry signature or provenance does not verify | `apps/cli/src/update.test.ts` (npm is never called when verification fails); `apps/cli/src/verify.test.ts` (signature, attestation, and provenance cases, against the real attestations of `0.1.0-beta.1`) |
| 17 | A key, token, labelled password, or Luhn-valid card number in an owner message is replaced before the transcript and the daily log are written; a commit hash is left alone | `packages/channels/src/scrub.test.ts`; `apps/daemon/src/smoke.test.ts` (the daemon scrubs a pasted key) |
| 18 | Every outbound call goes through `@jaari/http`; the address-class tests deny metadata, link-local, and the daemon's own ports | `packages/http/src/lint.test.ts` and the rule in `eslint.config.js`; `packages/http/src/address.test.ts`; `packages/http/src/egress.test.ts` |
| 19 | The fence-escape corpus cannot open or close a fence; an outbound call carrying the canary is blocked with an audit row; a model call is not scanned | `packages/core/src/fence.test.ts`; `packages/http/src/egress.test.ts`; `apps/daemon/src/smoke.test.ts` (the `leak.blocked` row; **new:** a real HTTP model call through the daemon's own wiring carries the canary, reaches the model server, and writes no `leak.blocked` row. Giving the model client a scanning egress makes this test fail; that was tried and undone) |

## Contradictions fixed in the same change
- **Criterion 7 asked Phase 0 for a check that ADR-079 places in Phase 3.** The criterion said the
  daemon refuses a credential file "in the backup set". ADR-079 (Consequences) says that check
  waits for backup, and Phase 0 has no backup. The clause moved to the Phase 3 exit criteria.
- **The status legend could never let Phase 0 exit.** "Delivered" means a document deliverable, and
  a phase exits when every item is Verified, but the code items of Phase 0 were marked Delivered.
  They are now Verified with a link to this file. Item 0.3 is only documents and stays Delivered,
  and the exit rule says so.
- **`README.md` said "No package exists yet"** and called the config loader a Phase 0 item to come.
  Both were out of date.
- **The install command installed a placeholder.** `README.md` and `guides/install.md` named
  `jaari` without a tag, which is the `0.0.0` name holder while only pre-releases exist. They now
  name `jaari@next`.

## Not shown, and not an exit criterion
- An install, and `jaari update`, under systemd on a real Linux host. CI covers the Compose path on
  Linux, and the owner's runs were on macOS.
- `jaari rollback` after a real update between two published versions. The tests cover it, and the
  automatic undo was shown with a packed build (ADR-124, Consequences).
- Criteria 8 and 12 are proven by CI steps and scripts, not by Vitest tests.

## Threat model review
Every row of `THREAT_MODEL.md` was read against what Phase 0 built (ADR-079 to ADR-081, ADR-104,
and ADR-105 to ADR-124). Changes:
- **Update channel:** the controls that ADR-123 and ADR-124 built are named, with what is left
  over: the first install, which only npm checks, and an image, which the owner verifies by hand.
- **New rows:** the GitHub release notes, which are text from outside that `jaari update` prints;
  and `jaari uninstall --purge` on the wrong folder.
- **Pasted secret, and Jaari itself:** each row now says what is not built yet (the exact-value
  match and message deletion until 3.3; the budget until 1.11).
- **New gap:** another program that runs as the owner's OS account. File modes stop other accounts
  only, and Jaari finds `npm` and the OS power tools by name on `PATH`.

No other Phase 0 decision adds a capability, an adapter, a channel, a provider, or an input from
outside, so none needs a row (`DEVELOPMENT.md`, Threat model).

## Reopened items, checked on 2026-11-21
The owner reopened the gate on 2026-11-20 (0.19, 0.20) and moved it to Docker on 2026-11-21: Docker
Compose is the main install on every host, and bare metal waits (ADR-128); 0.19 is On request.

| # | Criterion (short) | Evidence |
|---|---|---|
| 20 | `scripts/check-update.mjs --docker` updates the image with `up --wait` and goes back with the data from before, on the owner's local Docker | Run on Docker Desktop for macOS on 2026-11-21: every check passes. The image update comes up healthy; after `down`, the latest snapshot is by the new version (ADR-129), `admin rollback --yes` restores it, and the old image comes back healthy. `apps/daemon/src/smoke.test.ts` covers the copy at a version change, and fails when that check is turned off (tried and undone) |
| 21 | On Linux, macOS, and Windows, the `compose.yaml` that `jaari init` writes comes up, `jaari doctor` passes, and the chat works with `docker compose exec` | `scripts/check-release.sh` runs `jaari init` inside the image, `up --wait`, `admin doctor`, and (**new**) a chat with `pause` and `resume` through `docker compose exec`, which code answers with no model call. **Linux:** CI runs it on every pull request. **macOS:** passed on Docker Desktop on 2026-11-21, with the data in the named volume that `jaari init` chose (ADR-130), and an install with a key file passed `admin doctor`. **Windows:** not run |

### Threat model review for these items
Rows read against ADR-125 to ADR-130. Changes since the first review:
- **New row:** the one-off `data` step, which runs as root with only `CHOWN` and `FOWNER` where the
  data is in a volume (ADR-130).
- **Windows named pipe** (ADR-125): the row stays unproven; 0.19 is On request.
- ADR-126 (a test script that never ships), ADR-127 (a health check that runs `jaari doctor`),
  ADR-128 (a plan), and ADR-129 (`last-version` in the owner-only data folder) add no capability,
  channel, provider, or input from outside.
