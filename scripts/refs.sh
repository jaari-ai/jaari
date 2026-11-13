#!/usr/bin/env bash
# scripts/refs.sh: manage read-only reference repos under refs/ (ADR-002).
#
#   scripts/refs.sh [sync] [name...]   clone or update to the pinned ref, then lock
#   scripts/refs.sh bump [name...]     move the pin to the latest default-branch commit (ADR-083)
#   scripts/refs.sh status             commit, date, lock state, license per ref
#   scripts/refs.sh lock [name...]     make read-only (default: all)
#   scripts/refs.sh unlock <name...>   make writable (rarely needed; re-lock after)
#   scripts/refs.sh remove <name...>   delete a ref
#
# Env:
#   REFS_DEPTH=1        history depth (0 = full history)
#   REFS_LIST=<file>    use this manifest instead of the inline one
set -euo pipefail

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
cd "$(git rev-parse --show-toplevel)"
REFS_DIR="refs"
DEPTH="${REFS_DEPTH:-1}"

# name            url                                          ref (pinned full sha; move it only with `bump`, ADR-083)
MANIFEST=$(cat <<'EOF'
pi                https://github.com/earendil-works/pi.git            469d8651b59069d7bd907c7da84597865e114da6
open-instinct     https://github.com/mariagorskikh/open-instinct.git          2e5e71b72622d1262e212da7deb0e785bd95facd
openinstinct      https://github.com/Yeachan-Heo/openinstinct.git           213120cef0c0cb32ab069200e2214577a88ebd9c
gajae-way         https://github.com/Yeachan-Heo/gajae-way.git              34cbd150c88aa7f5475882a9633236f77c02fcdd
openmausbot       https://github.com/milind-soni/OpenMausBot.git            b8022684d1f519d49a776e00900ae9c65daa357d
EOF
)
if [[ -n "${REFS_LIST:-}" ]]; then
  MANIFEST=$(grep -vE '^[[:space:]]*(#|$)' "$REFS_LIST" || true)
fi

die()  { printf 'error: %s\n' "$*" >&2; exit 1; }
info() { printf '%-16s %s\n' "$1" "$2"; }

usage() {
  cat <<'EOF'
scripts/refs.sh [sync] [name...]   clone or update to the pinned ref, then lock
scripts/refs.sh bump [name...]     move the pin to the latest default-branch commit
scripts/refs.sh status             commit, date, lock state, license per ref
scripts/refs.sh lock [name...]     make read-only (default: all)
scripts/refs.sh unlock <name...>   make writable (re-lock after)
scripts/refs.sh remove <name...>   delete a ref
Env: REFS_DEPTH=1 (0 = full history), REFS_LIST=<manifest file>
EOF
}

