# Installing Jaari

Jaari needs Node 26 or later for the npm install, or Docker with Compose on a Linux server
(ADR-056, ADR-122, ADR-123). It is early software: Phase 0 gives you the daemon and a chat in the
terminal.

## On a laptop: npm

~~~bash
npm install --global --ignore-scripts jaari@next
jaari init
jaari secret set llm.anthropic   # the line `jaari init` prints, if your model needs a key
jaari service install            # start at login
jaari doctor
jaari chat
~~~

`@next` is the pre-release tag. Only pre-releases exist so far, and `jaari` without it installs an
empty placeholder. After the first stable release, leave `@next` out.

Check where the package came from. Its provenance names the repository, the workflow, and the commit
that built it:

~~~bash
npm view jaari@next dist.attestations.provenance.predicateType   # https://slsa.dev/provenance/v1
~~~

The npm page of the version shows the same under "Provenance". `npm audit signatures` does not
work for Jaari: it also looks up the `@jaari/*` packages inside the tarball, which are not
published on their own (ADR-123), and stops at the first 404.

## On a Linux server: Compose

Run these as the account that will own Jaari, not as root. Replace `VERSION`.

~~~bash
mkdir -m 700 ~/.jaari
jaari() { docker run --rm -it --user "$(id -u):$(id -g)" --env HOME=/home/jaari \
  --volume "$HOME/.jaari:/home/jaari/.jaari" ghcr.io/jaari-ai/jaari:VERSION jaari "$@"; }
jaari init                       # writes ~/.jaari/compose.yaml
jaari secret set llm.anthropic   # the line `jaari init` prints, if your model needs a key
cd ~/.jaari
docker compose up --wait --wait-timeout 180
docker compose run --rm admin doctor
docker compose exec jaari jaari chat
~~~

Check the image signature first if you have `cosign`:

~~~bash
cosign verify ghcr.io/jaari-ai/jaari:VERSION \
  --certificate-identity https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/tags/vVERSION \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
~~~

To roll the data back: `docker compose down`, then `docker compose run --rm admin rollback`.

## Updating

On a laptop (npm install):

~~~bash
jaari update --check   # what is available, and what changed
jaari update           # verify, install beside the running version, check, and undo on failure
~~~

`jaari update` checks that the npm registry signed the package and that this repository's release
workflow built it from the tag of that version. Under launchd it stops and starts the daemon by
itself. Otherwise stop the daemon first (`sudo systemctl stop jaari.service`) and start it after.
To go back later: stop the daemon, then `jaari rollback`. It restores the data and the version
from before the update.

Betas: set `"update": { "channel": "beta" }` in the config, or pass `--channel beta`.

After the switch, `jaari update` waits up to 120 seconds for the new daemon to answer before it
counts the update as failed and undoes it. On a slow or busy machine, give it longer:
`jaari update --wait 300`. On a fast one you can shorten it, for example `--wait 30`. The value is
whole seconds, from 1 to 3600, and the undo waits as long.

The first release, `0.1.0-beta.1`, has no `jaari update`: install the next one once with
`npm install --global --ignore-scripts jaari@next`.

On macOS, up to `0.1.0-beta.4`, `jaari service install` marked the daemon as a background job,
which macOS slows down on a busy Mac, and `jaari update` waited only 15 seconds for it to start.
From one of those versions, update while the Mac is not busy (no build or emulator running), then
run `jaari service install` once with the new version, so that the service file is rewritten. On
Linux the systemd unit runs at normal priority, and you stop and start the daemon yourself around
an update, so nothing changes there.

Under Compose the image is the version. Replace `OLD` and `NEW`:

~~~bash
cd ~/.jaari
cosign verify ghcr.io/jaari-ai/jaari:NEW \
  --certificate-identity https://github.com/jaari-ai/jaari/.github/workflows/release.yml@refs/tags/vNEW \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com
sed -i.bak 's#jaari-ai/jaari:OLD#jaari-ai/jaari:NEW#' compose.yaml
docker compose up --wait --wait-timeout 180   # the new daemon snapshots the data before it migrates a store
docker compose run --rm admin doctor
~~~

If `up --wait` or `doctor` fails, go back: `docker compose down`, `mv compose.yaml.bak compose.yaml`,
`docker compose run --rm admin rollback --yes`, `docker compose up --wait --wait-timeout 180`.
On a slow host, raise `--wait-timeout`, and `start_period` in `compose.yaml` (`jaari init` keeps an edited file).

## Removing Jaari

~~~bash
jaari uninstall          # the service and the installed versions; the config and the data stay
jaari uninstall --purge  # also the data, after you type "delete"
npm uninstall --global jaari
~~~

## Cutting a release (the owner)

1. Merge `develop` into `main`.
2. On npmjs.com, set up the trusted publisher (`namespaces.md`, part 7). It expires if no publish
   succeeds within 2 days, so do this right before step 3.
3. Tag and push: `git tag -s v0.1.0-beta.1 -m "v0.1.0-beta.1" && git push origin v0.1.0-beta.1`.
4. In GitHub Actions, approve the `release` environment.
5. Approve the staged version on npm with 2FA: `npm stage list jaari`, then
   `npm stage approve <stage-id>`.
6. If `npm stage approve` answers `409 ... automated review hasn't finished`, wait a few minutes
   and run it again.
7. Publish the release notes, a draft until now: `gh release edit vVERSION --draft=false`. If
   you rejected the staged version instead, delete the draft: `gh release delete vVERSION`.
8. **First release only:** GitHub creates the image as private. Open the package
   `jaari` under the `jaari-ai` organization, then Package settings, and change the visibility to
   Public.
