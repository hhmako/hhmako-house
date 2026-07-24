import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { createRequire } from "node:module";
import { extractRecordId, firstSelect, listRecords, rowsAsObjects, updateRecords, uploadAttachment, upsertRecord } from "./lark-base.mjs";
import { analyzeImageScene } from "./image-scene.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const configPath = getArg("config") || "issue-agent/config.example.json";
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const sceneConfig = config.scene || {};

const channelRows = rowsAsObjects(listRecords(config.baseToken, config.tables.channelConfig));
const pageRuleRows = rowsAsObjects(listRecords(config.baseToken, config.tables.pageRules || config.tables.issueRules));
const typePriorityRuleRows = config.tables.typePriorityRules
  ? rowsAsObjects(listRecords(config.baseToken, config.tables.typePriorityRules))
  : rowsAsObjects(listRecords(config.baseToken, config.tables.issueRules));
const issueRows = rowsAsObjects(listRecords(config.baseToken, config.tables.issues));

const enabledChannels = channelRows.filter((row) => {
  const ruleType = firstSelect(row.fields["规则类型"]);
  if (ruleType && ruleType !== "渠道运行配置") return false;
  const channel = getChannelName(row);
  const enabled = row.fields["是否启用"] === true;
  return enabled && ["小红书", "微博"].includes(channel);
});

const existingKeys = new Set(issueRows.map((row) => {
  const link = normalizeLink(row.fields["原始链接"] || row.fields["新增｜原始链接"]);
  const issue = normalizeText(row.fields["问题"]);
  return link || hash(issue);
}).filter(Boolean));

const pageRules = pageRuleRows.map((row) => ({
  ruleType: firstSelect(row.fields["规则类型"]),
  output: firstSelect(row.fields["页面"]) || normalizeText(row.fields["输出结果"]),
  page: firstSelect(row.fields["页面"]) || firstSelect(row.fields["所属页面"]) || firstSelect(row.fields["所属页面（对应走查表）"]),
  owner: row.fields["负责人"] || [],
  channels: row.fields["来源渠道"] || [],
  keywords: splitWords(row.fields["关键词"]),
  problem: normalizeText(row.fields["识别口径"] || row.fields["什么时候归这里"] || row.fields["要识别的问题"]),
  examples: normalizeText(row.fields["用户原话例子"] || row.fields["用户可能怎么说"]),
  note: normalizeText(row.fields["排除说明"] || row.fields["不要归这里"] || row.fields["排除词/备注"]),
})).filter((rule) => rule.ruleType === "页面识别" && rule.page);
const typePriorityRules = typePriorityRuleRows.map((row) => {
  const judgeType = firstSelect(row.fields["判断项"]);
  return {
    ruleType: judgeType === "优先级" ? "优先级识别" : judgeType === "问题类型" ? "问题类型识别" : firstSelect(row.fields["规则类型"]),
    output: normalizeText(row.fields["输出结果"]),
    channels: row.fields["来源渠道"] || ["小红书", "微博", "飞书群", "人工反馈群（替换为实际群名）", "人工填入"],
    keywords: splitWords(row.fields["关键词"] || row.fields["输出结果"]),
    problem: normalizeText(row.fields["识别口径"] || row.fields["判断口径"] || row.fields["要识别的问题"]),
    examples: normalizeText(row.fields["用户原话例子"] || row.fields["用户可能怎么说"]),
    note: normalizeText(row.fields["排除说明"] || row.fields["不要这样判断"] || row.fields["排除词/备注"]),
  };
});
const rules = [...pageRules, ...typePriorityRules];
const ruleSets = {
  intake: rules.filter((rule) => rule.ruleType === "是否收录"),
  pages: rules.filter((rule) => rule.ruleType === "页面识别"),
  types: rules.filter((rule) => rule.ruleType === "问题类型识别"),
  priorities: rules.filter((rule) => rule.ruleType === "优先级识别"),
};

const summary = { scanned: 0, inserted: 0, skippedDuplicate: 0, failedChannels: [] };

