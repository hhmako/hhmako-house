#!/bin/zsh
set -e

ROOT="${0:A:h}"
SOURCE="$HOME/.codex/skills/figma-design-expansion/"
TARGET="$ROOT/plugins/design-expansion-team/skills/figma-design-expansion/"

rsync -a --delete "$SOURCE" "$TARGET"

echo "已同步本机 figma-design-expansion 到仓库，请检查并提交变更。"
