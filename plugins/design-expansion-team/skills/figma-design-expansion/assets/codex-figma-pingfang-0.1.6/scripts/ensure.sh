#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

HEALTH_URL="http://localhost:3957/health"
PROBE_URL="http://localhost:3957/probe"
DEBUG_URL="http://localhost:3957/debug-current-page"

if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  if curl -fsS "$PROBE_URL" | grep -q '"missingPluginCapabilities":\[\]' >/dev/null 2>&1 && \
    curl -fsS "$DEBUG_URL" | grep -q '"ok":true' >/dev/null 2>&1; then
    echo "Codex PingFang bridge is already ready."
    exit 0
  fi
  echo "Codex PingFang bridge is reachable but failed the plugin capability/current-page checks. Restarting it..."
fi

echo "Codex PingFang bridge is not ready. Starting it now..."
echo "Keep this terminal open while generating Figma designs."
exec bash scripts/launch.sh