for (const channelRow of enabledChannels) {
  const label = getChannelName(channelRow);
  const channelKey = label === "小红书" ? "xiaohongshu" : "weibo";
  const channelConfig = config.channels[channelKey];
  const profileDir = path.join(config.profilesDir, channelKey);

  if (!fs.existsSync(profileDir)) {
    await markChannel(channelRow, "已失效", "未找到登录态，请先运行 social-login.mjs 刷新登录态");
    summary.failedChannels.push(label);
    continue;
  }

  const runnableRules = rules
    .filter((rule) => rule.channels.includes(label))
    .filter((rule) => ["是否收录", "页面识别"].includes(rule.ruleType) || !rule.ruleType)
    .filter((rule) => rule.keywords.length > 0)
    .slice(0, config.maxQueriesPerChannel || 3);

  let context;
  try {
    context = await chromium.launchPersistentContext(profileDir, {
      executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
      headless: true,
      viewport: { width: 1365, height: 900 },
    });
    const page = context.pages()[0] || await context.newPage();
    for (const rule of runnableRules) {
      const query = buildQuery(rule);
      const searchUrl = channelConfig.searchUrl.replace("{query}", encodeURIComponent(query));
      await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 30000 });
      await page.waitForTimeout(2000);

      if (await looksLoggedOut(page)) {
        await markChannel(channelRow, "已失效", "登录态失效，需要人工刷新");
        summary.failedChannels.push(label);
        break;
      }

      const items = await extractVisibleItems(page, label, config.maxResultsPerQuery || 5);
      for (const item of items) {
        summary.scanned += 1;
        const classified = classify(item, ruleSets, rule);
        if (!classified) continue;
        const key = item.link || hash(item.text);
        if (existingKeys.has(key)) {
          summary.skippedDuplicate += 1;
          continue;
        }

        const imageDir = path.join("tmp", "external-monitor", hash(key).slice(0, 16));
        fs.rmSync(imageDir, { recursive: true, force: true });
        fs.mkdirSync(imageDir, { recursive: true });
        const imageCapture = item.link
          ? await screenshotPostImages(page, item.link, imageDir)
          : { files: [], textHints: [] };
        const scene = imageCapture.files.length > 0 || imageCapture.textHints.length > 0
          ? await analyzeImageScene(imageCapture.files, [item.text, ...imageCapture.textHints], sceneConfig)
          : { inScope: false, outOfScope: false, text: "" };
        if (!shouldKeepCandidate(scene)) {
          summary.skippedNoSceneMatch = (summary.skippedNoSceneMatch || 0) + 1;
          continue;
        }

        existingKeys.add(key);
        const createResult = await upsertRecord(config.baseToken, config.tables.issues, {
          "问题": classified.issue,
          "所属页面": classified.page,
          "问题类型": classified.type,
          "优先级": classified.priority,
          "负责人": classified.owner,
          "来源渠道": [label],
          "原始链接": item.link,
          "贡献人": item.author || "",
          "状态": "待确认",
        });
        const recordId = extractRecordId(createResult);
        for (const file of imageCapture.files) {
          if (!recordId) break;
          uploadAttachment(config.baseToken, config.tables.issues, recordId, "截图", file, path.basename(file));
        }
        summary.inserted += 1;
      }
    }
    await markChannel(channelRow, "正常", "");
  } catch (error) {
    await markChannel(channelRow, "已失效", error.message.slice(0, 300));
    summary.failedChannels.push(label);
  } finally {
    if (context) await context.close();
  }
}

console.log(JSON.stringify(summary, null, 2));

async function markChannel(row, status, failure) {
  const normalizedStatus = status === "已失效" ? "登录失效" : status;
  await updateRecords(config.baseToken, config.tables.channelConfig, [row.recordId], {
    "运行状态": normalizedStatus,
    "最后成功采集时间": normalizedStatus === "正常" ? Date.now() : undefined,
    "异常备注": failure,
  });
}

function buildQuery(rule) {
  return [sceneConfig.platformKeyword || "抖音商城", ...rule.keywords.slice(0, 2)].join(" ");
}

function getChannelName(row) {
  return firstSelect(row.fields["渠道"]) || normalizeText(row.fields["渠道名称"]);
}

function classify(item, ruleSets, searchRule) {
  const text = normalizeText(item.text);
  if (!text || /招聘|教程|招商|商家入驻|广告/.test(text)) return null;
  const hasPlatformAnchor = buildPattern(sceneConfig.platformTerms || ["抖音商城", "抖音电商", "抖店", "抖音小店"]).test(text);
  const hasSceneAnchor = buildPattern(sceneConfig.scopeTerms || []).test(text);
  if (!hasPlatformAnchor && !hasSceneAnchor) return null;
  const intakeHit = matchRule(ruleSets.intake, text);
  if (!intakeHit && !hasSceneAnchor) return null;
  const pageRule = matchRule(ruleSets.pages, text) || (searchRule?.ruleType === "页面识别" ? searchRule : null);
  const page = pageRule?.output || pageRule?.page || "";
  if (!page) return null;
  const typeRule = matchRule(ruleSets.types, text);
  const priorityRule = matchRule(ruleSets.priorities, text);
  return {
    issue: text.slice(0, 80),
    page,
    type: typeRule?.output || inferType(text),
    priority: priorityRule?.output || inferPriority(text),
    owner: pageRule.owner || [],
    strongTextSignal: hasSceneAnchor,
  };
}

function matchRule(rules, text) {
  return rules.find((rule) => rule.keywords.some((keyword) => text.includes(keyword))
    || splitWords(rule.examples).some((keyword) => text.includes(keyword)));
}

function inferType(text) {
  if (/点不了|打不开|失败|报错|异常|不显示|金额.*错|状态.*错|加载/.test(text)) return "实现 bug";
  if (/缺少|没有|找不到.*入口|无.*入口|无操作区|无楼层|流程不完整/.test(text)) return "功能缺失";
  if (/路径绕|入口深|流程断|流转|无反馈|跳转|修改|确认|返回/.test(text)) return "交互流程";
  if (/不懂|不清楚|不知道|说明|文案|状态说明|金额说明|时效|多久到账|规则/.test(text)) return "信息表达";
  if (/遮挡|大字|小屏|适配|挤|错位/.test(text)) return "适配问题";
  if (/颜色|圆角|间距|对齐|样式|图标|icon|截断|贴边|压扁|还原|字号/.test(text)) return "UI样式";
  return "信息表达";
}

