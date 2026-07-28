import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { arg, loadConfig } from "./config.mjs";

const config = loadConfig(arg("config") || "config.local.json");
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const checks = [];
const warnings = [];
const realtimeEnabled = config.realtimeGroups?.enabled !== false;
const expectedFiles = [
  ".env.example",
  "config.template.json",
  "src/run-group-listener.mjs",
  "src/group-pipeline.mjs",
  "src/group-event.mjs",
  "src/lark-openapi.mjs",
  "src/run-external-monitor.mjs",
  "src/run-template-sync-card.mjs",
  "docs/START-HERE.md",
  "docs/FEISHU_APP_SETUP.md",
  "docs/CARD-TEMPLATE-CONTRACT.md",
  "docs/after-sales-collection-rules.md",
];
const requiredPaths = [
  "baseToken",
  "tables.rules",
  "tables.channelConfig",
  "tables.pageRules",
  "tables.typePriorityRules",
  "tables.issues",
  "fields.imagesFieldId",
  "cardTemplate.templateId",
  "cardTemplate.realtimeTemplateId",
  "cardTemplate.issueBaseUrl",
  "fields.title",
  "fields.problem",
  "fields.priority",
  "fields.owners",
  "fields.images",
  "fields.source",
  "fields.sourceUrl",
  "fields.page",
  "fields.category",
  "fields.progress",
  "fields.date",
];
const missingRequired = requiredPaths.filter((keyPath) => !configured(readPath(config, keyPath)));
const sourceChecks = (config.realtimeGroups?.sources || []).map((item, index) => ({
  path: `realtimeGroups.sources[${index}].chatId`,
  label: item.label || `来源群 ${index + 1}`,
  ok: configured(item.chatId),
}));

check("Node.js 版本", Number(process.versions.node.split(".")[0]) >= 18, process.versions.node);
check(
  "能力包完整性",
  expectedFiles.every((file) => fs.existsSync(path.join(root, file))),
  expectedFiles.filter((file) => !fs.existsSync(path.join(root, file))).join("、")
);
check("核心配置", missingRequired.length === 0, missingRequired.join("、"));
check("飞书 App ID", !realtimeEnabled || configured(process.env.LARK_APP_ID), "实时群监听已启用，请在 .env 中设置");
check("飞书 App Secret", !realtimeEnabled || configured(process.env.LARK_APP_SECRET), "实时群监听已启用，请在 .env 中设置");
check("lark-cli 可用", commandExists("lark-cli"), "请安装并登录 lark-cli");
check(
  "实时来源群",
  !realtimeEnabled || (sourceChecks.length === 3 && sourceChecks.every((item) => item.ok)),
  sourceChecks.filter((item) => !item.ok).map((item) => `${item.label} (${item.path})`).join("、")
);
check(
  "实时来源群唯一性",
  !realtimeEnabled || new Set((config.realtimeGroups?.sources || []).map((item) => item.chatId)).size === 3,
  "两个反馈群与人工录入群必须使用三个不同 chat_id"
);
check(
  "人工录入群触发方式",
  !realtimeEnabled || (config.realtimeGroups?.sources || []).some((item) => (
    item.mode === "mention" && Array.isArray(item.mentionNames) && item.mentionNames.length > 0
  )),
  "必须有一个 mode=mention 的人工录入群，并填写 mentionNames"
);
check(
  "卡片发送目标",
  configured(process.env.LARK_BOT_WEBHOOK) || configured(config.progressBot?.chatId),
  "请配置 LARK_BOT_WEBHOOK 或 progressBot.chatId"
);
const expectedScenes = ["订单", "物流", "售后&权益", "客服", "行业"];
const missingOwnerMappings = expectedScenes.filter((scene) => {
  const owners = config.ownerMappings?.[scene];
  return !Array.isArray(owners) || owners.length === 0;
});
check("负责人映射", missingOwnerMappings.length === 0, missingOwnerMappings.join("、"));

for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
for (const warning of warnings) console.log(`WARN  ${warning}`);
const report = {
  checkedAt: new Date().toISOString(),
  configPath: config.__path,
  required: requiredPaths.map((keyPath) => ({ keyPath, configured: configured(readPath(config, keyPath)) })),
  realtimeSources: sourceChecks,
  expectedFiles: expectedFiles.map((file) => ({ file, exists: fs.existsSync(path.join(root, file)) })),
  ownerMappings: expectedScenes.map((scene) => ({
    scene,
    configured: !missingOwnerMappings.includes(scene),
  })),
  environment: {
    LARK_APP_ID: configured(process.env.LARK_APP_ID),
    LARK_APP_SECRET: configured(process.env.LARK_APP_SECRET),
    LARK_BOT_WEBHOOK: configured(process.env.LARK_BOT_WEBHOOK),
    ISSUE_ANALYZER_COMMAND: configured(process.env.ISSUE_ANALYZER_COMMAND),
  },
  checks,
  warnings,
};
fs.writeFileSync(path.join(path.dirname(config.__path), "config.report.json"), JSON.stringify(report, null, 2));
console.log(`INFO  配置报告已生成：${path.join(path.dirname(config.__path), "config.report.json")}`);
if (checks.some((item) => !item.ok)) process.exitCode = 1;

function check(name, ok, detail) {
  checks.push({ name, ok, detail: ok ? "" : detail });
}

function commandExists(command) {
  try {
    execFileSync("zsh", ["-lic", `command -v ${command}`], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function readPath(value, keyPath) {
  return keyPath.split(".").reduce((current, key) => current?.[key], value);
}

function configured(value) {
  return value !== undefined
    && value !== null
    && String(value).trim() !== ""
    && !/<[^>]+>|replace_me/i.test(String(value));
}
