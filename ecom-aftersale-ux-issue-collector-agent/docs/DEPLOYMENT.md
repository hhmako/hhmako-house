# 部署与定时任务

## 常驻群监听

```bash
npx pm2 start ops/ecosystem.config.cjs
npx pm2 logs ux-issue-group-listener
```

## 双周调度

将 `ops/crontab.example` 中的 `REPO_DIR` 改成实际绝对路径后写入调度系统。

- 每周二 11:00 触发采集；脚本根据双周锚点决定执行或跳过。
- 每周二 15:30 触发卡片发送；同样使用双周锚点。
- 采集和发送分开执行，避免采集失败后仍误发旧数据。

手动验证：

```bash
npm run biweekly:collect -- --force
npm run biweekly:preview -- --force
npm run biweekly:send -- --force
```

正式环境不建议使用 `--force`。

## 发布前闸门

```bash
npm run doctor
npm run check
```

任何一项失败都不要启动定时任务。
