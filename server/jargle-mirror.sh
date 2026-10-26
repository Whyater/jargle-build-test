#!/usr/bin/env bash
set -euo pipefail

DOWNLOADS_DIR=/var/www/jargle/downloads
STATE_DIR=/var/lib/jargle
API_URL=https://api.github.com/repos/Whyater/Jargle/releases?per_page=20

log() {
    echo "jargle-mirror: $*"
}

# Keep downloaded files owned by jargle when invoked by root.
if [[ $(id -u) -eq 0 ]]; then exec runuser -u jargle -- "$0" "$@"; fi
cd /

release_file=""
selected_file=""
etag_new="$STATE_DIR/mirror-etag.new"
cleanup() {
    [[ -n "$release_file" ]] && rm -f "$release_file"
    [[ -n "$selected_file" ]] && rm -f "$selected_file"
    rm -f "$etag_new"
    return 0
}
trap cleanup EXIT

mkdir -p "$DOWNLOADS_DIR" "$STATE_DIR"
exec 9>"$STATE_DIR/mirror.lock"
if ! flock -n 9; then
    log "another mirror is already running"
    exit 0
fi

release_file=$(mktemp "$STATE_DIR/releases.XXXXXX")
rm -f "$etag_new"
if ! http_code=$(curl -sS -H 'Accept: application/vnd.github+json' -H 'User-Agent: jargle-mirror' \
    --connect-timeout 20 --max-time 60 \
    --etag-save "$etag_new" --etag-compare "$STATE_DIR/mirror-etag" \
    -o "$release_file" -w '%{http_code}' "$API_URL"); then
    log "release list request failed"
    exit 1
fi

case "$http_code" in
    304)
        log "unchanged"
        exit 0
        ;;
    200)
        if [[ ! -s "$release_file" ]]; then
            log "unchanged"
            exit 0
        fi
        ;;
    *)
        log "release list returned HTTP $http_code"
        exit 1
        ;;
esac

selected_file=$(mktemp "$STATE_DIR/selected.XXXXXX")

if ! python3 - "$release_file" "$selected_file" <<'PY'
import json
import sys

source, output = sys.argv[1:]
try:
    with open(source, encoding="utf-8") as handle:
        releases = json.load(handle)
except (OSError, ValueError, TypeError):
    raise SystemExit(1)

if not isinstance(releases, list):
    raise SystemExit(1)

chosen = None
for release in releases:
    if not isinstance(release, dict):
        continue
    tag = release.get("tag_name")
    if release.get("draft") is False and release.get("prerelease") is False and isinstance(tag, str) and tag.startswith("v"):
        chosen = release
        break

with open(output, "w", encoding="utf-8") as handle:
    if chosen is None:
        handle.write("NONE\n")
    else:
        handle.write("META\t{}\t{}\n".format(chosen.get("tag_name", ""), chosen.get("published_at", "")))
        assets = chosen.get("assets", [])
        if isinstance(assets, list):
            for asset in assets:
                if not isinstance(asset, dict):
                    continue
                name = asset.get("name")
                size = asset.get("size")
                url = asset.get("browser_download_url")
                if not isinstance(name, str) or not isinstance(size, int) or not isinstance(url, str):
                    continue
                if "/" in name or name.startswith("."):
                    continue
                handle.write("ASSET\t{}\t{}\t{}\n".format(name, size, url))
PY
then
    log "could not parse release list"
    exit 1
fi

if [[ $(sed -n '1p' "$selected_file") == "NONE" ]]; then
    log "no app release yet"
    if [[ -f "$etag_new" ]]; then mv -f "$etag_new" "$STATE_DIR/mirror-etag"; fi
    exit 0
fi

IFS=$'\t' read -r record tag published < "$selected_file"
if [[ "$record" != META || -z "$tag" ]]; then
    log "release list did not contain a valid app release"
    exit 1
fi

asset_names=()
old_tag=""
if [[ -f "$DOWNLOADS_DIR/release.txt" ]]; then
    old_tag=$(sed -n 's/^tag=//p' "$DOWNLOADS_DIR/release.txt" | head -n 1)
fi
while IFS=$'\t' read -r record name size url; do
    [[ "$record" == ASSET ]] || continue
    asset_names+=("$name")
    target="$DOWNLOADS_DIR/$name"
    if [[ "$old_tag" == "$tag" ]] && [[ -f "$target" ]] && [[ $(stat -c '%s' "$target") == "$size" ]]; then
        continue
    fi
    partial="$DOWNLOADS_DIR/.partial.$name"
    rm -f "$partial"
    if ! curl -fsSL --connect-timeout 20 --max-time 1800 "$url" -o "$partial"; then
        log "download failed: $name"
        exit 1
    fi
    if [[ $(stat -c '%s' "$partial") != "$size" ]]; then
        log "size check failed: $name"
        exit 1
    fi
    chmod 644 "$partial"
    mv -f "$partial" "$target"
    log "downloaded $name"
done < "$selected_file"

if [[ ${#asset_names[@]} -eq 0 ]]; then
    log "release has no assets yet, keeping current files"
else
    shopt -s nullglob
    for path in "$DOWNLOADS_DIR"/* "$DOWNLOADS_DIR"/.[!.]* "$DOWNLOADS_DIR"/..?*; do
        [[ -f "$path" ]] || continue
        name=${path##*/}
        [[ "$name" == release.txt ]] && continue
        keep=false
        for asset_name in "${asset_names[@]}"; do
            if [[ "$name" == "$asset_name" ]]; then
                keep=true
                break
            fi
        done
        if [[ "$keep" == false ]]; then
            rm -f "$path"
            log "removed $name"
        fi
    done
    shopt -u nullglob
fi

release_tmp="$DOWNLOADS_DIR/.release.txt.tmp"
{
    echo "tag=$tag"
    echo "published=$published"
    echo "mirrored=$(date -u +%Y-%m-%dT%H:%M:%SZ)"
} > "$release_tmp"
chmod 644 "$release_tmp"
mv -f "$release_tmp" "$DOWNLOADS_DIR/release.txt"
if [[ -f "$etag_new" ]]; then mv -f "$etag_new" "$STATE_DIR/mirror-etag"; fi
log "mirrored $tag"