valid_name() {
  [[ "$1" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die "bad ref name: $1"
}

ensure_guards() {
  local exclude
  exclude=$(git rev-parse --git-path info/exclude)
  mkdir -p "$(dirname "$exclude")"
  if ! grep -qxE '/?refs/?' "$exclude" 2>/dev/null; then
    echo "/refs/" >> "$exclude"
    echo "added /refs/ to $exclude"
  fi
  if git ls-files --error-unmatch "$REFS_DIR" >/dev/null 2>&1; then
    die "refs/ is tracked by git. Fix with: git rm -r --cached refs"
  fi
  mkdir -p "$REFS_DIR"
}

lock_dir()   { chmod -R a-w "$1"; }
unlock_dir() { chmod -R u+w "$1"; }

license_of() {
  local dir=$1 f
  for f in "$dir"/LICENSE* "$dir"/LICENCE* "$dir"/COPYING* "$dir"/license*; do
    if [[ -f "$f" ]]; then
      grep -m1 -vE '^[[:space:]]*$' "$f" | sed -E 's/^[[:space:]#]+//' | cut -c1-48
      return
    fi
  done
  echo "NONE FOUND (treat as all rights reserved)"
}

check_names() {
  local n
  for n in "$@"; do
    valid_name "$n"
    grep -qE "^[[:space:]]*${n}[[:space:]]" <<<"$MANIFEST" || die "not in manifest: $n"
  done
}

each_ref() {  # each_ref <fn> [names...]: run fn name url ref for (filtered) manifest entries
  local fn=$1; shift
  local name url ref want found
  while read -r name url ref <&3; do
    if [[ -z "$name" || "$name" == \#* ]]; then continue; fi
    if (( $# )); then
      found=0
      for want in "$@"; do
        if [[ "$want" == "$name" ]]; then found=1; fi
      done
      if (( ! found )); then continue; fi
    fi
    "$fn" "$name" "$url" "${ref:--}"
  done 3<<<"$MANIFEST"
}

sync_one() {
  local name=$1 url=$2 ref=$3 dir="$REFS_DIR/$1" target depth_flag=""
  valid_name "$name"
  if [[ "$url" == *OWNER* ]]; then
    info "$name" "skipped: set the real URL in the manifest"
    return 0
  fi
  if [[ "$ref" == "-" ]]; then target=HEAD; else target=$ref; fi

  if [[ -d "$dir/.git" ]]; then
    unlock_dir "$dir"
  else
    git init -q "$dir"
    git -C "$dir" remote add origin "$url"
  fi
  git -C "$dir" remote set-url origin "$url"
  git -C "$dir" remote set-url --push origin PUSH_DISABLED   # refs are never pushed

  if (( DEPTH > 0 )); then
    depth_flag="--depth=$DEPTH"
  elif [[ -f "$dir/.git/shallow" ]]; then
    depth_flag="--unshallow"
  fi

  # shellcheck disable=SC2086
  if ! git -C "$dir" fetch -q --no-tags $depth_flag origin "$target"; then
    lock_dir "$dir"
    die "fetch failed for $name ($target)"
  fi
  git -C "$dir" -c advice.detachedHead=false checkout -q --detach -f FETCH_HEAD
  git -C "$dir" clean -qfdx
  lock_dir "$dir"
  info "$name" "$(git -C "$dir" rev-parse --short HEAD)  $(license_of "$dir")"
}

bump_one() {  # sync to the default branch, then write the new full sha into the manifest line
  local name=$1 url=$2 dir="$REFS_DIR/$1" file="${REFS_LIST:-$SELF}" old_sha=none old_lic=none new_sha new_lic
  if [[ -d "$dir/.git" ]]; then
    old_sha=$(git -C "$dir" rev-parse HEAD)
    old_lic=$(license_of "$dir")
  fi
  sync_one "$name" "$url" - >/dev/null
  new_sha=$(git -C "$dir" rev-parse HEAD)
  new_lic=$(license_of "$dir")
  local line="^(${name}[[:space:]]+[^[:space:]]+[[:space:]]+)[^[:space:]]+[[:space:]]*$"
  [[ $(grep -cE "$line" "$file") == 1 ]] || die "cannot find one manifest line for $name in $file"
  sed -i.bak -E "s|$line|\\1$new_sha|" "$file" && rm -f "$file.bak"
  info "$name" "${old_sha:0:7} -> ${new_sha:0:7}  $new_lic"
  if [[ "$old_lic" != none && "$old_lic" != "$new_lic" ]]; then
    printf 'warning: %s licence changed: "%s" -> "%s". Update AGENTS.md before using it.\n' "$name" "$old_lic" "$new_lic" >&2
  fi
}

write_index() {
  local dir
  {
    echo "# refs/ (read-only reference repos)"
    echo
    echo "Generated by scripts/refs.sh. Never edit, build, lint, test, or copy from anything here."
    echo "openinstinct is a behavioral spec only: do not copy its code (ADR-009)."
    echo
    echo "| Name | Commit | License (first line) | URL |"
    echo "|---|---|---|---|"
    for dir in "$REFS_DIR"/*/; do
      if [[ -d "$dir/.git" ]]; then
        echo "| $(basename "$dir") | $(git -C "$dir" rev-parse --short HEAD) | $(license_of "$dir") | $(git -C "$dir" remote get-url origin) |"
      fi
    done
  } > "$REFS_DIR/INDEX.md"
}

status() {
  local dir name commit date locked
  printf '%-16s %-9s %-11s %-7s %s\n' NAME COMMIT DATE LOCKED LICENSE
  for dir in "$REFS_DIR"/*/; do
    if [[ ! -d "$dir/.git" ]]; then continue; fi
    name=$(basename "$dir")
    commit=$(git -C "$dir" rev-parse --short HEAD 2>/dev/null || echo "?")
    date=$(git -C "$dir" log -1 --format=%cs 2>/dev/null || echo "?")
    if find "$dir" -perm -u+w -print -quit | grep -q .; then locked="NO"; else locked="yes"; fi
    printf '%-16s %-9s %-11s %-7s %s\n' "$name" "$commit" "$date" "$locked" "$(license_of "$dir")"
  done
}

for_dirs() {  # for_dirs <fn> [names...]: default is every dir in refs/
  local fn=$1; shift
  local n dir
  if (( $# )); then
    for n in "$@"; do
      valid_name "$n"
      [[ -d "$REFS_DIR/$n" ]] || die "no such ref: $n"
      "$fn" "$REFS_DIR/$n"
      echo "$fn: $n"
    done
  else
    for dir in "$REFS_DIR"/*/; do
      if [[ -d "$dir" ]]; then "$fn" "${dir%/}"; echo "$fn: $(basename "$dir")"; fi
    done
  fi
}

remove_dir() { unlock_dir "$1"; rm -rf -- "$1"; }

main() {
  local cmd=${1:-sync}
  if (( $# )); then shift; fi
  case "$cmd" in
    sync|update) ensure_guards; check_names "$@"; each_ref sync_one "$@"; write_index ;;
    bump)        ensure_guards; check_names "$@"; each_ref bump_one "$@"; write_index
                 echo "review with: git diff scripts/refs.sh, then commit the new pins" ;;
    status)      status ;;
    lock)        for_dirs lock_dir "$@" ;;
    unlock)      (( $# )) || die "usage: refs.sh unlock <name...>"
                 for_dirs unlock_dir "$@"; echo "remember to re-lock: scripts/refs.sh lock" ;;
    remove)      (( $# )) || die "usage: refs.sh remove <name...>"
                 for_dirs remove_dir "$@"; write_index ;;
    -h|--help|help) usage ;;
    *)           die "unknown command: $cmd (try --help)" ;;
  esac
}

main "$@"
