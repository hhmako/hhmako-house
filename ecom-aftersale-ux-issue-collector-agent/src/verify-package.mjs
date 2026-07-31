import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const required = [
  ".env.example",
  "config.template.json",
  "package.json",
  "src/run-group-listener.mjs",
  "src/group-event.mjs",
  "src/group-pipeline.mjs",
  "src/lark-openapi.mjs",
  "src/lark-base.mjs",
  "src/rules-engine.mjs",
  "src/run-external-monitor.mjs",
  "src/run-template-sync-card.mjs",
  "src/run-biweekly-cycle.mjs",
  "docs/START-HERE.md",
  "docs/CONFIGURATION.md",
  "docs/FEISHU_APP_SETUP.md",
  "docs/CARD-TEMPLATE-CONTRACT.md",
  "docs/after-sales-collection-rules.md",
  "docs/card-sync-rules.md",
  "ops/ecosystem.config.cjs",
  "ops/crontab.example",
  "test/fixtures/group-event.json",
];
const missing = required.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error(`FAIL  能力包缺少 ${missing.length} 个文件：`);
  for (const file of missing) console.error(`- ${file}`);
  process.exit(1);
}
console.log(`PASS  能力包结构完整（${required.length} 个关键文件）`);
