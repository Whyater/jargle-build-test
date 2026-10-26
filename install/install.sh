#!/usr/bin/env bash
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Jargle: there is no Linux app yet."
  echo "Jargle: play in the browser at https://whyater.github.io/Jargle/"
  echo "Jargle: you can install it from the browser menu."
  exit 0
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "Jargle: curl is required." >&2
  exit 1
fi
if ! command -v tar >/dev/null 2>&1; then
  echo "Jargle: tar is required." >&2
  exit 1
fi

arch="$(uname -m)"
echo "Jargle: detected architecture: $arch"
case "$arch" in
  arm64|x86_64|aarch64) ;;
  *) echo "Jargle: unknown architecture, continuing because the app is universal." ;;
esac

base="${JARGLE_RELEASES_BASE:-https://github.com/Whyater/Jargle/releases/latest/download}"
base="${base%/}"
# Keep updates beside the copy the user already runs.
if [ -n "${JARGLE_INSTALL_DIR:-}" ]; then
  install_dir="$JARGLE_INSTALL_DIR"
elif [ -d /Applications/Jargle.app ]; then
  install_dir=/Applications
elif [ -d "$HOME/Applications/Jargle.app" ]; then
  install_dir="$HOME/Applications"
elif [ -w /Applications ]; then
  install_dir=/Applications
else
  install_dir="$HOME/Applications"
fi

tmp_dir="$(mktemp -d)"
trap 'rm -rf "$tmp_dir"' EXIT
archive="$tmp_dir/Jargle-mac.app.tar.gz"
echo "Jargle: downloading the macOS app."
if ! curl -fsSL "$base/Jargle-mac.app.tar.gz" -o "$archive" 2>/dev/null; then
  echo "Jargle: could not download the app from $base. Check your connection, or download it from https://github.com/Whyater/Jargle/releases/latest" >&2
  exit 1
fi
mkdir -p "$tmp_dir/extracted"
tar -xzf "$archive" -C "$tmp_dir/extracted"
new_app="$tmp_dir/extracted/Jargle.app"
if [ ! -d "$new_app/Contents/MacOS" ]; then
  echo "Jargle: the downloaded app is invalid." >&2
  exit 1
fi

if pgrep -x Jargle >/dev/null 2>&1; then
  osascript -e 'quit app "Jargle"' >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do
    if ! pgrep -x Jargle >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if pgrep -x Jargle >/dev/null 2>&1; then
    pkill -x Jargle >/dev/null 2>&1 || true
  fi
fi

mkdir -p "$install_dir"
staged_app="$install_dir/Jargle.app.new"
rm -rf "$staged_app"
ditto "$new_app" "$staged_app"
rm -rf "$install_dir/Jargle.app"
mv "$staged_app" "$install_dir/Jargle.app"
xattr -dr com.apple.quarantine "$install_dir/Jargle.app" >/dev/null 2>&1 || true

version="$(defaults read "$install_dir/Jargle.app/Contents/Info.plist" CFBundleShortVersionString 2>/dev/null || true)"
echo "Jargle: installed to $install_dir/Jargle.app"
if [ -n "$version" ]; then echo "Jargle: version $version"; fi
if [ "${JARGLE_NO_LAUNCH:-0}" != "1" ]; then open "$install_dir/Jargle.app"; fi
echo "Jargle: uninstall with curl -fsSL https://whyater.github.io/Jargle/uninstall.sh | bash"
