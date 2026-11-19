# Securing the npm and PyPI namespaces (ADR-010)

**Goal.** Only the project can publish `@jaari/*` and `jaari` on npm, and `jaari` on PyPI.
After the one-time bootstrap, nothing publishes except `.github/workflows/release.yml` in
`jaari-ai/jaari`, through trusted publishing (OIDC). No long-lived registry tokens exist
anywhere.

**Status (checked 2026-11-16 against the public registries).** The names are secured.
npm `jaari` is at `0.0.0` (maintainer `jaari-ai`) and the npm org `jaari` exists, so only the
project can publish `@jaari/*`. PyPI `jaari` is at `0.0.0`, uploaded by `release.yml` in the
`pypi` environment through trusted publishing, with attestations. The org's Actions
allowlist must name the publish action as `pypa/gh-action-pypi-publish@*`: an entry without
`@` does not match a pinned ref, and the run fails at startup.

**Before each part,** check the registry docs; UI labels and version floors change:
[npm trusted publishers](https://docs.npmjs.com/trusted-publishers),
[PyPI trusted publishers](https://docs.pypi.org/trusted-publishers/).

## Order of work

| Part | What | Secures | Time |
|---|---|---|---|
| 1 | Domain and mailbox | Account recovery path | 15 min |
| 2 | Registry accounts with hardware-key 2FA | Account takeover | 20 min |
| 3 | npm org `jaari` | Every `@jaari/*` name | 5 min |
| 4 | npm unscoped `jaari` | `npx jaari` | 10 min |
| 5 | GitHub hardening | Who can trigger a release | 30 min |
| 6 | PyPI `jaari` via pending publisher and first release | PyPI name | 30 min |
| 7 | npm trusted publishing per package | Token-free npm releases | 10 min per package |
| 8 | Verify | | 10 min |

Do parts 3, 4, and 6 the same day: until then anyone can register the names.

---

## Part 1. Domain and mailbox

The registry accounts are only as safe as the inbox that can reset them, and that
inbox is only as safe as the domain.

1. At the `jaari.org` registrar:
   1. Turn on 2FA for the registrar account.
   2. Turn on **registrar lock** (transfer lock) and **auto-renew**, and set a payment
      method that won't expire soon.
   3. If the registrar supports it, turn on DNSSEC.
2. Use **`hello@jaari.org`** for npm, PyPI, and other publishing accounts (ADR-106).
3. Make sure the mail provider account also has 2FA.

## Part 2. Registry accounts

### npm
1. Sign up at <https://www.npmjs.com/signup> with `hello@jaari.org`, or change the
   email on your existing account (Account → Email).
2. Account → **Two-Factor Authentication** → enable, choosing **security key / passkey**
   (WebAuthn). Avoid authenticator-app-only if you can; never SMS.
3. Save the recovery codes in your own password manager (not Jaari's vault, ADR-013).
4. Access Tokens page: delete every existing token.

### PyPI
1. Sign up at <https://pypi.org/account/register/> with `hello@jaari.org`.
2. Account settings → **Two factor authentication** → add a **security key** (and
   optionally a TOTP app as backup). PyPI requires 2FA to publish.
3. Save the recovery codes in your password manager.
4. Account settings → **API tokens**: delete any that exist.

### Backup owner
A single lost security key must not lose the namespace. Either:
- register a **second security key** on each account and store it offline, or
- create a second account (different key, same rules) and add it as owner in parts 3
  and 6.

## Part 3. npm organization `jaari` (protects `@jaari/*`)

1. On npmjs.com, click your avatar → **Add an Organization**.
2. Name: **`jaari`**. Plan: **Unlimited public packages** (free).
3. Skip inviting members, or invite the backup account as **Owner**.
4. Org → Settings: enable the requirement that members use 2FA, if offered.
5. Check: `https://www.npmjs.com/org/jaari` loads while logged in.

From now on nobody else can publish under `@jaari`. You do **not** need placeholder
packages for each `@jaari/<name>`: create each package only when it really exists
(part 7).

If `jaari` is taken as an org or user name, stop and decide a fallback scope (for
example `@jaari-ai`), then update ADR-010 and every `@jaari/` reference in the docs.

## Part 4. npm unscoped `jaari`

The unscoped name is separate from the scope. Claim it with a small, honest pointer
package (pure placeholders can be reclaimed under npm's dispute policy).

1. Log in from your machine (browser login, 2FA):

   ~~~bash
   npm login --auth-type=web
   npm whoami
   ~~~

2. Create the package outside the repo:

   ~~~bash
   mkdir -p ~/tmp/jaari-npm && cd ~/tmp/jaari-npm
   cp ~/Dev/jaari/LICENSE .
   cat > package.json <<'JSON'
   {
     "name": "jaari",
     "version": "0.0.0",
     "description": "Jaari: a self-hosted personal AI agent. Early development; see the repository.",
     "license": "MIT",
     "homepage": "https://jaari.org",
     "repository": { "type": "git", "url": "git+https://github.com/jaari-ai/jaari.git" },
     "files": ["README.md", "LICENSE"]
   }
   JSON
   printf '# jaari\n\nJaari is in early development. See https://github.com/jaari-ai/jaari.\n' > README.md
   npm pack --dry-run      # check that only README.md, LICENSE, package.json are included
   npm publish             # asks for 2FA
   ~~~

3. Check: `npm view jaari` shows version `0.0.0` and your account as maintainer.
4. Package → Settings → **Publishing access** → **Require two-factor authentication and
   disallow tokens** → **Update Package Settings**.
5. `npm logout`.

Later, when the CLI ships as `jaari`, add a trusted publisher to it (part 7).

## Part 5. GitHub hardening (do before any trusted publisher)

With trusted publishing, whoever can make `release.yml` run in `jaari-ai/jaari` can
publish. Lock that down first.

### Organization `jaari-ai`
1. Org → Settings → **Authentication security** → **Require two-factor authentication**.
2. Org → Settings → **Actions → General**:
   - Workflow permissions: **Read repository contents and packages permissions**.
   - Uncheck **Allow GitHub Actions to create and approve pull requests**.
   - Allowed actions: **Allow enterprise/org actions, and select non-org actions**,
     limited to `actions/*`, `pypa/gh-action-pypi-publish@*`, `docker/setup-qemu-action@*`,
     `docker/setup-buildx-action@*`, `docker/login-action@*`, `docker/build-push-action@*`, and
     `sigstore/cosign-installer@*`.

### Repository `jaari-ai/jaari`
1. Settings → **Rules → Rulesets → New branch ruleset** for `main`: require a pull
   request with **0 required approvals** (with one maintainer, GitHub does not let you approve
   your own pull request), block force pushes and deletion. Add the CI checks as required
   status checks once CI exists (roadmap item 0.2).
   Then a second branch ruleset, `develop`, with the same rules: pull requests target
   `develop` (ADR-043). With the CLI:

   ~~~bash
   gh api -X POST repos/jaari-ai/jaari/rulesets --input - <<'JSON'
   {"name":"develop","target":"branch","enforcement":"active",
    "conditions":{"ref_name":{"include":["refs/heads/develop"],"exclude":[]}},
    "rules":[{"type":"deletion"},{"type":"non_fast_forward"},
             {"type":"pull_request","parameters":{"required_approving_review_count":0,
              "dismiss_stale_reviews_on_push":false,"require_code_owner_review":false,
              "require_last_push_approval":false,"required_review_thread_resolution":false}}]}
   JSON
   ~~~
2. Settings → **Rules → Rulesets → New tag ruleset**: target `v*`; restrict
   **creations, updates, deletions**; bypass list: **Repository admin** only.
3. Settings → **Environments → New environment** `release` (npm), then again `pypi`.
   For each:
   - **Required reviewers**: you (and the backup account).
   - **Deployment branches and tags** → **Selected branches and tags** → add tag rule
     `v*`.
   - Add no secrets. None are needed.
4. Settings → **Advanced Security** → **Private vulnerability reporting** → **Enable**, the
   first reporting route in `SECURITY.md` (ADR-043). With the CLI:
   `gh api -X PUT repos/jaari-ai/jaari/private-vulnerability-reporting`.
5. Add `.github/CODEOWNERS`:

   ~~~text
   /.github/workflows/  @<your-github-login>
   ~~~

6. Add `.github/dependabot.yml` so pinned action SHAs and npm dependencies get weekly update
   pull requests into `develop`, with a 7-day cooldown (ADR-107; the file in the repo is the
   source). Then, under **Settings → Advanced Security**, turn on Dependabot alerts, secret
   scanning, and push protection; leave Dependabot security updates off.

Rules for `release.yml`, now and later:
- Pin every action to a full commit SHA (`uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1`).
- Trigger only on `push` of `v*` tags (and optionally `workflow_dispatch`). Never
  `pull_request_target`.
- GitHub-hosted runners only. npm trusted publishing does not support self-hosted runners.
- Build in one job; publish in separate jobs that only download the built artifacts, so
  no build script runs with `id-token: write`.

## Part 6. PyPI `jaari`

PyPI can create a project on its first trusted publish, so no token is ever needed. The
name is only secured once that first publish succeeds.

### 6.1 Add the pending publisher
1. PyPI → your account → **Publishing** (account sidebar, not a project page).
2. Choose **GitHub**, fill in:
   - PyPI Project Name: `jaari`
   - Owner: `jaari-ai`
   - Repository name: `jaari`
   - Workflow name: `release.yml`
   - Environment name: `pypi`
3. Click **Add**.

### 6.2 Add a minimal Python package to the repo
Jaari is TypeScript, so this is a small pointer package under `python/` (add `python/`
to the layout tables in README.md and AGENTS.md when you create it).

~~~text
python/
  pyproject.toml
  README.md
  LICENSE            (copy of the root LICENSE)
  src/jaari/__init__.py
~~~

`python/pyproject.toml`:

~~~toml
[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "jaari"
version = "0.0.0"
description = "Jaari: a self-hosted personal AI agent. Early development; see the repository."
readme = "README.md"
license = "MIT"
requires-python = ">=3.9"

[project.urls]
Homepage = "https://jaari.org"
Source = "https://github.com/jaari-ai/jaari"
~~~

`python/src/jaari/__init__.py`:

~~~python
__version__ = "0.0.0"
~~~

### 6.3 Add the release workflow
`.github/workflows/release.yml` mirrors the text shown here; keep the two in sync. Actions are pinned to the commit of their latest release as of 2026-11-05
(tag in the comment); Dependabot (part 5) proposes updates:

~~~yaml
# The same text is shown in docs/guides/namespaces.md §6.3.
# A `v*` tag builds one npm tarball and one image from it (ADR-122). Nothing is public until the `release`
# environment is approved, and the npm version only after a second approval with 2FA on npm (`npm stage`).
name: release
on:
  push:
    tags: ["v*"]

permissions:
  contents: read

jobs:
  build:
    runs-on: ubuntu-latest
    outputs:
      version: ${{ steps.version.outputs.version }}
      npm_tag: ${{ steps.version.outputs.npm_tag }}
      image_tags: ${{ steps.version.outputs.image_tags }}
      pypi: ${{ steps.version.outputs.pypi }}
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { persist-credentials: false, fetch-depth: 0 }
      - name: A release comes from main
        run: git merge-base --is-ancestor "$GITHUB_SHA" origin/main
      - id: version
        name: Read the version from the tag
        run: |
          version="${GITHUB_REF_NAME#v}"
          [[ "$version" =~ ^[0-9]+\.[0-9]+\.[0-9]+(-[0-9A-Za-z.-]+)?$ ]] || { echo "not a release tag: $GITHUB_REF_NAME"; exit 1; }
          image="ghcr.io/jaari-ai/jaari"
          if [[ "$version" == *-* ]]; then npm_tag=next; tags="$image:$version"; else npm_tag=latest; tags="$image:$version,$image:latest"; fi
          # PyPI `jaari` only holds the name (ADR-056): it is published when its own version is the one tagged.
          pypi=false; grep -qx "version = \"$version\"" python/pyproject.toml && pypi=true
          { echo "version=$version"; echo "npm_tag=$npm_tag"; echo "image_tags=$tags"; echo "pypi=$pypi"; } >> "$GITHUB_OUTPUT"
      - uses: actions/setup-python@6d4fd22b20465ccc0f7354476588e8df7c9ca0e0 # v7.1.0
        with: { python-version: "3.12" }
      - run: python -m pip install build && python -m build python --outdir dist/pypi
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with: { node-version: "26", package-manager-cache: false }
      - run: npm install -g "$(node -p 'require("./package.json").packageManager')"
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint && pnpm typecheck && pnpm test
      - run: pnpm -r build
      - run: scripts/check-release.sh
      - run: node scripts/pack-release.mjs "$VERSION"
        env:
          VERSION: ${{ steps.version.outputs.version }}
      - uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2
        with: { name: dist, path: dist/ }

  publish-pypi:
    needs: build
    if: needs.build.outputs.pypi == 'true'
    runs-on: ubuntu-latest
    environment: pypi
    permissions:
      contents: read
      id-token: write
    steps:
      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with: { name: dist, path: dist/ }
      - uses: pypa/gh-action-pypi-publish@7245906fb61fa33a13554f9d5fb856fe61758086 # v1.14.3; attestations are on by default
        with: { packages-dir: dist/pypi/ }

  publish-npm:
    needs: build
    runs-on: ubuntu-latest
    environment: release
    permissions:
      contents: read
      id-token: write # trusted publishing, which also adds the provenance
    steps:
      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with: { name: dist, path: dist/ }
      - uses: actions/setup-node@949feb2413d6458794dcd2491c4babbbce0c15c1 # v7.1.0
        with:
          node-version: "26"
          registry-url: "https://registry.npmjs.org"
          package-manager-cache: false
      - run: npm stage publish "./dist/npm/jaari-$VERSION.tgz" --access public --tag "$NPM_TAG"
        env:
          VERSION: ${{ needs.build.outputs.version }}
          NPM_TAG: ${{ needs.build.outputs.npm_tag }}

  publish-image:
    needs: build
    runs-on: ubuntu-latest
    environment: release
    permissions:
      contents: read
      packages: write
      id-token: write # the workflow's identity signs the image; no key is stored
    steps:
      - uses: actions/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1 # v7.0.1
        with: { persist-credentials: false }
      - uses: actions/download-artifact@9000827ccba6bdab643e8b6fd33ac0654aef8333 # v8.0.2
        with: { name: dist, path: dist/ }
      - uses: docker/setup-qemu-action@99012661954931238ded8c8b007157a8430204e1 # v4.4.0
      - uses: docker/setup-buildx-action@f87e5991a6d7451dcb8d9637bfbc97413f497069 # v4.4.1
      - uses: docker/login-action@8aa5831fb8d48d8f76594c7ddde61ae58019f550 # v4.8.0
        with:
          registry: ghcr.io
          username: ${{ github.actor }}
          password: ${{ github.token }}
      - id: push
        uses: docker/build-push-action@c3c9e263c25d99ce0380d002d59b67737d91b0dc # v7.4.0
        with:
          context: .
          file: docker/Dockerfile
          platforms: linux/amd64,linux/arm64
          push: true
          tags: ${{ needs.build.outputs.image_tags }}
          provenance: mode=max
          sbom: true
      - uses: sigstore/cosign-installer@756fe2d284c7292c4e9b62c8a28f1e5629c59532 # v4.1.3
      - name: Sign the image by digest, and prove the signature verifies
        env:
          IMAGE: ghcr.io/jaari-ai/jaari@${{ steps.push.outputs.digest }}
          IDENTITY: https://github.com/${{ github.repository }}/.github/workflows/release.yml@${{ github.ref }}
        run: |
          cosign sign --yes "$IMAGE"
          cosign verify "$IMAGE" --certificate-identity "$IDENTITY" --certificate-oidc-issuer https://token.actions.githubusercontent.com > /dev/null
~~~

### 6.4 First release
1. Merge `python/` and the workflow to `main` through a PR.
2. Tag and push (admins only, part 5):

   ~~~bash
   git tag -s v0.0.0 -m "v0.0.0: claim namespaces"
   git push origin v0.0.0
   ~~~

3. In Actions, approve the `pypi` environment when it asks.
4. Check <https://pypi.org/project/jaari/>: version `0.0.0`; the file details show it
   was published via trusted publishing, with attestations.
5. Project → **Collaborators**: add the backup account as **Owner**.

If the pending publisher was invalidated (someone registered `jaari` first), stop and
open a PEP 541 request or pick a fallback name, then update ADR-010.

## Part 7. npm trusted publishing

Only the unscoped `jaari` is published: it carries the `@jaari/*` packages inside it (ADR-122,
ADR-123). It already exists on npm. A new trusted-publisher configuration **expires if no publish
succeeds within 2 days**, so set it up right before the first release
([install guide](install.md), "Cutting a release").

1. npmjs.com → package `jaari` → **Settings** → **Trusted Publisher** → **GitHub Actions**:
   - Organization or user: `jaari-ai`
   - Repository: `jaari`
   - Workflow filename: `release.yml`
   - Environment name: `release`
   - Allowed actions: `npm stage publish` only. Leave `npm publish` and **Allow npm dist-tag** off.

   Fields are case-sensitive and npm does not validate them on save.
2. Cut the release. CI stages it; approve it with 2FA: `npm stage list jaari`, then `npm stage
   approve <stage-id>`.
3. Package → Settings → **Publishing access** → **Require two-factor authentication and
   disallow tokens** → **Update Package Settings**.

## Part 8. Verify

~~~bash
npm view jaari --json | jq '.maintainers, .dist.attestations'
npm audit signatures            # inside a project that depends on @jaari packages
curl -s https://pypi.org/pypi/jaari/json | jq '.info.version'
~~~

Checklist (completed 2026-11-16; owner-only items confirmed by the owner):
- [x] npm org `jaari` exists; you (and the backup) are owners.
- [x] npm `jaari` published; tokens disallowed.
- [x] PyPI `jaari` published by trusted publisher; backup owner added.
- [x] No API tokens on either account.
- [x] Rulesets for `main`, `develop`, and `v*` tags; environments, CODEOWNERS, Dependabot in place.
- [x] Private vulnerability reporting enabled.
- [x] [INTEGRATIONS.md](../INTEGRATIONS.md) status row updated.

**Every quarter:** re-check owners and tokens on both registries, the domain expiry
date, that environments still require a reviewer, and that actions are SHA-pinned.

## Troubleshooting

| Symptom | Cause |
|---|---|
| npm `E404 Not Found` on publish | Trusted-publisher fields don't match exactly (owner, repo, workflow filename, environment; case-sensitive), or the job lacks `id-token: write` |
| npm publish fails with OIDC configured | npm CLI below 11.5.1 or Node below 22.14 on the runner |
| npm config disappeared | Expired: no successful publish within 2 days. Delete it, recreate, publish within 2 days |
| Called via `workflow_call` / `workflow_dispatch` | npm validates the calling workflow's filename; both workflows need `id-token: write` |
| PyPI `invalid-publisher` | Owner, repo, workflow, or environment mismatch, or the pending publisher was invalidated |
| No npm provenance | Repository is private, or the package is private |

## If something leaks or an account is compromised
1. Disable the release environments (Settings → Environments) to stop publishing.
2. Reset the registry account password, revoke all sessions and tokens, re-register
   security keys.
3. Check recent versions on npm and PyPI; deprecate (npm) or yank (PyPI) anything you
   didn't release, and publish a fixed version.
4. Publish a GitHub security advisory and follow `SECURITY.md` (ADR-043; the file lands with
   the Phase 0 scaffolding).

## Jaari itself
Publishing is the `publish` capability and goes through `@jaari/gate` (ADR-006). The
agent never holds registry credentials: at most it proposes a release tag (`repo.write`,
gated), and the owner-approved workflow publishes.
