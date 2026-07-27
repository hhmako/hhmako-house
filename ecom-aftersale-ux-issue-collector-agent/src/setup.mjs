import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPlaceholders } from "./config.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const template = path.join(root, "config.template.json");
const target = path.join(root, "config.local.json");
const envTemplate = path.join(root, ".env.example");
const envTarget = path.join(root, ".env");

if (!fs.existsSync(target)) fs.copyFileSync(template, target);
if (!fs.existsSync(envTarget)) fs.copyFileSync(envTemplate, envTarget);

const config = JSON.parse(fs.readFileSync(target, "utf8"));
const placeholders = findPlaceholders(config);
const checklist = {
  generatedAt: new Date().toISOString(),
  localFiles: {
    config: target,
    environment: envTarget,
  },
  requiredActions: [
    "替换 Base token、5 张表的 table_id、截图附件 field_id",
    "替换双周卡片和实时单条卡片 template_id",
    "替换问题收集表 URL 与卡片目标 webhook/chat_id",
    "替换 3 个实时群 chat_id，并在自建应用中订阅 im.message.receive_v1",
    "填写每个场景的负责人映射",
    "分别登录小红书、微博和哔哩哔哩",
  ],
  placeholders,
};
fs.writeFileSync(path.join(root, "config.report.json"), JSON.stringify(checklist, null, 2));
console.log(`已准备本地配置：${target}`);
console.log(`已准备环境变量：${envTarget}`);
console.log(`已生成替换清单：${path.join(root, "config.report.json")}`);
console.log("请替换以下项目（真实值不会被 Git 提交）：");
for (const item of placeholders) console.log(`- ${item}`);
console.log("- .env: LARK_APP_ID");
console.log("- .env: LARK_APP_SECRET");
console.log("- .env: LARK_BOT_WEBHOOK（如使用 webhook 发卡片）");
console.log("\n完成后运行：npm run doctor");
