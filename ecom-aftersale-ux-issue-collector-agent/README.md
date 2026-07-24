# 交易售后体验问题收集 Agent

这是一套面向交易售后场景的“收集 -> 识别 -> 录入 -> 同步”能力包。业务规则不写死在代码里，运行时从飞书多维表格读取。

## 包含能力

- 外部渠道采集：小红书、微博、哔哩哔哩、飞书反馈群等授权来源。
- 体验设计问题识别：只收录可定位页面、可证明体验断点、可通过产品设计优化的问题。
- 多维表格写入：把问题、截图、来源、负责人、状态写入统一问题库。
- 同步卡片：读取问题库真实数据，通过已发布飞书卡片模板推送双周新录入、双周已解决、未跟进提醒。
- 实时卡片：吐槽群、抖音商城 App 独立端反馈群、人工录入的问题，实时发送单条卡片。
- 售后专家话题辅助：当前默认使用链接/草稿辅助方式，售后专家“一键发送”按钮链路暂停，不作为默认能力启用。

## 安全原则

共享包中不能提交以下内容：

- 真实 Base token、table id、view id
- webhook、app secret、user token、tenant token
- 账号密码、cookie、浏览器登录态
- 真实 open_id、chat_id、thread_id
- 采集图片、临时截图、payload、raw records
- `config.local.json`、`.env`、`.agent-profiles/`、`tmp/`

请复制 `config.template.json` 为 `config.local.json` 后再填真实配置。

## 前置依赖

- 已安装并登录 `lark-cli`
- 有目标 Base 和群聊权限
- Node.js 18+
- Playwright 依赖
- 小红书/微博/哔哩哔哩采集需要使用授权账号人工登录

权限检查：

```bash
lark-cli auth status
lark-cli base +table-list --as user --base-token <BASE_TOKEN>
```

## 常用命令

刷新登录态：

```bash
node src/social-login.mjs --channel xiaohongshu --profiles-dir .agent-profiles
node src/social-login.mjs --channel weibo --profiles-dir .agent-profiles
```

运行采集：

```bash
node src/run-external-monitor.mjs --config config.local.json
```

预览同步卡片 payload：

```bash
node src/run-template-sync-card.mjs --config config.local.json --dry-run
```

发送同步卡片：

```bash
LARK_BOT_WEBHOOK="<WEBHOOK_URL>" node src/run-template-sync-card.mjs --config config.local.json --send
```

## 文档

- `docs/agent-reuse-package.md`：通用复用说明。
- `docs/after-sales-collection-rules.md`：交易售后体验设计问题收录规则。
- `docs/card-sync-rules.md`：飞书卡片同步规则和发送前校验。
- `docs/aftersale-expert-workflow.md`：售后专家话题辅助与按钮暂停规则。

## 当前规则摘要

问题分类只允许以下 4 类：

- 界面显示与适配问题：看不全、显示错。
- 信息表达与理解问题：看不懂、易误解。
- 操作交互与反馈问题：不好点、没反馈。
- 任务流程与闭环问题：做不完、没后续。

当前进度只允许：

- 待确认
- 已收录待跟进
- 已转业务跟进
- 跟进中
- 已解决
- 不采纳

新记录默认写入 `待确认`。

双周卡片只展示两周内新录入的问题和两周内已解决的问题；待确认且无人跟进的问题只展示数量提醒；`不采纳` 不再进入进度更新卡片。
