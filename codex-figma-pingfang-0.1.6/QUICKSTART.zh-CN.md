# Codex Figma PingFang 快速开始

这个包用于让设计师通过 Codex 生成 Figma 设计稿时，文本默认使用本机 `PingFang SC`。

当前稳定版：`0.1.6`。

这一版的启动判断不是只看端口是否打开，而是会让 Figma 插件执行真实的 PingFang 字体探针，并确认插件支持当前页调试和已有文本节点替换。只有这些检查都成功，`npm run ensure` 才会返回 ready。

## 推荐交付方式

把整个 `codex-figma-pingfang-0.1.6.zip` 发给同事，让同事把这个包交给 Codex 处理。用户不需要理解 npm、MCP、端口、probe。

同事只需要对 Codex 说：

```txt
这是 Codex PingFang Bridge 包。请阅读包里的 CODEX-INSTALL-GUIDE.zh-CN.md，然后引导我完成安装。除 Figma 插件导入、macOS 权限确认、重启 Codex 这类必须我操作的动作外，其它请你自动完成。
```

## 用户真正需要做的事

### 1. 解压工程包

把 `codex-figma-pingfang` 放到一个固定目录，例如：

```bash
~/Documents/codex-figma-pingfang
```

### 2. 导入 Figma 插件

打开 Figma Desktop，然后执行：

```txt
Plugins -> Development -> Import plugin from manifest...
```

选择：

```txt
codex-figma-pingfang/figma-plugin/manifest.json
```

这个步骤每台电脑只需要做一次。

### 3. 让 Codex 接管

把下面这句话发给 Codex：

```txt
我已经在 Figma Desktop 里导入了 Codex PingFang Bridge 插件。请阅读 codex-figma-pingfang/CODEX-INSTALL-GUIDE.zh-CN.md，并自动完成后续安装、setup、ensure 和生成。除 Figma 插件导入、macOS 权限确认、重启 Codex 这类必须我操作的动作外，不要让我手动执行命令。
```

Codex 会自动完成：

- 安装/刷新 `figma_pingfang` MCP 配置。
- 构建打开 Figma 插件的 macOS 辅助程序。
- 打开目标 Figma 文件。
- 拉起本地 bridge。
- 让 Figma 插件执行真实 PingFang 字体探针。
- ready 后继续生成设计稿。

Codex 会写入下面配置到 `~/.codex/config.toml`：

```toml
[mcp_servers.figma_pingfang]
type = "http"
url = "http://127.0.0.1:3957/mcp"
```

如果这是第一次配置 MCP，Codex 可能会提示重启 Codex 或开启新会话。这是 Codex 加载 MCP 配置所需，不是用户要手动配置 bridge。

### 4. 授权辅助功能

第一次运行一键启动时，macOS 可能会要求辅助功能权限。

打开：

```txt
系统设置 -> 隐私与安全性 -> 辅助功能
```

允许你运行命令的 App，例如 Terminal、iTerm 或 Codex。

如果系统提示缺少命令行工具，先运行：

```bash
xcode-select --install
```

## 日常使用方式

之后用户只需要正常给 Codex 发送 Figma 生成需求和 Figma 链接。Codex 应自动执行：

```bash
npm run setup
FIGMA_URL="Figma链接" npm run ensure
```

Codex 看到：

```txt
Codex PingFang bridge is ready.
Keep this terminal open while generating Figma designs. Press Ctrl+C to stop.
```

就表示准备好了。

就可以继续生成。这个终端由 Codex 保持运行。

## 判断是否成功

运行中可以检查：

```bash
curl http://localhost:3957/health
curl http://localhost:3957/probe
curl http://localhost:3957/debug-current-page
curl -X POST http://localhost:3957/replace-text \
  -H 'Content-Type: application/json' \
  -d '{"replacements":[]}'
```

`/health` 正常返回类似：

```json
{"ok":true,"pendingJobs":0,"waitingCalls":0,"fontFamily":"PingFang SC"}
```

必须同时满足：

- `/probe` 返回 `ok:true`。
- `/probe` 里的 `missingPluginCapabilities` 为空。
- `/debug-current-page` 返回 `ok:true`。
- `/replace-text` 即使传空 replacements 也能成功返回，不能超时。

这些都通过，才表示 Figma 插件已经连上、插件代码版本正确，并且本机 `PingFang SC` 可以被 Figma Desktop 加载。

如果生成成功，Codex 通常会返回：

```txt
Rendered 6 nodes with PingFang SC.
```

## 注意事项

- 必须使用 Figma Desktop，不是浏览器版 Figma。
- 用户只负责导入 Figma 插件；其它命令由 Codex 运行。
- `npm run ensure` 或 `npm run launch` 的终端窗口需要保持打开，但应该由 Codex 启动并维护。
- `PingFang SC` 是 macOS 系统字体，因此这套方案主要面向 Mac 设计师。
- 如果生成时报字体错误，确认 Figma Desktop 可以正常看到 `PingFang SC`。
- Figma 插件 manifest 里的 `allowedDomains` 必须保持 `http://localhost:3957`，不要改成 `127.0.0.1`。

## 给同事的最短步骤

1. 把 `codex-figma-pingfang-0.1.6.zip` 发给 Codex。
2. 按 Codex 提示在 Figma Desktop 里导入 `figma-plugin/manifest.json`。
3. 后续只给 Codex Figma 链接和设计需求。
