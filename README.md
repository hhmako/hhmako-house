# hhmako-house

## Codex PingFang Bridge

当前版本：`codex-figma-pingfang-0.1.6`

给同事使用时，先进入该目录并阅读：

- `codex-figma-pingfang-0.1.6/QUICKSTART.zh-CN.md`
- `codex-figma-pingfang-0.1.6/CODEX-INSTALL-GUIDE.zh-CN.md`

## Figma Design Expansion 团队 Skill

仓库内的 `design-expansion-team` Plugin 只包含：

- `figma-design-expansion`

首次安装：

```bash
./install-design-expansion-plugin.sh
```

后续同步团队最新版本：

```bash
./update-design-expansion-plugin.sh
```

安装或更新后，请新建 Codex 任务以加载最新 Skill。

维护者若先在 `~/.codex/skills/figma-design-expansion` 中完成优化，可执行：

```bash
./sync-design-expansion-from-local.sh
```

检查并提交变更后，同事运行更新脚本即可同步。
