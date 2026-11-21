# Installing Jaari

Jaari runs in Docker with Compose on Linux, macOS, and Windows: that is the main install, and every
check runs there (ADR-128). Installing it from npm on the host, under launchd or systemd, is optional
until it is confirmed for that system ([HOSTS.md](../HOSTS.md)). It is early software: Phase 0 gives
you the daemon and a chat in the terminal.

## With Docker (Linux, macOS, Windows)

You need Docker Engine 25 or later with Compose on Linux, or Docker Desktop on macOS or Windows. On
Windows, run the commands in a WSL 2 shell with Docker Desktop's WSL integration turned on (not tested
yet). Run them as the account that will own Jaari, not as root. Replace `VERSION`. When `jaari init`
asks where Jaari runs, answer `server` or `home`: the laptop features (keeping the computer awake for
a turn, the battery) do not work in a container.

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

On Docker Desktop, `jaari init` puts the data folder in a Docker volume, because a folder shared from
macOS or Windows cannot keep the chat socket private (ADR-130). You don't see the data in Finder or
Explorer; `docker compose run --rm admin …` reaches it. `docker compose down --volumes` deletes that
volume, and with it the data: use it only to remove Jaari.

After you edit `config.jsonc`, restart with `docker compose up --wait --force-recreate`: Compose
mounts the file on its own, and some editors replace it with a new file that a running container does
not see.

To roll the data back: `docker compose down`, then `docker compose run --rm admin rollback`.

## On a real host: npm (optional)

This needs Node 26 or later. It runs Jaari under launchd on macOS or systemd on Linux, and is not
yet confirmed on either ([HOSTS.md](../HOSTS.md)).

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

On macOS (launchd), the update starts the daemon itself after the switch. There, `jaari update`
waits up to 120 seconds for the new daemon to answer before it counts the update as failed and
undoes it. On a slow or busy machine, give it longer: `jaari update --wait 300`. On a fast one
you can shorten it, for example `--wait 30`. The value is whole seconds, from 1 to 3600, and the
undo waits as long. Under systemd, or without a service, you start the daemon yourself after the
update, so there is nothing to wait for.

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
docker compose up --wait --wait-timeout 180   # the new daemon copies the data before it changes anything
docker compose run --rm admin doctor
~~~

If `up --wait` or `doctor` fails, or you want the old version back later:

~~~bash
docker compose down
docker compose run --rm admin rollback --list   # still with the new tag
mv compose.yaml.bak compose.yaml
docker compose run --rm admin rollback --yes    # only when the last line of --list ends with "by NEW"
docker compose up --wait --wait-timeout 180
~~~

The new daemon copies the data when it first starts, and the copy says `by NEW` (ADR-129). When the
last line of `--list` names another version, the new daemon never started, so the data is still the
old image's: skip `rollback --yes`, because it would restore an older copy.
On a slow host, raise `--wait-timeout`, and `start_period` in `compose.yaml` (`jaari init` keeps an edited file).

## Removing Jaari

~~~bash
jaari uninstall          # the service and the installed versions; the config and the data stay
jaari uninstall --purge  # also the data, after you type "delete"
npm uninstall --global jaari
~~~

Under Compose, in the Jaari folder: `docker compose down` stops Jaari and keeps the data. To delete
the data too: `docker compose down --volumes`, then remove the Jaari folder (`~/.jaari`). This cannot
be undone.

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
