#!/usr/bin/env bash
#
# Verifies that package.json and src-tauri/Cargo.toml agree on the version.
# tauri.conf.json is intentionally NOT checked here — it points to
# "../package.json" so Tauri itself reads the single source of truth.
#
# Exit 0 on match, exit 1 on mismatch.
set -e

# `pnpm test` and CI run from the repo root; allow override for flexibility.
ROOT="${SHARKMD_ROOT:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ROOT"

PKG=$(jq -r .version package.json)
CARGO=$(grep '^version' src-tauri/Cargo.toml | head -1 | awk -F'"' '{print $2}')

if [ -z "$PKG" ] || [ "$PKG" = "null" ]; then
  echo "ERROR: could not read version from package.json" >&2
  exit 1
fi
if [ -z "$CARGO" ]; then
  echo "ERROR: could not read version from src-tauri/Cargo.toml" >&2
  exit 1
fi

if [ "$PKG" != "$CARGO" ]; then
  echo "Version mismatch: package.json=$PKG, Cargo.toml=$CARGO"
  exit 1
fi
echo "OK: $PKG"
