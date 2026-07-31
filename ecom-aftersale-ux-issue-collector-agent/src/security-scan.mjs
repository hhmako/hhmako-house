import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "--", "."], { cwd: root, encoding: "utf8" })
  .split(/\r?\n/)
  .filter(Boolean);
const forbiddenFiles = [
  /(^|\/)config\.local\.json$/,
  /(^|\/)\.env$/,
  /(^|\/)\.agent-profiles\//,
  /(^|\/)(runtime|tmp)\//,
  /\.(png|jpe?g|webp|gif|mp4|mov)$/i,
];
const secretPatterns = [
  { name: "飞书 webhook", pattern: /https:\/\/open\.(?:feishu|larkoffice)\.cn\/open-apis\/bot\/v2\/hook\/[0-9a-f-]{20,}/i },
  { name: "飞书 App Secret", pattern: /\b(?:app_secret|LARK_APP_SECRET)\b\s*[:=]\s*["']?(?!<|replace_me)[A-Za-z0-9_-]{16,}/i },
  { name: "Cookie", pattern: /\b(?:cookie|sessionid)\b\s*[:=]\s*["'][^"']{20,}/i },
  { name: "私钥", pattern: /-----BEGIN (?:RSA |OPENSSH )?PRIVATE KEY-----/ },
  { name: "飞书群 chat_id", pattern: /\boc_[A-Za-z0-9]{12,}\b/ },
  { name: "飞书用户 open_id", pattern: /\bou_[A-Za-z0-9]{12,}\b/ },
  { name: "飞书应用 App ID", pattern: /\bcli_[A-Za-z0-9]{12,}\b/ },
  { name: "疑似真实 Base URL", pattern: /https:\/\/[^/\s]+\/base\/[A-Za-z0-9]{16,}/ },
];
const failures = [];

for (const relative of files) {
  if (forbiddenFiles.some((pattern) => pattern.test(relative))) {
    failures.push(`禁止提交的文件：${relative}`);
    continue;
  }
  const file = path.join(root, relative);
  if (!fs.statSync(file).isFile()) continue;
  const content = fs.readFileSync(file, "utf8");
  for (const rule of secretPatterns) {
    if (rule.pattern.test(content)) failures.push(`${relative} 命中 ${rule.name}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}
console.log(`PASS  安全扫描通过（${files.length} 个待提交或已跟踪文件）`);
