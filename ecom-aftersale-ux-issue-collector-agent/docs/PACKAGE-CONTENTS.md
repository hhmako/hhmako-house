# 完整包清单

交付给同事时，以下目录和文件必须一起保留。

## 核心入口

- `src/run-group-listener.mjs`：飞书反馈群和人工 @ 群实时监听。
- `src/group-event.mjs`：文字、图片、富文本消息解析与相邻消息合并。
- `src/group-pipeline.mjs`：证据下载、规则判断、去重、Base 入库和实时卡片。
- `src/lark-openapi.mjs`：消息图片下载、卡片图片上传。
- `src/run-external-monitor.mjs`：小红书、微博、哔哩哔哩双周增量采集。
- `src/run-template-sync-card.mjs`：双周卡片真实数据读取与发送。
- `src/run-biweekly-cycle.mjs`：双周锚点和采集/发送阶段控制。
- `src/rules-engine.mjs`：体验问题准入、四分类、优先级和负责人映射。
- `src/lark-base.mjs`：Base 记录和附件操作。
- `src/state-store.mjs`：群消息及外网增量去重状态。

## 安装与运维

- `src/setup.mjs`：生成本地配置和替换清单。
- `src/doctor.mjs`：检查配置、应用凭证、群和命令依赖。
- `src/security-scan.mjs`：阻止敏感信息和临时图片进入 Git。
- `src/check-syntax.mjs`：检查全部脚本语法。
- `ops/ecosystem.config.cjs`：PM2 常驻监听示例。
- `ops/crontab.example`：双周定时任务示例。

## 授权与采集辅助

- `src/social-login.mjs`：三平台授权登录态维护。
- `src/capture-url.mjs`：页面取证辅助。
- `src/upload-post-images.mjs`：原帖证据附件处理。
- `src/image-scene.mjs`：截图场景检查。

## 配置与规则

- `config.template.json`：所有可替换配置的占位模板。
- `.env.example`：密钥环境变量模板。
- `docs/after-sales-collection-rules.md`：完整收录规则。
- `docs/card-sync-rules.md`：实时与双周卡片规则。
- `docs/CONFIGURATION.md`：逐项替换说明。
- `docs/FEISHU_APP_SETUP.md`：实时事件监听接入。
- `docs/CARD-TEMPLATE-CONTRACT.md`：双周与实时卡片的全部变量、类型和组件绑定。
- `docs/DEPLOYMENT.md`：部署与调度。
- `docs/TROUBLESHOOTING.md`：排障。
- `test/fixtures/config.test.json`：不含真实凭证的离线试跑配置。
- `test/fixtures/group-event.json`：脱敏群消息事件样例。
- `test/`：群消息、规则和卡片校验测试。

## 完整性验收

```bash
npm install
npm run group:dry-run
npm run check
```

`group:dry-run` 不连接真实 Base，也不发送群消息。

对照卡片变量契约，确认同事自己的模板已绑定文字、图片预览和真实来源按钮。

如果缺少 `run-group-listener.mjs`、`group-event.mjs`、`group-pipeline.mjs` 或
`@larksuiteoapi/node-sdk`，该包不具备实时群消息监听能力。

不要用压缩包覆盖团队分支。团队协作应在现有 Git 分支上增量提交并通过 PR 审核。
