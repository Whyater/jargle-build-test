#!/usr/bin/env bash
set -euo pipefail

if [ "$(uname -s)" != "Darwin" ]; then
  echo "Jargle: there is no macOS app to uninstall on this system."
  exit 0
fi

if pgrep -x Jargle >/dev/null 2>&1; then
  osascript -e 'quit app "Jargle"' >/dev/null 2>&1 || true
  for _ in 1 2 3 4 5; do
    if ! pgrep -x Jargle >/dev/null 2>&1; then break; fi
    sleep 1
  done
  if pgrep -x Jargle >/dev/null 2>&1; then pkill -x Jargle >/dev/null 2>&1 || true; fi
fi

paths=(/Applications/Jargle.app "$HOME/Applications/Jargle.app")
if [ -n "${JARGLE_INSTALL_DIR:-}" ]; then paths+=("$JARGLE_INSTALL_DIR/Jargle.app"); fi
for app in "${paths[@]}"; do
  if [ -e "$app" ]; then
    rm -rf "$app"
    echo "Jargle: removed $app"
  fi
done

if [ "${1:-}" = "--purge" ]; then
  data_paths=(
    "$HOME/Library/Application Support/io.github.whyater.jargle"
    "$HOME/Library/Caches/io.github.whyater.jargle"
    "$HOME/Library/HTTPStorages/io.github.whyater.jargle"
    "$HOME/Library/Preferences/io.github.whyater.jargle.plist"
    "$HOME/Library/WebKit/io.github.whyater.jargle"
    "$HOME/Library/Saved Application State/io.github.whyater.jargle.savedState"
  )
  for data in "${data_paths[@]}"; do
    if [ -e "$data" ]; then
      rm -rf "$data"
      echo "Jargle: removed $data"
    fi
  done
else
  echo "Jargle: game progress was kept. To remove it too, run: curl -fsSL https://whyater.github.io/Jargle/uninstall.sh | bash -s -- --purge"
fi