function inferPriority(text) {
  if (/提交不了|点不了|打不开|失败|金额.*错|状态.*错|无法|不能|接通不了|找不到.*入口/.test(text)) return "P0 体验阻断或问题严重";
  if (/不懂|不清楚|难找|太深|绕|误解|说明|不知道/.test(text)) return "P1 体验曲折或效果粗糙";
  return "P2-UI bug";
}

function shouldKeepCandidate(scene) {
  return scene.inScope === true;
}

async function screenshotPostImages(page, url, outputDir) {
  const originalUrl = page.url();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(4500);

  const textHints = await page.evaluate(() => {
    const bodyText = (document.body?.innerText || "").slice(0, 3000);
    const imageText = Array.from(document.querySelectorAll("img"))
      .map((img) => [img.alt, img.title, img.getAttribute("aria-label")].filter(Boolean).join(" "))
      .join(" ");
    return [bodyText, imageText].filter(Boolean);
  }).catch(() => []);

  const handles = await page.locator("img").elementHandles();
  const candidates = [];
  for (const handle of handles) {
    const box = await handle.boundingBox();
    if (!box) continue;
    if (box.width < 160 || box.height < 160) continue;
    const src = await handle.getAttribute("src").catch(() => "");
    if (src && /avatar|emoji|icon|logo/i.test(src)) continue;
    candidates.push({ handle, box, area: box.width * box.height });
  }
  candidates.sort((a, b) => b.area - a.area);

  const picked = [];
  for (const candidate of candidates) {
    if (picked.some((item) => intersectsMostly(item.box, candidate.box))) continue;
    picked.push(candidate);
    if (picked.length >= 9) break;
  }

  const files = [];
  let index = 1;
  for (const item of picked) {
    const file = path.join(outputDir, `post-image-${String(index).padStart(2, "0")}.png`);
    await item.handle.screenshot({ path: file });
    await trimWhitespace(file);
    files.push(file);
    index += 1;
  }

  if (originalUrl && originalUrl !== "about:blank") {
    await page.goto(originalUrl, { waitUntil: "domcontentloaded", timeout: 30000 }).catch(() => {});
    await page.waitForTimeout(1000).catch(() => {});
  }
  return { files, textHints };
}

async function trimWhitespace(file) {
  const image = sharp(file);
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) return;
  const raw = await image.ensureAlpha().raw().toBuffer();
  const width = metadata.width;
  const height = metadata.height;
  const threshold = 245;
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4;
      const r = raw[offset];
      const g = raw[offset + 1];
      const b = raw[offset + 2];
      const alpha = raw[offset + 3];
      if (alpha === 0) continue;
      if (r < threshold || g < threshold || b < threshold) {
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (minX >= maxX || minY >= maxY) return;
  const padding = 24;
  const left = Math.max(0, minX - padding);
  const top = Math.max(0, minY - padding);
  const right = Math.min(width, maxX + padding);
  const bottom = Math.min(height, maxY + padding);
  const cropWidth = right - left;
  const cropHeight = bottom - top;
  if (cropWidth < 80 || cropHeight < 80) return;
  await sharp(file).extract({ left, top, width: cropWidth, height: cropHeight }).toFile(`${file}.tmp.png`);
  fs.renameSync(`${file}.tmp.png`, file);
}

function intersectsMostly(a, b) {
  const x = Math.max(0, Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x));
  const y = Math.max(0, Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y));
  const overlap = x * y;
  return overlap > Math.min(a.width * a.height, b.width * b.height) * 0.6;
}

async function extractVisibleItems(page, label, limit) {
  return page.evaluate(({ label, limit }) => {
    const links = Array.from(document.querySelectorAll("a[href]"));
    return links
      .map((link) => ({
        text: (link.innerText || link.textContent || "").trim(),
        link: link.href,
        author: "",
      }))
      .filter((item) => item.text.length >= 8)
      .filter((item) => label === "小红书"
        ? /xiaohongshu\.com/.test(item.link)
        : /weibo\.com|m\.weibo\.cn/.test(item.link))
      .slice(0, limit);
  }, { label, limit });
}

async function looksLoggedOut(page) {
  const text = await page.locator("body").innerText({ timeout: 5000 }).catch(() => "");
  return /登录|验证码|扫码登录/.test(text) && !/搜索|发现|首页|微博正文|小红书/.test(text);
}

function splitWords(value) {
  return String(value || "").split(/[、,，\s]+/).map((word) => word.trim()).filter(Boolean);
}

function normalizeText(value) {
  return String(value || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeLink(value) {
  const text = String(value || "").trim();
  const match = text.match(/\]\((https?:\/\/[^)]+)\)/);
  return match ? match[1] : text;
}

function buildPattern(terms) {
  const source = terms
    .filter(Boolean)
    .map((term) => escapeRegExp(term))
    .join("|");
  return new RegExp(source || "$.");
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}
