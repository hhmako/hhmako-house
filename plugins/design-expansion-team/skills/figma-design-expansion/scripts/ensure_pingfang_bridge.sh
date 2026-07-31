#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SKILL_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
SOURCE_DIR="$SKILL_DIR/assets/codex-figma-pingfang-0.1.6"
INSTALL_DIR="${CODEX_PINGFANG_BRIDGE_ROOT:-$HOME/.codex/tools/codex-figma-pingfang-0.1.6}"
MODE="setup"
FIGMA_URL_VALUE=""

case "${1:-}" in
  --check-only) MODE="check" ;;
  --setup-only|"") MODE="setup" ;;
  --figma-url)
    MODE="ensure"
    FIGMA_URL_VALUE="${2:-}"
    if [[ -z "$FIGMA_URL_VALUE" ]]; then
      echo "--figma-url requires a Figma URL" >&2
      exit 2
    fi
    ;;
  *)
    echo "Usage: $0 [--check-only|--setup-only|--figma-url <url>]" >&2
    exit 2
    ;;
esac

if [[ ! -f "$SOURCE_DIR/figma-plugin/manifest.json" ]]; then
  echo "Bundled PingFang Bridge is incomplete: manifest is missing" >&2
  exit 3
fi

if [[ "$MODE" == "check" ]]; then
  node "$SOURCE_DIR/scripts/doctor.js"
  echo "PINGFANG_PLUGIN_MANIFEST=$SOURCE_DIR/figma-plugin/manifest.json"
  exit 0
fi

mkdir -p "$INSTALL_DIR"
rsync -a --delete "$SOURCE_DIR/" "$INSTALL_DIR/"
cd "$INSTALL_DIR"
npm install
npm run doctor
npm run setup
echo "PINGFANG_BRIDGE_ROOT=$INSTALL_DIR"
echo "PINGFANG_PLUGIN_MANIFEST=$INSTALL_DIR/figma-plugin/manifest.json"

if [[ "$MODE" == "ensure" ]]; then
  FIGMA_URL="$FIGMA_URL_VALUE" npm run ensure
fi
