# Installing Jaari

Jaari needs Node 26 or later for the npm install, or Docker with Compose on a Linux server
(ADR-056, ADR-122, ADR-123). It is early software: Phase 0 gives you the daemon and a chat in the
terminal.

## On a laptop: npm

~~~bash
npm install --global --ignore-scripts jaari
jaari init
jaari secret set llm.anthropic   # the line `jaari init` prints, if your model needs a key
jaari service install            # start at login
jaari doctor
jaari chat
~~~

Pre-releases use the `next` tag: `npm install --global --ignore-scripts jaari@next`.

Check where the package came from (run it in a project that depends on `jaari`):
`npm audit signatures`.

## On a Linux server: Compose

Run these as the account that will own Jaari, not as root. Replace `VERSION`.

~~~bash
mkdir -m 700 ~/.jaari
jaari() { docker run --rm -it --user "$(id -u):$(id -g)" --env HOME=/home/jaari \
  --volume "$HOME/.jaari:/home/jaari/.jaari" ghcr.io/jaari-ai/jaari:VERSION jaari "$@"; }
jaari init                       # writes ~/.jaari/compose.yaml
jaari secret set llm.anthropic   # the line `jaari init` prints, if your model needs a key
cd ~/.jaari
docker compose up -d
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

## Cutting a release (the owner)

1. Merge `develop` into `main`.
2. On npmjs.com, set up the trusted publisher (`namespaces.md`, part 7). It expires if no publish
   succeeds within 2 days, so do this right before step 3.
3. Tag and push: `git tag -s v0.1.0-beta.1 -m "v0.1.0-beta.1" && git push origin v0.1.0-beta.1`.
4. In GitHub Actions, approve the `release` environment.
5. Approve the staged version on npm with 2FA: `npm stage list jaari`, then
   `npm stage approve <stage-id>`.
6. **First release only:** GitHub creates the image as private. Open the package
   `jaari` under the `jaari-ai` organization, then Package settings, and change the visibility to
   Public.
