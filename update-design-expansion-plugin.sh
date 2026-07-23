#!/bin/zsh
set -e

ROOT="${0:A:h}"
git -C "$ROOT" pull --ff-only
codex plugin add design-expansion-team@design-expansion-team

echo "figma-design-expansion 更新完成。请新建 Codex 任务后使用。"
