import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { arg, loadConfig } from "./config.mjs";

const config = loadConfig(arg("config") || "config.local.json");
const checks = [];
const warnings = [];
const realtimeEnabled = config.realtimeGroups?.enabled !== false;
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
];
const missingRequired = requiredPaths.filter((keyPath) => !configured(readPath(config, keyPath)));
const sourceChecks = (config.realtimeGroups?.sources || []).map((item, index) => ({
  path: `realtimeGroups.sources[${index}].chatId`,
  label: item.label || `来源群 ${index + 1}`,
  ok: configured(item.chatId),
}));

check("Node.js 版本", Number(process.versions.node.split(".")[0]) >= 18, process.versions.node);
check("核心配置", missingRequired.length === 0, missingRequired.join("、"));
check("飞书 App ID", !realtimeEnabled || configured(process.env.LARK_APP_ID), "实时群监听已启用，请在 .env 中设置");
check("飞书 App Secret", !realtimeEnabled || configured(process.env.LARK_APP_SECRET), "实时群监听已启用，请在 .env 中设置");
check("lark-cli 可用", commandExists("lark-cli"), "请安装并登录 lark-cli");
check(
  "实时来源群",
  !realtimeEnabled || (sourceChecks.length > 0 && sourceChecks.every((item) => item.ok)),
  sourceChecks.filter((item) => !item.ok).map((item) => `${item.label} (${item.path})`).join("、")
);
if (!configured(process.env.LARK_BOT_WEBHOOK) && !configured(config.progressBot?.chatId)) {
  warnings.push("未配置 LARK_BOT_WEBHOOK 或 progressBot.chatId，卡片发送会失败。");
}
for (const [scene, owners] of Object.entries(config.ownerMappings || {})) {
  if (!Array.isArray(owners) || owners.length === 0) warnings.push(`负责人映射尚未填写：ownerMappings.${scene}`);
}

for (const item of checks) console.log(`${item.ok ? "PASS" : "FAIL"}  ${item.name}${item.detail ? ` - ${item.detail}` : ""}`);
for (const warning of warnings) console.log(`WARN  ${warning}`);
const report = {
  checkedAt: new Date().toISOString(),
  configPath: config.__path,
  required: requiredPaths.map((keyPath) => ({ keyPath, configured: configured(readPath(config, keyPath)) })),
  realtimeSources: sourceChecks,
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
