#!/usr/bin/env bash
set -euo pipefail

SITE_DIR=/var/www/jargle
RELEASES_DIR=$SITE_DIR/releases
CURRENT_LINK=$SITE_DIR/current
STATE_DIR=/var/lib/jargle
URL=https://github.com/Whyater/Jargle/releases/download/web-latest/jargle-web.tar.gz
KEEP=3

log() {
    echo "jargle-update: $*"
}

# Keep downloaded files owned by jargle when invoked by root.
if [[ $(id -u) -eq 0 ]]; then exec runuser -u jargle -- "$0" "$@"; fi
cd /

tar_file=""
extract_dir=""
current_tmp=""
cleanup() {
    [[ -n "$tar_file" ]] && rm -f "$tar_file"
    [[ -n "$extract_dir" && -d "$extract_dir" ]] && rm -rf "$extract_dir"
    [[ -n "$current_tmp" ]] && rm -f "$current_tmp"
    return 0
}
trap cleanup EXIT

mkdir -p "$SITE_DIR" "$RELEASES_DIR" "$STATE_DIR"
exec 9>"$STATE_DIR/update.lock"
if ! flock -n 9; then
    log "another update is already running"
    exit 0
fi
find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -name '.extract.*' -mmin +60 -exec rm -rf {} +

archive_is_safe() {
    local member part
    local -a parts
    while IFS= read -r member; do
        case "$member" in
            /*)
                log "rejecting archive member with an absolute path: $member"
                return 1
                ;;
        esac
        IFS=/ read -r -a parts <<< "$member"
        for part in "${parts[@]}"; do
            if [[ "$part" == ".." ]]; then
                log "rejecting archive member with a parent path: $member"
                return 1
            fi
        done
    done
}

install_archive() {
    local archive=$1
    local sha sha12 stamp new_release web_root version installed
    local -a top_entries

    if ! tar -tzf "$archive" | archive_is_safe; then
        return 1
    fi

    sha=$(sha256sum "$archive" | awk '{print $1}') || {
        log "could not calculate archive checksum"
        return 1
    }
    sha12=${sha:0:12}
    if [[ -f "$STATE_DIR/last.sha256" ]] && [[ "$(cat "$STATE_DIR/last.sha256")" == "$sha" ]]; then
        log "unchanged"
        return 2
    fi

    extract_dir=$(mktemp -d "$RELEASES_DIR/.extract.XXXXXX")
    tar -xzf "$archive" --no-same-owner --no-same-permissions -C "$extract_dir" || {
        log "extract failed"
        return 1
    }

    # Links could point Caddy at files outside the site, so only plain files and dirs are allowed.
    bad_entry=$(find "$extract_dir" ! -type f ! -type d -print -quit)
    if [[ -n "$bad_entry" ]]; then
        log "archive contains links or special files"
        return 1
    fi

    if [[ -f "$extract_dir/index.html" ]]; then
        web_root=$extract_dir
    else
        shopt -s nullglob dotglob
        top_entries=("$extract_dir"/*)
        shopt -u nullglob dotglob
        if [[ ${#top_entries[@]} -ne 1 || ! -d "${top_entries[0]}" || ! -f "${top_entries[0]}/index.html" ]]; then
            log "archive must contain index.html at the top level or in one top-level directory"
            return 1
        fi
        web_root=${top_entries[0]}
    fi

    version=$sha12
    if [[ -f "$web_root/version.json" ]]; then
        version=$(python3 - "$web_root/version.json" <<'PY'
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as handle:
        value = json.load(handle).get("version", "")
    print(value if isinstance(value, (str, int, float)) else "")
except (OSError, ValueError, TypeError):
    print("")
PY
)
        [[ -n "$version" ]] || version=$sha12
    fi

    installed=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    {
        echo "ok"
        echo "version=$version"
        echo "sha256=$sha12"
        echo "installed=$installed"
    } > "$web_root/healthz.txt" || {
        log "could not write healthz.txt"
        return 1
    }
    chmod -R a+rX "$extract_dir" || {
        log "could not set release permissions"
        return 1
    }

    stamp=$(date -u +%Y%m%d-%H%M%S)
    new_release="$RELEASES_DIR/$stamp-$sha12"
    mv -T "$web_root" "$new_release" || {
        log "release move failed"
        return 1
    }
    rm -rf "$extract_dir"
    extract_dir=""

    current_tmp="$CURRENT_LINK.tmp"
    rm -f "$current_tmp"
    ln -sfn "$new_release" "$current_tmp"
    mv -Tf "$current_tmp" "$CURRENT_LINK" || {
        log "symlink swap failed"
        return 1
    }
    current_tmp=""

    printf '%s\n' "$sha" > "$STATE_DIR/last.sha256" || {
        log "could not save archive checksum"
        return 1
    }

    local current_target name count=0 release_path
    current_target=$(readlink -f "$CURRENT_LINK" || true)
    while IFS= read -r name; do
        [[ -n "$name" ]] || continue
        release_path="$RELEASES_DIR/$name"
        if (( count < KEEP )) || [[ "$release_path" == "$current_target" ]]; then
            ((count += 1))
            continue
        fi
        rm -rf "$release_path"
        log "removed old release $name"
    done < <(find "$RELEASES_DIR" -mindepth 1 -maxdepth 1 -type d ! -name '.extract.*' -printf '%f\n' | sort -r)
    log "installed $version ($sha12)"
    return 0
}

if [[ $# -gt 1 ]]; then
    echo "usage: jargle-update [path/to/jargle-web.tar.gz]" >&2
    exit 2
fi

if [[ $# -eq 1 ]]; then
    local_archive=$1
    if [[ ! -f "$local_archive" ]]; then
        log "local archive not found: $local_archive"
        exit 1
    fi
    if install_archive "$local_archive"; then
        :
    else
        status=$?
        [[ $status -eq 2 ]] || exit "$status"
    fi
    exit 0
fi

tar_file=$(mktemp "$STATE_DIR/download.XXXXXX")
etag_new="$STATE_DIR/etag.new"
rm -f "$etag_new"
if ! http_code=$(curl -sSL --connect-timeout 20 --max-time 300 --etag-save "$etag_new" --etag-compare "$STATE_DIR/etag" -o "$tar_file" -w '%{http_code}' "$URL"); then
    log "download failed"
    exit 1
fi

case "$http_code" in
    200)
        if [[ ! -s "$tar_file" ]]; then
            log "unchanged"
            exit 0
        fi
        if install_archive "$tar_file"; then
            if [[ -f "$etag_new" ]]; then mv -f "$etag_new" "$STATE_DIR/etag"; fi
        else
            status=$?
            if [[ $status -eq 2 ]]; then
                if [[ -f "$etag_new" ]]; then mv -f "$etag_new" "$STATE_DIR/etag"; fi
            else
                exit "$status"
            fi
        fi
        ;;
    304)
        log "unchanged"
        ;;
    404)
        log "no web-latest release yet"
        ;;
    *)
        log "download returned HTTP $http_code"
        exit 1
        ;;
esac
