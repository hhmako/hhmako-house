#!/usr/bin/env bash
set -euo pipefail

INSTALL_ROOT="${CODEX_LARK_CLI_ROOT:-$HOME/.codex/tools/lark-cli}"
LOCAL_BIN="$INSTALL_ROOT/node_modules/.bin/lark-cli"
CHECK_ONLY=0

if [[ "${1:-}" == "--check-only" ]]; then
  CHECK_ONLY=1
fi

if command -v lark-cli >/dev/null 2>&1; then
  BIN="$(command -v lark-cli)"
elif [[ -x "$LOCAL_BIN" ]]; then
  BIN="$LOCAL_BIN"
else
  if [[ "$CHECK_ONLY" == "1" ]]; then
    echo "lark-cli is not installed"
    exit 2
  fi
  if ! command -v npm >/dev/null 2>&1; then
    echo "Cannot install lark-cli: npm is unavailable" >&2
    exit 3
  fi
  mkdir -p "$INSTALL_ROOT"
  npm install --prefix "$INSTALL_ROOT" @larksuite/cli@latest
  BIN="$LOCAL_BIN"
fi

if [[ ! -x "$BIN" ]]; then
  echo "lark-cli executable is unavailable after installation" >&2
  exit 4
fi

"$BIN" --version
echo "LARK_CLI_BIN=$BIN"
