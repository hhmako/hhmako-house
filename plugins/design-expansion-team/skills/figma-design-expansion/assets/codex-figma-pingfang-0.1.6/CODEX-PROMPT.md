# 给 Codex 的固定提示

用户侧只需要在 Figma Desktop 里导入一次 `figma-plugin/manifest.json`。除此之外，所有准备动作都由 Codex 自动完成，不要要求用户手动运行 npm 命令。

如果用户把整个 `codex-figma-pingfang` 包发给你，请先阅读 `CODEX-INSTALL-GUIDE.zh-CN.md`，然后按那份文档引导。不要把文档里的命令原样丢给用户执行。

当我要生成 Figma 设计稿，并且需要使用 `PingFang SC` 字体时，请先从我的消息里提取 Figma 链接，然后执行下面的准备动作：

1. 找到 `codex-figma-pingfang` 文件夹并进入该目录。
2. 先运行 `npm run setup`，确保 `figma_pingfang` MCP 配置和 macOS 打开插件助手都已准备好。这个命令是幂等的，可以重复运行。
3. 如果我的消息里有 Figma 链接，用这个链接运行：

```bash
FIGMA_URL="我给你的Figma链接" npm run ensure
```

4. 如果没有 Figma 链接，再运行：

```bash
npm run ensure
```

5. 如果 `npm run ensure` 显示桥接服务已经 ready，就继续生成设计稿。
6. 如果 `npm run ensure` 启动了桥接服务，请保持这个命令运行，不要结束它，然后继续生成设计稿。
7. 如果当前 Codex 会话还没有 `figma_pingfang` MCP 工具，说明 MCP 配置刚写入但当前会话尚未加载。告诉用户重启 Codex 或开启新会话即可，不能让用户再执行其它命令。
8. 生成 Figma 文本时，必须使用 `PingFang SC`：

```js
await figma.loadFontAsync({ family: "PingFang SC", style: "Regular" });
await figma.loadFontAsync({ family: "PingFang SC", style: "Medium" });
await figma.loadFontAsync({ family: "PingFang SC", style: "Semibold" });
```

如果遇到远程 Figma MCP 无法加载 `PingFang SC`，不要继续用远程 MCP 硬写字体。请改用本地 `figma_pingfang` MCP。
