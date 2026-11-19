# ADR-123: The release as built: one npm tarball with its internal packages inside, an image made from that tarball, staged npm approval, and one Compose secret per credential

- **Status:** Accepted
- **Extended by:** [ADR-124](124-update-as-built.md)
- **Date:** 2026-11-18

Roadmap 0.17 builds the release that [ADR-122](122-install-in-three-steps.md) planned. Building it
showed gaps in [ADR-056](056-install-update-migrate.md), [ADR-079](079-secret-zero-on-servers.md),
[ADR-094](094-sandbox-under-compose.md), and [ADR-043](043-project-process.md). This ADR decides
them and amends all four.

## Decision
1.  **One public npm package.** `scripts/pack-release.mjs <version>` builds `jaari`. The
    `@jaari/*` packages that the two programs need travel inside it (`bundleDependencies`), so
    none is published on its own. They list no dependencies of their own: npm would count those
    as bundled and never download them. The root package lists every third-party dependency.
2.  **A shrinkwrap fixes every third-party version.** The tarball carries `npm-shrinkwrap.json`,
    made when it is packed from versions at least seven days old (ADR-043). Install scripts stay
    off in the image and the guide (`--ignore-scripts`). Two dependencies declare one
    (`@google/genai`, `protobufjs`); both were reviewed and neither is needed.
3.  **The image is made from that tarball.** `docker/Dockerfile` installs it on a Node image pinned
    by digest and removes npm. It is built for amd64 and arm64, runs as a non-root user, and carries
    build provenance and an SBOM.
4.  **Approval has two steps on npm.** The `release` GitHub environment approves the jobs. `npm
    stage publish` then waits for the owner's approval with 2FA on npm, so a compromised GitHub
    account cannot publish alone. A version with a `-` goes to the `next` tag, any other to
    `latest`; the image follows the same rule.
5.  **The image is signed by digest** with `cosign` and the workflow's identity, and the workflow
    verifies the signature before it ends. A tag whose commit is not on `main` stops the release.
6.  **`jaari init` writes `compose.yaml`** when the target is not a laptop and secrets are in
    `host-credential`. It runs the image of this exact version as the owner's numeric account, so
    the owner-only files keep their owner; `init` refuses to write it as root. It writes no file
    from a checkout (version `0.0.0`), and an edited file is kept, with the new one beside it as
    `compose.yaml.new`. A server may also run Jaari under systemd, so `init` names both ways and
    the unused file does no harm. Its messages name no path, because it may run inside the
    container.
7.  **One Compose secret per credential.** ADR-079 names one file, `jaari-secret-zero`. Phase 0 has
    no vault yet, so each model key is its own credential, mounted at `/run/secrets/<name>`, which
    is where `host-credential` reads it. The credentials folder itself is not mounted.
8.  **The daemon container** has the ADR-094 limits that apply today: read-only root, `tmpfs` for
    `/tmp`, `cap_drop: ALL`, `no-new-privileges`, a process limit, a memory limit, and only the
    read-only config, the data folder, and its secrets. The bubblewrap seccomp and AppArmor
    profiles ship with the first sandbox (4.7): until then Docker's defaults apply.
9.  **Admin commands run in a second service,** `admin`, under a Compose profile: the same limits,
    no network, and the Jaari folder mounted. `docker compose run --rm admin doctor` works beside
    the running daemon, and `rollback` can replace the config, which the daemon cannot touch.
10. **`jaari doctor` reads more without root:** whether the data folder is on an encrypted Linux
    volume (`findmnt`, `lsblk`), whether the host has a TPM (`systemd-creds has-tpm2`; it cannot tell
    how an existing credential was sealed), and the credentials that Compose
    hands over (`$CREDENTIALS_DIRECTORY`).
11. **PyPI is published only when its own version is the tag.** It holds the name (ADR-056), so a
    normal release skips it. This replaces the lockstep of ADR-043 for PyPI, and the private
    `@jaari/*` packages share the version inside the tarball.

## Alternatives rejected
- **Publishing each `@jaari/*` package:** eight first publishes by hand and eight trusted
  publishers, for packages nobody installs alone.
- **Bundling everything into one JavaScript file:** two packages read files beside their code, and
  a new build tool would be one more dependency.
- **Bundling the third-party packages too:** the keychain package ships one binary per platform,
  and a tarball packed on one machine would hold only that machine's.
- **Direct `npm publish`:** the GitHub reviewer would be the only approval.
- **A signing key in a secret:** see ADR-122.
- **Mounting the credentials folder:** the daemon would see keys it was not given.

## Amendments
- **ADR-124:** the two commands of the tarball are launchers, and the release workflow creates
  the GitHub release whose notes `jaari update` shows.

## Consequences
- GitHub makes a new container package **private**. After the first release the owner makes
  `jaari` public once, in the package settings (`docs/guides/install.md`).
- CI runs `scripts/check-release.sh` on every pull request: the tarball installs from nothing and
  the daemon starts from it, and on Linux the generated `compose.yaml` comes up and `doctor` passes
  beside the daemon. Docker on macOS cannot set the mode of a socket in a shared folder, so Compose
  is for Linux hosts.
- A model server on `localhost` is out of reach from the container; `jaari init` says so.
- `CHANGELOG.md` (ADR-043) is not generated yet; it moves to roadmap 0.18 with the release notes
  that `jaari update` shows.
- First release (2026-11-19): `v0.1.0-beta.1`, npm `next` with SLSA provenance, and a signed image
  that verifies. Two things the docs did not say: a trusted publisher whose fields do not match
  fails as `E401` (the exchange error is logged only at `verbose`), and `npm audit signatures`
  stops at the bundled packages, so the guide checks the provenance with `npm view`.
