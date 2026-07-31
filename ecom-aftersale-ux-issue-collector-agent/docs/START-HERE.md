# 从这里开始：完整接入清单

这是一套完整能力包，但出于安全要求，不会携带任何人的真实 Base token、App Secret、
chat_id、webhook、Cookie 或登录态。同事首次安装后，必须把下面的占位信息替换成自己有
权限的真实信息。缺一项时 `npm run doctor` 会阻止启动，不会用示例数据兜底。

## 一、先确认拿到的是完整目录

```bash
npm install
npm run verify:package
npm run setup
```

必须能看到：

- `.env.example`、`config.template.json`
- `src/run-group-listener.mjs`、`src/group-pipeline.mjs`
- `src/run-external-monitor.mjs`、`src/run-template-sync-card.mjs`
- `docs/`、`ops/`、`test/`

缺少任一监听入口时，说明拿到的不是完整包。

## 二、同事必须替换的真实信息

### 1. 飞书自建应用

在本机 `.env` 中填写：

| 配置 | 用途 |
| --- | --- |
| `LARK_APP_ID` | 启动飞书长连接 |
| `LARK_APP_SECRET` | 长连接鉴权、下载群图片、上传卡片图片 |
| `LARK_BOT_WEBHOOK` | 将实时/双周卡片发到目标群；若改用 `progressBot.chatId` 可留空 |

飞书后台必须启用机器人，使用长连接订阅 `im.message.receive_v1`，并发布已审批的应用版本。

### 2. 三个实时来源群

在 `config.local.json > realtimeGroups.sources` 中填写三个互不相同的 `chatId`：

1. 抖音商城问题反馈吐槽群，`mode: "feedback"`。
2. 抖音商城 App（独立端）问题反馈群，`mode: "feedback"`。
3. 人工录入群，`mode: "mention"`，并把 `mentionNames` 改为群内机器人真实显示名。

机器人必须已经加入这三个群。群名只用于日志，程序按 `chat_id` 匹配。

### 3. 完整问题库，不是只有规则表

填写同一个问题库 Base 的 `baseToken`，并分别填写：

| 配置路径 | 对应表 |
| --- | --- |
| `tables.rules` | 填写说明/收录规则表 |
| `tables.channelConfig` | 渠道开关表 |
| `tables.pageRules` | 页面和负责人映射表 |
| `tables.typePriorityRules` | 类型和优先级定义表 |
| `tables.issues` | 正式体验问题收集表 |

如果手中 Base 只有规则表，没有正式问题表，不能启动正式入库。请先复制完整问题库或获得原
问题库权限，不要把规则表的 `table_id` 重复填入五个位置。

正式问题表至少要有以下字段；名称不一致时只修改配置右侧值：

| 配置路径 | 默认字段名 | 用途 |
| --- | --- | --- |
| `fields.title` | 问题描述 | 精简问题标题 |
| `fields.problem` | 原始吐槽摘要 | 具体异常和用户影响 |
| `fields.priority` | 优先级 | P0/P1/P2 |
| `fields.owners` | 负责人 | 对应设计师 |
| `fields.images` | 截图（问题+原帖） | 真实证据附件 |
| `fields.imagesFieldId` | 无默认值 | 上传附件必须使用的 field_id |
| `fields.source` | 来源 | 小红书/微博/B站/具体群 |
| `fields.sourceUrl` | 链接 | 原帖或群消息定位 |
| `fields.page` | 场景 | 订单/物流/售后&权益/客服/行业 |
| `fields.category` | 问题分类 | 四分类 |
| `fields.progress` | 当前进度 | 新录入固定待确认 |
| `fields.date` | 日期 | 原帖或群消息日期 |

### 4. 两套卡片与发送目标

填写：

- `cardTemplate.templateId`：双周合并卡片的已发布模板 ID。
- `cardTemplate.realtimeTemplateId`：两个反馈群和人工录入命中后使用的实时单条模板 ID。
- `cardTemplate.issueBaseUrl`：底部“打开问题收集表”按钮的完整 URL。
- `.env.LARK_BOT_WEBHOOK` 或 `progressBot.chatId`：卡片实际接收群。

复制卡片模板后，还必须按 `CARD-TEMPLATE-CONTRACT.md` 绑定文字变量、图片
`img_key`、图片预览、来源 URL 和问题收集表 URL。

### 5. 负责人映射

`ownerMappings` 的五个场景都必须填写：

- 订单
- 物流
- 售后&权益
- 客服
- 行业

人员值必须是目标 Base 人员字段可以接受的真实成员。负责人映射表是事实来源，本地映射为
实时流水线兜底；两处都不能继续保留空数组。

### 6. 外部平台登录

```bash
npm run login:xhs
npm run login:weibo
npm run login:bilibili
```

登录态写入本机 `.agent-profiles/`，不得分享或提交。

## 三、启动前的唯一验收顺序

```bash
npm run doctor
npm run verify:access
npm run group:dry-run
npm run card:dry-run
npm run check
```

- `doctor`：确认包、App、三群、五表、字段、卡片、目标群和负责人均已配置。
- `verify:access`：实际验证当前账号能访问五张表。
- `group:dry-run`：验证群消息解析、截图和规则闸门，不写真实 Base。
- `card:dry-run`：只预览真实问题数据，不发送。
- `check`：语法、测试、完整性和敏感信息扫描。

全部通过后才可以：

```bash
npm run group:listen
npm run biweekly:collect
npm run biweekly:send
```

常驻部署及双周任务见 `DEPLOYMENT.md`。

## 四、明确不会随包提供的内容

以下内容缺失不是包漏传，而是必须由使用者在本机替换：

- 真实 App ID / App Secret
- 真实 Base token、table/view/field ID
- 真实 chat_id、open_id、webhook
- 卡片模板的租户内真实 ID
- 小红书、微博、哔哩哔哩 Cookie 与登录态
- 用户截图、原帖图片和运行日志

这些内容一旦进入 Git，安全扫描会失败并禁止提交。
