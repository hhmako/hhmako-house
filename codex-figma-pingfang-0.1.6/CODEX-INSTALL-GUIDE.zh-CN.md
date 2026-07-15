# 给 Codex 的安装引导提示

用户不会手动执行终端命令。你的职责是拿到这个包以后，尽量自动完成；只有遇到 macOS 权限弹窗、Figma 插件导入、Codex 重启这种必须用户参与的动作时，才用一句话引导用户。

## 用户唯一固定动作

让用户打开 Figma Desktop，然后导入：

```txt
figma-plugin/manifest.json
```

路径：

```txt
Plugins -> Development -> Import plugin from manifest...
```

除此之外，不要让用户手动运行 `npm install`、`npm run setup`、`npm run ensure`。

## Codex 自动执行

在 `codex-figma-pingfang` 文件夹内执行：

```bash
npm install
npm run setup
```

当用户给出 Figma 链接并要求生成设计稿时，继续执行：

```bash
FIGMA_URL="<用户给的Figma链接>" npm run ensure
```

看到 `Codex PingFang bridge is ready.` 后，使用 `figma_pingfang.generate_pingfang_design` 生成设计稿。

如果任务是更新已有 Figma 节点文案或给已有设计稿切 PingFang，不要只依赖 `generate_pingfang_design`。必须继续验证：

```bash
curl http://localhost:3957/debug-current-page
curl -X POST http://localhost:3957/replace-text \
  -H 'Content-Type: application/json' \
  -d '{"replacements":[]}'
```

## 如果自动配置失败

不要把完整步骤丢给用户。按失败原因只提示一个动作：

- 如果缺 Figma 插件：提示用户导入 `figma-plugin/manifest.json`。
- 如果 macOS 要权限：提示用户在系统设置里允许当前 App 的辅助功能权限。
- 如果 MCP 刚配置完成但当前会话没有 `figma_pingfang`：提示用户重启 Codex 或开新会话。
- 如果 `npm run setup` 无法写入 Codex MCP 配置：脚本会生成 `CODEX-MCP-CONFIG-TO-ADD.toml` 并继续完成其它准备。此时只提示用户做一个动作：打开 Codex MCP 设置添加 `figma_pingfang`，URL 为 `http://127.0.0.1:3957/mcp`；如果没有设置入口，再让用户把 `CODEX-MCP-CONFIG-TO-ADD.toml` 的内容粘贴到 Codex 配置里并重启 Codex。
- 不要把 Swift helper 编译失败当成安装失败；`npm run launch` 会自动降级使用 AppleScript 打开 Figma 插件。
- 如果 `/probe` 成功但 `/debug-current-page` 或 `/replace-text` 超时：这是插件代码版本不一致，不是字体问题。让用户重新导入当前包里的 `figma-plugin/manifest.json`，然后重开 `Codex PingFang Bridge` 插件。

## 成功标准

必须同时满足：

- `npm run ensure` 返回 ready。
- `/probe` 返回 `ok:true`。
- `/probe` 返回的 `missingPluginCapabilities` 为空。
- `/debug-current-page` 返回 `ok:true`，且当前页面是目标设计稿所在文件。
- `/replace-text` 可以成功返回，即使 replacements 为空也不能超时。
- 最小 `figma_pingfang.generate_pingfang_design` 调用能返回 `Rendered ... nodes with PingFang SC.`

分享给同事前先运行：

```bash
npm run doctor
npm run pack:zip
```
