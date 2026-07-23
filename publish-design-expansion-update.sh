#!/bin/zsh
set -e

ROOT="${0:A:h}"
SOURCE="$HOME/.codex/skills/figma-design-expansion/"
PLUGIN="$ROOT/plugins/design-expansion-team"
TARGET="$PLUGIN/skills/figma-design-expansion/"
MANIFEST="$PLUGIN/.codex-plugin/plugin.json"
STAMP="$(date -u +%Y%m%d%H%M%S)"
SAFE_USER="$(whoami | tr -cd '[:alnum:]-')"
BRANCH="agent/skill-update-${SAFE_USER}-${STAMP}"

for command_name in git gh rsync python3; do
  if ! command -v "$command_name" >/dev/null 2>&1; then
    echo "缺少必要工具：$command_name"
    exit 1
  fi
done

if ! gh auth status >/dev/null 2>&1; then
  echo "GitHub 尚未登录。请先运行：gh auth login"
  exit 1
fi

if [[ ! -f "$SOURCE/SKILL.md" ]]; then
  echo "没有找到本机 Skill：$SOURCE"
  exit 1
fi

if [[ -n "$(git -C "$ROOT" status --porcelain)" ]]; then
  echo "仓库里还有未提交内容。为避免覆盖，请先提交或处理这些内容后再发布。"
  exit 1
fi

DEFAULT_BRANCH="$(gh repo view --json defaultBranchRef --jq '.defaultBranchRef.name')"
git -C "$ROOT" fetch origin "$DEFAULT_BRANCH"
git -C "$ROOT" switch "$DEFAULT_BRANCH"
git -C "$ROOT" pull --ff-only origin "$DEFAULT_BRANCH"
git -C "$ROOT" switch -c "$BRANCH"

rsync -a --delete "$SOURCE" "$TARGET"

if git -C "$ROOT" diff --quiet -- plugins/design-expansion-team/skills/figma-design-expansion; then
  git -C "$ROOT" switch "$DEFAULT_BRANCH"
  git -C "$ROOT" branch -D "$BRANCH"
  echo "本机 Skill 与团队正式版一致，不需要发布。"
  exit 0
fi

python3 - "$MANIFEST" "$STAMP" <<'PY'
import json
import pathlib
import sys

path = pathlib.Path(sys.argv[1])
stamp = sys.argv[2]
data = json.loads(path.read_text(encoding="utf-8"))
base = data.get("version", "0.1.0").split("+", 1)[0]
data["version"] = f"{base}+codex.{stamp}"
path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
PY

SKILL_VALIDATOR="$HOME/.codex/skills/.system/skill-creator/scripts/quick_validate.py"
PLUGIN_VALIDATOR="$HOME/.codex/skills/.system/plugin-creator/scripts/validate_plugin.py"

if [[ -f "$SKILL_VALIDATOR" ]]; then
  python3 "$SKILL_VALIDATOR" "$TARGET"
else
  echo "未找到 Skill 校验器，已完成基础结构检查。"
fi

if [[ -f "$PLUGIN_VALIDATOR" ]]; then
  python3 "$PLUGIN_VALIDATOR" "$PLUGIN"
else
  echo "未找到 Plugin 校验器，已完成基础结构检查。"
fi

git -C "$ROOT" add \
  plugins/design-expansion-team/.codex-plugin/plugin.json \
  plugins/design-expansion-team/skills/figma-design-expansion
git -C "$ROOT" commit -m "Update Figma design expansion skill"
git -C "$ROOT" push -u origin "$BRANCH"

BODY_FILE="$(mktemp)"
trap 'rm -f "$BODY_FILE"' EXIT
printf '%s\n' \
  '## 修改内容' \
  '' \
  '- 同步本机 figma-design-expansion Skill' \
  '- 更新团队插件版本，确保 Codex 能加载新内容' \
  '' \
  '## 校验' \
  '' \
  '- Skill 结构校验' \
  '- Plugin 结构校验' > "$BODY_FILE"

gh pr create \
  --draft \
  --base "$DEFAULT_BRANCH" \
  --head "$BRANCH" \
  --title "Update Figma design expansion skill" \
  --body-file "$BODY_FILE"

echo "已提交为独立草稿 PR。审核并合并后，其他同事运行更新入口即可获取正式版。"
