# 交易售后体验问题收集 Agent

一套可复用的“授权来源采集 -> 体验设计问题识别 -> 飞书多维表格入库 -> 实时/双周卡片同步”能力包。

## 包含的真实能力

- 小红书、微博、哔哩哔哩：复用本机授权登录态，按双周窗口搜索并采集。
- 飞书反馈群：通过飞书自建应用长连接订阅 `im.message.receive_v1`，实时接收群文字和图片。
- 严格收录：排除客服态度、商家履约、物流履约、商品质量、生活服务、纯技术故障和无截图问题。
- 证据处理：下载当前群消息图片，或抓取原帖图片，作为当前记录附件。
- 多维表格写入：新记录默认 `待确认`，写入场景、四分类、负责人、优先级、来源、原帖日期和截图。
- 去重与增量：群消息按 message_id 去重；外网采集从上次成功时间继续，按原帖日期从远到近写入。
- 实时卡片：反馈群及人工 @ 录入命中后，使用单条卡片模板立即同步。
- 双周卡片：双周周二采集，发送两周内新录入、已解决及未跟进数量。

## 同事首次使用

```bash
npm install
npm run setup
```

随后按终端提示填写 `config.local.json` 和 `.env`。这两个文件只保存在本机，不会提交到 Git。

完整替换清单见 [配置说明](docs/CONFIGURATION.md)，飞书群实时监听见
[飞书应用接入](docs/FEISHU_APP_SETUP.md)。
卡片模板字段见 [卡片模板变量契约](docs/CARD-TEMPLATE-CONTRACT.md)。

第一次接手建议直接按 [同事快速开始](docs/COWORKER-QUICKSTART.md) 逐项操作，并对照
[完整包清单](docs/PACKAGE-CONTENTS.md) 确认没有漏传源码。只拿到规则表或卡片脚本，不能实现
飞书群实时监听。

配置完成后：

```bash
npm run doctor
npm run group:dry-run
npm run card:dry-run
npm run check
```

全部通过后再启动：

```bash
# 常驻监听飞书反馈群
npm run group:listen

# 双周周二 11:00 采集
npm run biweekly:collect

# 双周周二 15:30 发送
npm run biweekly:send
```

## 运行链路

```text
飞书群消息事件 ─┐
人工 @ 机器人 ──┼─> 证据下载 -> 收录规则 -> 去重 -> Base（待确认）-> 单条卡片
                 │
小红书/微博/B站 ─┴─> 授权搜索 -> 原帖日期/截图 -> 收录规则 -> 去重 -> Base
                                                             └-> 双周合并卡片
```

## 目录

- `src/run-group-listener.mjs`：飞书群消息长连接监听入口。
- `src/group-pipeline.mjs`：群消息证据、判断、入库、实时卡片流水线。
- `src/run-external-monitor.mjs`：小红书、微博、哔哩哔哩双周采集。
- `src/run-template-sync-card.mjs`：读取真实问题库并发送双周卡片。
- `src/run-biweekly-cycle.mjs`：双周锚点与采集/发送分阶段执行。
- `src/setup.mjs` / `src/doctor.mjs`：初始化和配置检查。
- `ops/`：PM2 与 cron 部署示例。
- `docs/`：规则、配置、飞书接入、部署和排障。
- `test/`：群事件解析与规则闸门测试。

## 安全边界

仓库禁止提交：

- 真实 Base token、table/view/field ID、chat_id、open_id。
- webhook、App Secret、账号密码、Cookie、浏览器登录态。
- `config.local.json`、`.env`、`.agent-profiles/`。
- 原帖图片、群截图、临时 payload、raw records 和运行日志。

`npm run check` 会执行测试和敏感信息扫描。发现敏感内容时必须停止提交。

## 规则摘要

四个问题分类：

- 界面显示与适配问题：看不全、显示错。
- 信息表达与理解问题：看不懂、易误解。
- 操作交互与反馈问题：不好点、没反馈。
- 任务流程与闭环问题：做不完、没后续。

当前进度：

- 待确认
- 已收录待跟进
- 已转业务跟进
- 跟进中
- 已解决
- 不采纳

详细口径以 [收录规则](docs/after-sales-collection-rules.md) 为准。

## 文档

- [配置说明](docs/CONFIGURATION.md)
- [同事快速开始](docs/COWORKER-QUICKSTART.md)
- [完整包清单](docs/PACKAGE-CONTENTS.md)
- [飞书应用接入](docs/FEISHU_APP_SETUP.md)
- [部署与定时任务](docs/DEPLOYMENT.md)
- [能力边界](docs/CAPABILITY-MATRIX.md)
- [排障手册](docs/TROUBLESHOOTING.md)
- [复用说明](docs/agent-reuse-package.md)
- [收录规则](docs/after-sales-collection-rules.md)
- [卡片规则](docs/card-sync-rules.md)
- [卡片模板变量契约](docs/CARD-TEMPLATE-CONTRACT.md)
