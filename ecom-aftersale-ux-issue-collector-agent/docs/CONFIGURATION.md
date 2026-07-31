# 配置说明

共享仓库只提供占位配置。每位使用者都必须替换为自己有权限的 Base、群、机器人和飞书应用。

## 1. 初始化

```bash
npm install
npm run setup
```

该命令生成：

- `config.local.json`：本机业务配置。
- `.env`：本机密钥配置。

两者均被 `.gitignore` 排除。

## 2. `config.local.json` 必须替换

### 多维表格

| 路径 | 填写内容 | 获取位置 |
| --- | --- | --- |
| `baseToken` | 问题库 Base token | Base URL 或 OpenAPI |
| `tables.rules` | 规则表 table_id | Base 开发者信息 |
| `tables.channelConfig` | 渠道开关表 table_id | 同上 |
| `tables.pageRules` | 页面与负责人映射表 table_id | 同上 |
| `tables.typePriorityRules` | 类型和优先级表 table_id | 同上 |
| `tables.issues` | 体验问题收集表 table_id | 同上 |
| `fields.imagesFieldId` | 截图附件字段 field_id | 字段 API / `lark-cli base +field-list` |

字段显示名称也必须与目标 Base 一致。若同事的表中叫“场域”而不是“场景”，修改
`fields.page`，不要改代码。

### 卡片与发送目标

| 路径 | 填写内容 |
| --- | --- |
| `cardTemplate.templateId` | 双周合并卡片的已发布模板 ID |
| `cardTemplate.realtimeTemplateId` | 实时单条卡片的已发布模板 ID |
| `cardTemplate.issueBaseUrl` | 问题收集表完整 URL |
| `progressBot.chatId` | 未使用 webhook 时，机器人发送目标群 chat_id |

模板中的变量名如有不同，在 `cardTemplate.realtimeVariables` 中映射，不要把真实数据写死在模板。

### 实时来源群

在 `realtimeGroups.sources` 中逐项替换：

- `chatId`：目标群真实 chat_id。
- `label`：便于日志辨认的群名。
- `sourceValue`：写入 Base“来源”字段的值。
- `mode: "feedback"`：群内所有新消息均进入候选队列。
- `mode: "mention"`：只有 @ 指定机器人名称时进入候选队列。
- `mentionNames`：人工录入群允许触发的机器人显示名。

不要在仓库里提交 chat_id。

### 负责人映射

`ownerMappings` 的值必须使用目标 Base 人员字段能够接受的人员对象或名称。建议以规则表
“页面和负责人映射”为事实来源；本地映射只作为实时群流水线的兜底。

### 双周时间

- `schedule.biweeklyAnchorDate`：首个执行周二，格式 `YYYY-MM-DD`。
- `schedule.collectCron`：默认周二 11:00。
- `schedule.sendCron`：默认周二 15:30。
- `schedule.lookbackDays`：默认 14。

脚本会用锚点判断当前是不是执行周，cron 可以每周触发，非双周自动跳过。

## 3. `.env` 必须替换

```dotenv
LARK_APP_ID=你的自建应用AppID
LARK_APP_SECRET=你的自建应用AppSecret
LARK_BOT_WEBHOOK=可选的目标群机器人Webhook
ISSUE_ANALYZER_COMMAND=可选的外部语义分析命令
```

- `LARK_APP_ID` / `LARK_APP_SECRET` 用于长连接收群消息和下载群图片。
- `LARK_BOT_WEBHOOK` 用于发卡片；未配置时改用 `progressBot.chatId` 和 `lark-cli`。
- 不需要外部分析器时，`ISSUE_ANALYZER_COMMAND` 留空。

## 4. 外部平台登录态

```bash
npm run login:xhs
npm run login:weibo
npm run login:bilibili
```

登录态保存在 `.agent-profiles/`，只能留在运行机器上。不得复制到共享仓库。

## 5. 检查

```bash
npm run doctor
npm run group:dry-run
npm run card:dry-run
npm run check
```

`doctor` 只检查本地结构和必填项；飞书后台的事件订阅、权限和应用版本仍需按
[飞书应用接入](FEISHU_APP_SETUP.md) 人工确认。
