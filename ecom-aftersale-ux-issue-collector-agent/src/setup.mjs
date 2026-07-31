import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { findPlaceholders } from "./config.mjs";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const template = path.join(root, "config.template.json");
const target = path.join(root, "config.local.json");
const envTemplate = path.join(root, ".env.example");
const envTarget = path.join(root, ".env");

if (!fs.existsSync(envTemplate)) {
  throw new Error("能力包不完整：缺少 .env.example。请重新拉取完整团队分支，不要继续启动。");
}
if (!fs.existsSync(target)) fs.copyFileSync(template, target);
if (!fs.existsSync(envTarget)) fs.copyFileSync(envTemplate, envTarget);

const config = JSON.parse(fs.readFileSync(target, "utf8"));
const placeholders = findPlaceholders(config);
const requiredReplacements = [
  { group: "飞书自建应用", path: ".env.LARK_APP_ID", purpose: "长连接接收 im.message.receive_v1" },
  { group: "飞书自建应用", path: ".env.LARK_APP_SECRET", purpose: "长连接鉴权与群图片下载" },
  { group: "问题库", path: "baseToken", purpose: "问题规则和问题记录所在 Base" },
  { group: "问题库", path: "tables.rules", purpose: "填写说明/收录规则表" },
  { group: "问题库", path: "tables.channelConfig", purpose: "渠道开关表" },
  { group: "问题库", path: "tables.pageRules", purpose: "页面和负责人映射表" },
  { group: "问题库", path: "tables.typePriorityRules", purpose: "类型和优先级定义表" },
  { group: "问题库", path: "tables.issues", purpose: "正式体验问题记录表" },
  { group: "问题库", path: "fields.imagesFieldId", purpose: "问题截图附件字段 ID" },
  { group: "卡片", path: "cardTemplate.templateId", purpose: "双周合并卡片模板" },
  { group: "卡片", path: "cardTemplate.realtimeTemplateId", purpose: "实时单条卡片模板" },
  { group: "卡片", path: "cardTemplate.issueBaseUrl", purpose: "打开问题收集表按钮" },
  { group: "发送目标", path: ".env.LARK_BOT_WEBHOOK 或 progressBot.chatId", purpose: "卡片接收群" },
  { group: "实时来源", path: "realtimeGroups.sources[0].chatId", purpose: "抖音商城问题反馈吐槽群" },
  { group: "实时来源", path: "realtimeGroups.sources[1].chatId", purpose: "抖音商城 App（独立端）问题反馈群" },
  { group: "实时来源", path: "realtimeGroups.sources[2].chatId", purpose: "人工 @ 录入群" },
  { group: "负责人", path: "ownerMappings.*", purpose: "订单/物流/售后&权益/客服/行业负责人" },
];
const checklist = {
  generatedAt: new Date().toISOString(),
  localFiles: {
    config: target,
    environment: envTarget,
  },
  requiredActions: [
    "替换 Base token、5 张表的 table_id、问题表全部字段名和截图附件 field_id",
    "替换双周卡片和实时单条卡片 template_id",
    "替换问题收集表 URL 与卡片目标 webhook/chat_id",
    "替换 3 个实时群 chat_id，并在自建应用中订阅 im.message.receive_v1",
    "填写每个场景的负责人映射",
    "分别登录小红书、微博和哔哩哔哩",
  ],
  requiredReplacements,
  placeholders,
};
fs.writeFileSync(path.join(root, "config.report.json"), JSON.stringify(checklist, null, 2));
console.log(`已准备本地配置：${target}`);
console.log(`已准备环境变量：${envTarget}`);
console.log(`已生成替换清单：${path.join(root, "config.report.json")}`);
console.log(`完整接入步骤：${path.join(root, "docs", "START-HERE.md")}`);
console.log("请替换以下项目（真实值不会被 Git 提交）：");
for (const item of placeholders) console.log(`- ${item}`);
console.log("- .env: LARK_APP_ID");
console.log("- .env: LARK_APP_SECRET");
console.log("- .env: LARK_BOT_WEBHOOK（如使用 webhook 发卡片）");
console.log("\n完成后依次运行：npm run doctor && npm run verify:access && npm run group:dry-run");
