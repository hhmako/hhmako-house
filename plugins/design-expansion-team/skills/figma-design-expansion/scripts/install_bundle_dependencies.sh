#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [[ "${1:-}" == "--check-only" ]]; then
  "$SCRIPT_DIR/ensure_pingfang_bridge.sh" --check-only
  "$SCRIPT_DIR/ensure_lark_cli.sh" --check-only
  exit 0
fi

"$SCRIPT_DIR/ensure_pingfang_bridge.sh" --setup-only
"$SCRIPT_DIR/ensure_lark_cli.sh"

echo "Dependency bootstrap completed. Feishu authorization and one-time Figma plugin import may still require the user."
