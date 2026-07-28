# 同事快速开始

本目录是完整 Agent，不是规则文档或卡片脚本合集。请保留整个
`ecom-aftersale-ux-issue-collector-agent` 目录。

开始前先完整阅读 [统一接入清单](START-HERE.md)。其中列出了同事必须自行替换的所有
真实信息；仅拿到“问题识别规则表”不等于拿到了可入库的问题库。

## 1. 安装

```bash
cd ecom-aftersale-ux-issue-collector-agent
npm install
npm run verify:package
npm run setup
```

`setup` 会生成不会提交到 Git 的两个本地文件：

- `config.local.json`：Base、表、字段、群、卡片和调度配置。
- `.env`：飞书应用凭证和可选 webhook。

安装依赖后可立即验证实时群监听链路：

```bash
npm run group:dry-run
```

该命令使用脱敏的测试配置和模拟群消息，只生成本地校验结果；不会读取真实 Base、不会发送机器人消息，也不需要填写账号或密钥。

## 2. 按顺序替换

1. Base token 和 5 张表的 `table_id`。
2. 截图附件字段 `field_id`，以及与同事 Base 一致的字段显示名称。
3. 双周合并卡片模板 ID、实时单条卡片模板 ID、问题库完整 URL。
4. 目标群 webhook 或 `chat_id`。
5. 两个反馈群和人工录入群的真实 `chat_id`。
6. 飞书自建应用的 App ID、App Secret、消息事件订阅和权限。
7. 订单、物流、售后&权益、客服、行业的负责人映射。
8. 双周锚点日期与时区。

卡片不是只填一个 ID 就能工作。复制或新建模板后，必须按照
[卡片模板变量契约](CARD-TEMPLATE-CONTRACT.md) 绑定文字、循环数组、图片
`img_key`、图片预览、来源按钮和问题收集表按钮。

详细路径见 [配置说明](CONFIGURATION.md)。

## 3. 开通实时群监听

实时监听需要飞书自建应用，不是只有机器人 webhook 就能工作：

1. 给应用开通机器人能力。
2. 使用长连接订阅 `im.message.receive_v1`。
3. 把机器人加入两个反馈群和人工录入群。
4. 给应用读取群消息、下载消息图片、上传图片和发送消息权限。
5. 发布应用版本并完成管理员审批。
6. 将 App ID / Secret 写入本机 `.env`。

完成后启动：

```bash
npm run group:listen
```

详细步骤见 [飞书应用接入](FEISHU_APP_SETUP.md)。

## 4. 登录外部平台

```bash
npm run login:xhs
npm run login:weibo
npm run login:bilibili
```

登录态只保存在本机 `.agent-profiles/`，不能发给其他人，也不能提交 Git。

## 5. 验收

```bash
npm run doctor
npm run verify:access
npm run group:dry-run
npm run card:dry-run
npm run check
```

全部通过后再启动常驻监听和双周任务。若没有符合规则的真实问题，Agent 不会用示例数据补齐。

## 6. 正式运行

```bash
# 常驻实时群监听
npm run group:listen

# 双周执行周二 11:00 采集
npm run biweekly:collect

# 双周执行周二 15:30 发送
npm run biweekly:send
```

常驻和定时部署见 [部署说明](DEPLOYMENT.md)。

## 7. 不得共享

- `config.local.json`、`.env`
- `.agent-profiles/`
- `runtime/`、`tmp/`
- Cookie、登录态、App Secret、webhook、chat_id、open_id
- 原始用户截图、采集图片和运行日志

遇到缺权限、收不到群消息、卡片不发或登录失效时，查阅
[排障手册](TROUBLESHOOTING.md)。
