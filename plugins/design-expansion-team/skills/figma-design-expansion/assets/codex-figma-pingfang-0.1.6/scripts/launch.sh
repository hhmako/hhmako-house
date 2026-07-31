#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET_URL="${FIGMA_URL:-}"
HEALTH_URL="http://localhost:3957/health"
PROBE_URL="http://localhost:3957/probe"
DEBUG_URL="http://localhost:3957/debug-current-page"

cleanup_bridge_listeners() {
  local pids
  pids="$(lsof -ti tcp:3957 -sTCP:LISTEN 2>/dev/null | sort -u || true)"
  if [ -n "$pids" ]; then
    echo "Stopping stale PingFang bridge listener(s): $pids"
    # shellcheck disable=SC2086
    kill $pids >/dev/null 2>&1 || true
    sleep 0.5
  fi
}

wait_for_health() {
  for _ in $(seq 1 40); do
    if curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.25
  done
  return 1
}

wait_for_probe() {
  for _ in $(seq 1 40); do
    if curl -fsS "$PROBE_URL" | grep -q '"missingPluginCapabilities":\[\]' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

wait_for_debug() {
  for _ in $(seq 1 20); do
    if curl -fsS "$DEBUG_URL" | grep -q '"ok":true' >/dev/null 2>&1; then
      return 0
    fi
    sleep 1
  done
  return 1
}

if [ -n "$TARGET_URL" ]; then
  open "$TARGET_URL" >/dev/null 2>&1 || true
  sleep 2
fi

STARTED_SERVER=0

if curl -fsS "$PROBE_URL" | grep -q '"missingPluginCapabilities":\[\]' >/dev/null 2>&1 && curl -fsS "$DEBUG_URL" | grep -q '"ok":true' >/dev/null 2>&1; then
  echo "Codex PingFang bridge is ready."
  exit 0
fi

cleanup_bridge_listeners

if ! curl -fsS "$HEALTH_URL" >/dev/null 2>&1; then
  node server/mcp-server.js > .bridge.log 2>&1 &
  SERVER_PID=$!
  STARTED_SERVER=1
  echo "$SERVER_PID" > .bridge.pid
  trap 'kill "$SERVER_PID" >/dev/null 2>&1 || true' EXIT INT TERM
fi

if ! wait_for_health; then
  echo "Local bridge did not start. Check $ROOT/.bridge.log" >&2
  exit 1
fi

if [ -x .bin/open-figma-plugin ]; then
  .bin/open-figma-plugin || true
else
  osascript -l AppleScript scripts/open-figma-plugin.applescript >/dev/null 2>&1 || true
fi

if ! wait_for_probe; then
  echo "PingFang render probe failed." >&2
  echo "Keep the Codex PingFang Bridge plugin window open. If it is open, re-import figma-plugin/manifest.json so the plugin code matches this package." >&2
  exit 1
fi

if ! wait_for_debug; then
  echo "PingFang plugin connected, but debug-current-page failed." >&2
  echo "This usually means the Figma plugin code is too old. Re-import figma-plugin/manifest.json, then rerun npm run ensure." >&2
  exit 1
fi

echo "Codex PingFang bridge is ready."

if [ "$STARTED_SERVER" = "1" ]; then
  echo "Keep this terminal open while generating Figma designs. Press Ctrl+C to stop."
  wait "$SERVER_PID"
fi
