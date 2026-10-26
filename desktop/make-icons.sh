#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
ROOT=$(cd "$SCRIPT_DIR/.." && pwd)
BRAND_ICON="$ROOT/assets/brand/icon-1024.png"
SVG_ICON="$ROOT/assets/icon.svg"
TAURI="$ROOT/desktop/node_modules/.bin/tauri"
ICONS_DIR="$ROOT/desktop/src-tauri/icons"

if [[ -f "$BRAND_ICON" ]]; then
  source_image="$BRAND_ICON"
elif [[ -f "$SVG_ICON" ]]; then
  source_image="$SVG_ICON"
else
  echo "No icon source found at assets/brand/icon-1024.png or assets/icon.svg" >&2
  exit 1
fi

if [[ ! -x "$TAURI" ]]; then
  echo "tauri CLI missing: run npm ci in desktop first" >&2
  exit 1
fi

"$TAURI" icon "$source_image" -o "$ICONS_DIR"

RES_DIR="$ROOT/mobile/android/app/src/main/res"
ANDROID_ICONS="$ICONS_DIR/android"
if [[ -d "$RES_DIR" && -d "$ANDROID_ICONS" ]]; then
  for source_dir in "$ANDROID_ICONS"/mipmap-*/; do
    [[ -d "$source_dir" ]] || continue
    folder=$(basename "$source_dir")
    target_dir="$RES_DIR/$folder"
    mkdir -p "$target_dir"
    find "$source_dir" -maxdepth 1 -type f -exec cp {} "$target_dir/" \;
  done

  mkdir -p "$RES_DIR/values"
  cat > "$RES_DIR/values/ic_launcher_background.xml" <<'EOF'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#F6EFDC</color>
</resources>
EOF
fi

rm -rf "$ICONS_DIR/android" "$ICONS_DIR/ios"
echo "Icon source: $source_image"
