import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

const checks = [
  {
    file: "server/mcp-server.js",
    needles: [
      "replace_pingfang_text",
      "apply_pingfang_font",
      "debug_current_page",
      "/replace-text",
      "/apply-pingfang-font",
      "/debug-current-page",
      "missingPluginCapabilities",
    ],
  },
  {
    file: "figma-plugin/code.js",
    needles: [
      "bridgePluginVersion",
      "bridgePluginCapabilities",
      "replaceText",
      "applyPingfangFont",
      "debugCurrentPage",
      "setCurrentPage",
    ],
  },
  {
    file: "scripts/launch.sh",
    needles: [
      "DEBUG_URL",
      "wait_for_debug",
      "missingPluginCapabilities",
      "debug-current-page",
    ],
  },
  {
    file: "scripts/ensure.sh",
    needles: [
      "DEBUG_URL",
      "missingPluginCapabilities",
      "debug-current-page",
      "plugin capability/current-page checks",
    ],
  },
  {
    file: "CODEX-INSTALL-GUIDE.zh-CN.md",
    needles: [
      "/debug-current-page",
      "/replace-text",
      "插件代码版本",
    ],
  },
];

let failed = false;

for (const check of checks) {
  const path = resolve(root, check.file);
  const content = readFileSync(path, "utf8");
  for (const needle of check.needles) {
    if (!content.includes(needle)) {
      failed = true;
      console.error(`Missing "${needle}" in ${check.file}`);
    }
  }
}

if (failed) {
  process.exitCode = 1;
} else {
  console.log("PingFang bridge doctor passed.");
}
