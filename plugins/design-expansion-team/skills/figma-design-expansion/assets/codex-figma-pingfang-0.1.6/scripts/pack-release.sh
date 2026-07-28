#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -e "const fs=require('node:fs'); console.log(JSON.parse(fs.readFileSync('package.json','utf8')).version)")"
OUT="$ROOT/../codex-figma-pingfang-${VERSION}.zip"

rm -f "$OUT"
zip -qr "$OUT" . \
  -x "./node_modules/*" \
  -x "./.git/*" \
  -x "./.bin/*" \
  -x "./.bridge.log" \
  -x "./.bridge.pid" \
  -x "./.DS_Store" \
  -x "./*.zip"

echo "$OUT"
