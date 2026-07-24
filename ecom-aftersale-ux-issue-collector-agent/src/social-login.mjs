import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const args = new Map(process.argv.slice(2).map((arg, index, all) => {
  if (!arg.startsWith("--")) return [arg, true];
  const next = all[index + 1];
  return [arg.slice(2), next && !next.startsWith("--") ? next : true];
}));

const channel = args.get("channel");
if (!channel || !["xiaohongshu", "weibo"].includes(channel)) {
  throw new Error("Usage: social-login.mjs --channel xiaohongshu|weibo [--profiles-dir <path>]");
}

const profilesDir = args.get("profiles-dir") || path.resolve(".agent-profiles");
const profileDir = path.join(profilesDir, channel);
fs.mkdirSync(profileDir, { recursive: true });

const startUrl = channel === "xiaohongshu"
  ? "https://www.xiaohongshu.com"
  : "https://weibo.com";

const context = await chromium.launchPersistentContext(profileDir, {
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: false,
  viewport: { width: 1280, height: 900 },
});

const page = context.pages()[0] || await context.newPage();
await page.goto(startUrl, { waitUntil: "domcontentloaded" });
console.log(`请在打开的独立浏览器里完成 ${channel} 登录。登录后等待 90 秒自动保存并退出。`);
await page.waitForTimeout(Number(args.get("wait-ms") || 90000));
await context.close();
