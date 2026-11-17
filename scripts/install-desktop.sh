#!/bin/sh
# Install this local plugin into the desktop profile.
#
# The Electron-managed desktop profile refuses "dsh plugin --profile desktop",
# so the Node installer performs the same three facts by hand and backs up
# package.json / pnpm-lock.yaml first. Restart the app afterwards.
set -eu
PKG_DIR=$(cd "$(dirname "$0")/.." && pwd)
node "$PKG_DIR/scripts/install-into-profile.mjs" "$@"
