#!/usr/bin/env bash
# Packs a release as the workflow does, then proves what an owner gets: the tarball installs from nothing and the
# daemon starts from it, and the image starts as `compose.yaml` runs it (ADR-122). Publishes nothing. `pnpm -r build` first.
set -euo pipefail
version=0.0.0-check.1
root="$(cd "$(dirname "$0")/.." && pwd)"
work="$(mktemp -d /tmp/jaari-release.XXXXXX)" # short: the daemon's socket path has a length limit
trap 'docker rmi --force jaari:check >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
cd "$root"
rm -rf dist/npm
tarball="$(node scripts/pack-release.mjs "$version")"

npm install --global --prefix "$work/prefix" --ignore-scripts --no-audit --no-fund "$tarball" >/dev/null
# --home: an empty Jaari folder. Without it, the launcher would run the active version of the owner's own ~/.jaari.
test "$("$work/prefix/bin/jaari" --version --home "$work/none")" = "$version"
mkdir -m 700 "$work/credentials" "$work/data"
(umask 077 && echo smoke > "$work/credentials/llm.local")
"$work/prefix/bin/jaari-daemon" --check --home "$work/none" --config apps/daemon/smoke.config.json --data "$work/npm-data" --credentials "$work/credentials"

command -v docker >/dev/null || { echo "docker is not installed: the image was not checked"; exit 0; }
docker build --quiet --file docker/Dockerfile --tag jaari:check . >/dev/null
# Docker on macOS cannot set the mode of a socket in a shared folder, so the data stays in the VM there.
if [ "$(uname)" = Linux ]; then data=(--volume "$work/data:/home/jaari/.jaari/data"); else data=(--tmpfs "/home/jaari/.jaari/data:uid=$(id -u),gid=$(id -g),mode=0700"); fi
run=(docker run --rm --user "$(id -u):$(id -g)" --read-only --tmpfs /tmp --cap-drop ALL --security-opt no-new-privileges
  --env CREDENTIALS_DIRECTORY=/run/secrets
  --volume "$root/apps/daemon/smoke.config.json:/home/jaari/.jaari/config.jsonc:ro"
  "${data[@]}"
  --volume "$work/credentials/llm.local:/run/secrets/llm.local:ro")
test "$("${run[@]}" jaari:check jaari --version)" = "$version"
"${run[@]}" jaari:check jaari-daemon --check

# The file an owner gets, run as an owner runs it: `jaari init` inside the image, `docker compose up`, then `doctor`
# beside the daemon. Where the host folder is shared into Docker's Linux machine (macOS, Windows), init puts the data
# in a named volume (ADR-130).
docker tag jaari:check "ghcr.io/jaari-ai/jaari:$version"
mkdir -m 700 "$work/home"
printf '%s\n' server host-credential "" local "" smoke http://192.0.2.1:11434/v1 | docker run --rm -i --user "$(id -u):$(id -g)" \
  --env HOME=/home/jaari --volume "$work/home:/home/jaari/.jaari" "ghcr.io/jaari-ai/jaari:$version" jaari init >/dev/null
compose=(docker compose --project-directory "$work/home" --file "$work/home/compose.yaml" --project-name jaari-check)
trap '"${compose[@]}" down --volumes >/dev/null 2>&1 || true; docker rmi --force jaari:check "ghcr.io/jaari-ai/jaari:$version" >/dev/null 2>&1 || true; rm -rf "$work"' EXIT
"${compose[@]}" up --wait --wait-timeout 180 --quiet-pull || { "${compose[@]}" logs; exit 1; }
"${compose[@]}" run --rm admin doctor || { "${compose[@]}" logs; exit 1; }
# The chat through `docker compose exec`, as the guide has it: "pause" and "resume" are read by code and answered with
# no model call (ADR-116); the pauses keep the input open until each answer is back.
said=$( { echo pause; sleep 3; echo resume; sleep 3; } | "${compose[@]}" exec -T jaari jaari chat)
printf '%s\n' "$said"
grep -q '^\[2\] jaari: ' <<<"$said" && grep -q '^\[4\] jaari: ' <<<"$said" || { echo "the chat did not answer pause and resume"; exit 1; }
# The image installs every tarball in the folder, so a second pack must leave exactly one.
node scripts/pack-release.mjs 0.0.0-check.2 >/dev/null
test "$(ls dist/npm)" = jaari-0.0.0-check.2.tgz
test "$(tar -xzOf dist/npm/jaari-0.0.0-check.2.tgz package/node_modules/@jaari/channels/package.json | grep -c '"version": "0.0.0-check.2"')" -eq 2 # the package and its manifest

# The launcher (ADR-124): install the second version where `jaari update` puts one and make it active. The commands
# of the first install then run the second, and run their own again when the link is gone.
later="$work/later"
mkdir -m 700 "$later"
npm install --global --prefix "$later/versions/0.0.0-check.2" --ignore-scripts --no-audit --no-fund dist/npm/jaari-0.0.0-check.2.tgz >/dev/null
cli="$work/prefix/lib/node_modules/jaari/node_modules/@jaari/cli/dist"
node --input-type=module -e 'await (await import(process.argv[1])).activate(process.argv[2], "0.0.0-check.2", null)' "$cli/versions.js" "$later"
test "$("$work/prefix/bin/jaari" --version --home "$later")" = 0.0.0-check.2
"$work/prefix/bin/jaari-daemon" --check --home "$later" --config apps/daemon/smoke.config.json --data "$work/later-data" --credentials "$work/credentials"
node --input-type=module -e 'await (await import(process.argv[1])).swapBack(process.argv[2])' "$cli/versions.js" "$later"
test "$("$work/prefix/bin/jaari" --version --home "$later")" = "$version"
echo "release check passed"
