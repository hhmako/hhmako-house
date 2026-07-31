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

### 一起维护 Skill

每个人都先在自己的 Codex 中修改并测试 Skill。确认可用后运行：

```bash
./publish-design-expansion-update.sh
```

它会自动创建个人分支并提交草稿 PR，不会直接覆盖团队正式版。审核合并后，其他同事运行：

```bash
./update-design-expansion-plugin.sh
```

即可获取最新正式版。

如只想把本机 Skill 同步到仓库中检查，但暂时不发布，可执行：

```bash
./sync-design-expansion-from-local.sh
```
