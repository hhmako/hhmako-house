import { arg, loadConfig, requireConfig } from "./config.mjs";
import { larkCli } from "./lark-base.mjs";

const config = loadConfig(arg("config") || "config.local.json");
requireConfig(config, [
  "baseToken",
  "tables.rules",
  "tables.channelConfig",
  "tables.pageRules",
  "tables.typePriorityRules",
  "tables.issues",
]);

const tables = [
  ["填写说明/收录规则表", config.tables.rules],
  ["渠道开关表", config.tables.channelConfig],
  ["页面和负责人映射表", config.tables.pageRules],
  ["类型和优先级定义表", config.tables.typePriorityRules],
  ["体验问题收集表", config.tables.issues],
];
let failed = false;
for (const [label, tableId] of tables) {
  try {
    const result = larkCli([
      "base",
      "+field-list",
      "--as",
      "user",
      "--base-token",
      config.baseToken,
      "--table-id",
      tableId,
      "--limit",
      "200",
      "--format",
      "json",
    ]);
    const count = countFields(result);
    console.log(`PASS  ${label} 可访问，字段数 ${count}`);
  } catch (error) {
    failed = true;
    console.error(`FAIL  ${label} 无法访问：${error.message.split("\n")[0]}`);
  }
}
if (failed) process.exitCode = 1;

function countFields(value) {
  if (Array.isArray(value)) return value.length;
  if (!value || typeof value !== "object") return 0;
  for (const key of ["items", "fields", "data"]) {
    const count = countFields(value[key]);
    if (count) return count;
  }
  return 0;
}
