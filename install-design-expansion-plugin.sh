#!/bin/zsh
set -e

ROOT="${0:A:h}"
codex plugin marketplace add "$ROOT"
codex plugin add design-expansion-team@design-expansion-team

echo "figma-design-expansion 安装完成。请新建 Codex 任务后使用。"
