# 交易售后体验问题收集 Agent 复用说明

目标：把一套“渠道采集 -> 体验设计问题识别 -> 多维表格入库 -> 机器人同步”的能力迁移到新的业务场景。

## 1. 迁移前必须确认

- 已安装并登录 `lark-cli`。
- 当前账号有目标 Base 的读写权限。
- 当前账号有目标群的读取和发送权限。
- 小红书、微博、哔哩哔哩等外部平台必须使用真实授权账号登录。
- 不得绕过平台风控，不得使用未授权数据源。

## 2. 两张核心表

### 问题识别规则表

用途：告诉 Agent 什么能收、什么不能收、怎么分类、怎么分配、怎么判断优先级。

建议视图：

1. 填写说明
2. 渠道开关
3. 页面和负责人映射
4. 类型和优先级定义
5. 全部字段（Agent用）

### 走查问题收集

用途：问题入库、人工确认、跟进、机器人同步。

建议字段：

- 问题描述
- 截图（问题+原帖）
- 优先级
- 负责人
- 场景
- 问题分类
- 原始吐槽摘要
- 链接
- 来源
- 日期
- 当前进度

## 3. 复用流程

1. 运行 `npm install && npm run setup`。
2. 按 `docs/CONFIGURATION.md` 替换目标 Base、字段、群、卡片模板和机器人配置。
3. 按 `docs/FEISHU_APP_SETUP.md` 为自建应用订阅 `im.message.receive_v1`。
4. 把机器人加入两个实时反馈群和人工录入群。
5. 运行三个平台登录命令，保存本机授权登录态。
6. 把业务规则和负责人写入规则表。
7. 运行 `npm run doctor`、`npm run group:dry-run`、`npm run card:dry-run`。
8. 运行 `npm run check`，确认没有敏感信息和 mock 数据。
9. 启动 `npm run group:listen`，再配置双周采集与发送。

群消息实时监听实现位于：

- `src/run-group-listener.mjs`
- `src/group-event.mjs`
- `src/group-pipeline.mjs`
- `src/lark-openapi.mjs`
- `src/state-store.mjs`

不要只复制 README 或规则表；以上代码和 `ops/` 必须一并交付。

## 4. 禁止提交

- `config.local.json`
- `.env`
- `.agent-profiles/`
- `tmp/`
- `lark-im-resources/`
- 真实 webhook、token、chat_id、open_id
- 带 token 的社媒链接
- 用户原始截图和采集临时文件
