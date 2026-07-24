import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const sharp = require("sharp");

const configPath = valueAfter("--config") || "config.local.json";
const dryRun = process.argv.includes("--dry-run");
const send = process.argv.includes("--send");
const config = JSON.parse(readFileSync(configPath, "utf8"));

const fields = config.fields || {};
const statusValues = config.statusValues || {};
const template = config.cardTemplate || {};
const bot = config.progressBot || {};

const baseToken = required(config.baseToken, "config.baseToken");
const tableId = required(config.tables?.issues, "config.tables.issues");
const templateId = required(template.templateId, "config.cardTemplate.templateId");
const issueBaseUrl = required(template.issueBaseUrl, "config.cardTemplate.issueBaseUrl");
const webhook = process.env.LARK_BOT_WEBHOOK || bot.webhookUrl || "";
const chatId = process.env.LARK_CHAT_ID || bot.chatId || "";
const outDir = valueAfter("--out-dir") || "tmp/template-sync-card";
const maxNew = numberArg("--max-new", template.maxNewIssues || 5);
const maxResolved = numberArg("--max-resolved", template.maxResolvedIssues || 5);
const sinceDate = parseWindowDate(valueAfter("--since")) || daysAgo(14);
const untilDate = parseWindowDate(valueAfter("--until")) || endOfDay(new Date());

const fieldNames = {
  title: fields.title || "问题描述",
  problem: fields.problem || "原始吐槽摘要",
  priority: fields.priority || "优先级",
  owners: fields.owners || "负责人",
  images: fields.images || "截图（问题+原帖）",
  source: fields.source || "来源",
  sourceUrl: fields.sourceUrl || "链接",
  page: fields.page || "场景",
  category: fields.category || "问题分类",
  progress: fields.progress || "当前进度",
  date: fields.date || "日期",
};

const forbiddenText = [
  "首页轮播图加载缓慢",
  "个人中心数据加载异常",
  "张明、李华",
  "王芳、赵强",
];

if (!dryRun && !send) {
  throw new Error("Use --dry-run to inspect payload or --send to send the card.");
}
if (send && !webhook && !chatId) {
  throw new Error("Missing send target. Set LARK_BOT_WEBHOOK or progressBot.chatId.");
}
mkdirSync(outDir, { recursive: true });

const rawRecords = readRawRecords();
writeJson("raw-records.json", rawRecords);

const records = normalizeRecords(rawRecords);
const selected = selectRecords(records);
for (const issue of selected.newIssues) {
  const attachment = chooseProofAttachment(issue.attachments);
  if (!attachment) throw new Error(`Record ${issue.record_id} has no proof image attachment.`);
  issue.attachment = attachment;
  issue.image_key = await prepareImageKey(issue, attachment);
}

const selectedAudit = {
  generated_at: new Date().toISOString(),
  date_window: {
    since: formatDate(sinceDate),
    until: formatDate(untilDate),
  },
  base_token: maskToken(baseToken),
  table_id: tableId,
  queried_record_count: records.length,
  selected_new_count: selected.newIssues.length,
  selected_resolved_count: selected.resolvedIssues.length,
  unfollowed_count: selected.unfollowedCount,
  newIssues: selected.newIssues.map(auditIssue),
  resolvedIssues: selected.resolvedIssues.map(auditIssue),
};
writeJson("selected-records.json", selectedAudit);

const variables = buildTemplateVariables(selected);
const payload = buildPayload(variables);
validatePayload(payload, selected);

const body = JSON.stringify(payload);
writeFileSync(path.join(outDir, "final-template-payload.json"), JSON.stringify(payload, null, 2));
writeJson("payload-hash.json", {
  payload_hash: sha256(body),
  template_id: templateId,
  msg_type: payload.msg_type,
  card_type: payload.card?.type,
});

printComparison(selected, variables);

if (dryRun) {
  console.log(JSON.stringify({ sent: false, outDir, template_id: templateId }, null, 2));
} else {
  const result = await sendCard(body);
  writeJson("send-result.json", result);
  console.log(JSON.stringify({ sent: true, outDir, template_id: templateId, result }, null, 2));
}

function readRawRecords() {
  const args = ["base", "+record-list", "--base-token", baseToken, "--table-id", tableId];
  for (const name of Object.values(fieldNames)) args.push("--field-id", name);
  args.push("--limit", "200", "--format", "json");
  return JSON.parse(execFileSync("lark-cli", args, { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 }));
}

function normalizeRecords(payload) {
  const names = payload.data.fields || Object.values(fieldNames);
  const index = Object.fromEntries(names.map((name, i) => [name, i]));
  const rows = payload.data.data || [];
  const ids = payload.data.record_id_list || [];
  return ids.map((recordId, rowIndex) => {
    const row = rows[rowIndex] || [];
    const status = firstOption(row[index[fieldNames.progress]]);
    const priority = normalizePriority(firstOption(row[index[fieldNames.priority]]));
    const title = text(row[index[fieldNames.title]]);
    const problem = text(row[index[fieldNames.problem]]);
    const owner = ownerNames(row[index[fieldNames.owners]]);
    const sourceUrl = extractUrl(row[index[fieldNames.sourceUrl]]);
    const date = parseRecordDate(row[index[fieldNames.date]]);
    const attachments = row[index[fieldNames.images]] || [];
    return {
      record_id: recordId,
      status,
      priority,
      title,
      problem,
      owner,
      page: firstOption(row[index[fieldNames.page]]),
      source: firstOption(row[index[fieldNames.source]]),
      category: firstOption(row[index[fieldNames.category]]),
      source_url: sourceUrl,
      date,
      detail_url: recordUrl(recordId),
      attachments,
      attachment_count: attachments.length,
      pass_send_gate: Boolean(title && sourceUrl && attachments.length > 0 && status !== "不收录"),
    };
  });
}

function selectRecords(records) {
  const newStatuses = statusValues.new || ["待确认"];
  const resolvedStatuses = statusValues.resolved || ["已解决"];
  const newIssues = records
    .filter((record) => record.pass_send_gate && newStatuses.includes(record.status) && withinWindow(record.date))
    .sort(compareIssue)
    .slice(0, maxNew);
  const resolvedIssues = records
    .filter((record) => record.pass_send_gate && resolvedStatuses.includes(record.status) && withinWindow(record.date))
    .sort(compareIssue)
    .slice(0, maxResolved);
  const unfollowedCount = records.filter((record) => record.status === "待确认").length;
  return { newIssues, resolvedIssues, unfollowedCount };
}

async function prepareImageKey(issue, attachment) {
  const sourcePath = path.join(outDir, `${issue.record_id}-${sanitizeFileName(attachment.name || "attachment")}`);
  const previewPath = path.join(outDir, `${issue.record_id}-preview.jpg`);
  execFileSync(
    "lark-cli",
    [
      "base",
      "+record-download-attachment",
      "--base-token",
      baseToken,
      "--table-id",
      tableId,
      "--record-id",
      issue.record_id,
      "--file-token",
      attachment.file_token,
      "--output",
      sourcePath,
      "--overwrite",
      "--format",
      "json",
    ],
    { encoding: "utf8", maxBuffer: 40 * 1024 * 1024 }
  );
  await sharp(sourcePath)
    .rotate()
    .resize(1800, 1800, { fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 92, mozjpeg: true })
    .toFile(previewPath);
  const output = execFileSync(
    "lark-cli",
    [
      "im",
      "images",
      "create",
      "--as",
      "bot",
      "--data",
      JSON.stringify({ image_type: "message" }),
      "--file",
      `image=${previewPath}`,
      "--format",
      "json",
    ],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  const imageKey = JSON.parse(output)?.data?.image_key;
  if (!imageKey?.startsWith("img_")) throw new Error(`Image upload failed for ${issue.record_id}.`);
  return imageKey;
}

function chooseProofAttachment(attachments) {
  const lower = (value) => String(value || "").toLowerCase();
  return (
    attachments.find((item) => /original|source|post|原帖|来源/.test(lower(item.name))) ||
    attachments.find((item) => /\.(png|jpg|jpeg|webp)$/i.test(item.name || "")) ||
    attachments[0]
  );
}

function buildTemplateVariables({ newIssues, resolvedIssues, unfollowedCount }) {
  return {
    header_title: "问题反馈列表",
    header_summary: `今日新录入 ${newIssues.length} 个｜已解决 ${resolvedIssues.length} 个`,
    new_section_title: newIssues.length > 0 ? `新录入${newIssues.length}个问题待解决` : "暂无新录入的问题",
    processing_section_title: resolvedIssues.length > 0 ? `已解决${resolvedIssues.length}个问题` : "暂无已解决的问题",
    new_count: newIssues.length,
    processing_count: resolvedIssues.length,
    new_issues: newIssues.map((issue) => ({
      title_line: formatTitleLine(issue),
      problem_line: `问题：${smartShorten(issue.problem || issue.title, 46)}`,
      owner_line: `负责人：${formatOwners(issue.owner, 2)}`,
      image_key: { img_key: issue.image_key },
      source_url: issue.source_url,
      detail_url: issue.detail_url,
    })),
    processing_issues: resolvedIssues.map((issue) => ({
      line: `【${issue.priority}】${issue.page || "未分类"}｜${smartShorten(issue.title, 24)}｜${formatOwners(issue.owner, 2)}`,
      detail_url: issue.detail_url,
    })),
    unfollowed_count: unfollowedCount,
    unfollowed_tip: unfollowedCount > 0 ? `有${unfollowedCount}个问题暂无跟进，请尽快解决` : "",
    unfollowed_notice: "",
    issue_base_url: issueBaseUrl,
  };
}

function buildPayload(template_variable) {
  return {
    msg_type: "interactive",
    card: {
      type: "template",
      data: {
        template_id: templateId,
        template_variable,
      },
    },
  };
}

function validatePayload(payload, selected) {
  const body = JSON.stringify(payload);
  const errors = [];
  if (payload.msg_type !== "interactive") errors.push("msg_type must be interactive.");
  if (payload.card?.type !== "template") errors.push("card.type must be template.");
  if (payload.card?.data?.template_id !== templateId) errors.push("template_id mismatch.");
  if (body.includes("template_variable_test") || body.includes("mock")) errors.push("payload contains mock marker.");
  for (const token of forbiddenText) {
    if (body.includes(token)) errors.push(`payload contains forbidden default content: ${token}`);
  }
  const variables = payload.card?.data?.template_variable || {};
  if (variables.new_count !== selected.newIssues.length) errors.push("new_count mismatch.");
  if (variables.processing_count !== selected.resolvedIssues.length) errors.push("resolved count mismatch.");
  if (variables.unfollowed_tip.includes("**")) errors.push("unfollowed_tip must be plain text.");
  if (variables.unfollowed_notice) errors.push("unfollowed_notice is deprecated and must stay empty.");
  if (!isValidHttpUrl(variables.issue_base_url)) errors.push("issue_base_url is invalid.");
  variables.new_issues.forEach((issue, index) => {
    const source = selected.newIssues[index];
    if (!source) errors.push(`new_issues[${index}] has no source record.`);
    if (!issue.image_key?.img_key?.startsWith("img_")) errors.push(`new_issues[${index}] missing image_key.`);
    if (!isValidHttpUrl(issue.source_url)) errors.push(`new_issues[${index}] missing source_url.`);
    if (!isValidHttpUrl(issue.detail_url)) errors.push(`new_issues[${index}] missing detail_url.`);
    if (issue.source_url === issue.detail_url) errors.push(`new_issues[${index}] source_url equals detail_url.`);
    if (issue.problem_line.includes("**") || issue.owner_line.includes("**")) errors.push(`new_issues[${index}] non-title field contains markdown.`);
  });
  if (errors.length) throw new Error(`Card validation failed:\n${errors.join("\n")}`);
}

async function sendCard(body) {
  if (webhook) {
    const response = await fetch(webhook, { method: "POST", headers: { "content-type": "application/json" }, body });
    const result = await response.json().catch(async () => ({ raw: await response.text() }));
    if (!response.ok || result.code !== 0) throw new Error(`Webhook send failed: ${JSON.stringify(result)}`);
    return result;
  }
  const output = execFileSync(
    "lark-cli",
    ["im", "+messages-send", "--as", "bot", "--chat-id", chatId, "--msg-type", "interactive", "--content", JSON.stringify(JSON.parse(body).card), "--format", "json"],
    { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 }
  );
  return JSON.parse(output);
}

function formatTitleLine(issue) {
  const plain = `${issue.priority} · ${compactTitle(issue.title)}`;
  return template.richTitleMarkdown === false ? plain : `**${plain}**`;
}

function compactTitle(value) {
  let clean = stripMarkdown(value)
    .replace(/^[【\[]?P[0-2][】\]]?\s*[·｜|:：-]?\s*/i, "")
    .replace(/[；;。].*$/, "")
    .replace(/，.*$/, "")
    .replace(/,.*$/, "")
    .trim();
  const replacements = [
    [/^查看订单被商城\s*App\s*下载引导拦截.*$/, "订单查看被下载引导拦截"],
    [/^物流派送中包裹数量按订单记录加总.*$/, "包裹数量展示易误解"],
    [/^客服物流卡片文字截断.*$/, "客服物流卡片文字截断"],
    [/^退款弹窗底部确认区域被裁切.*$/, "退款弹窗底部被裁切"],
    [/^订单详情小屏.*按钮重叠.*$/, "订单详情按钮重叠"],
    [/^平台客服转人工入口.*$/, "客服转人工入口不明"],
    [/^投诉公示页.*筛选.*$/, "投诉公示筛选不足"],
  ];
  for (const [pattern, replacement] of replacements) {
    if (pattern.test(clean)) return replacement;
  }
  clean = clean
    .replace(/用户(无法|难以|容易|查看|看到|反馈)/g, "")
    .replace(/影响用户/g, "")
    .replace(/缺少清晰/g, "")
    .replace(/体验/g, "")
    .trim();
  return smartShorten(clean, 16);
}

function auditIssue(issue) {
  return {
    record_id: issue.record_id,
    status: issue.status,
    priority: issue.priority,
    title: issue.title,
    problem: issue.problem,
    owner: issue.owner,
    page: issue.page,
    category: issue.category,
    source: issue.source,
    source_url: issue.source_url,
    date: issue.date ? formatDate(issue.date) : "",
    detail_url: issue.detail_url,
    attachment_count: issue.attachment_count,
    attachment: issue.attachment ? { name: issue.attachment.name || "", file_token: maskToken(issue.attachment.file_token || "") } : null,
    image_key: issue.image_key ? maskToken(issue.image_key) : "",
  };
}

function withinWindow(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return false;
  return date >= startOfDay(sinceDate) && date <= endOfDay(untilDate);
}

function parseRecordDate(value) {
  if (typeof value === "number") {
    const millis = value > 100000000000 ? value : value * 1000;
    return new Date(millis);
  }
  const raw = text(value);
  if (!raw) return null;
  return parseWindowDate(raw);
}

function parseWindowDate(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;
  const normalized = raw.replace(/[./]/g, "-");
  const match = normalized.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (!match) {
    const parsed = new Date(raw);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
}

function daysAgo(days) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  return startOfDay(date);
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function formatDate(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function compareIssue(a, b) {
  return priorityRank(a.priority) - priorityRank(b.priority);
}

function priorityRank(priority) {
  return { P0: 0, P1: 1, P2: 2 }[priority] ?? 9;
}

function normalizePriority(value) {
  const match = String(value || "").match(/P[0-2]/);
  return match ? match[0] : "待判断";
}

function ownerNames(value) {
  if (!Array.isArray(value)) return text(value) || "待分配";
  const names = value.map((item) => item?.name || item?.text || item?.id || "").map(text).filter(Boolean);
  return names.join("、") || "待分配";
}

function formatOwners(value, maxVisible) {
  const names = String(value || "")
    .split("、")
    .map(text)
    .filter(Boolean);
  if (names.length === 0) return "待分配";
  if (names.length <= maxVisible) return names.join("、");
  return `${names.slice(0, maxVisible).join("、")}等${names.length}人`;
}

function firstOption(value) {
  if (Array.isArray(value)) return text(value[0]);
  return text(value);
}

function extractUrl(value) {
  const raw = Array.isArray(value) ? value.join(" ") : String(value || "");
  const markdown = raw.match(/\((https?:\/\/[^)]+)\)/);
  if (markdown) return markdown[1].replace(/&amp;/g, "&");
  const plain = raw.match(/https?:\/\/\S+/);
  return plain ? plain[0].replace(/&amp;/g, "&") : "";
}

function smartShorten(value, maxLength) {
  const clean = stripMarkdown(value).replace(/\s+/g, " ").trim();
  return clean.length > maxLength ? `${clean.slice(0, maxLength - 1)}…` : clean;
}

function stripMarkdown(value) {
  return String(value ?? "")
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, "$1")
    .replace(/<\/?(?:b|strong|font)[^>]*>/gi, "")
    .replace(/<[^>]+>/g, "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim();
}

function recordUrl(recordId) {
  const tableParam = encodeURIComponent(tableId);
  return `${issueBaseUrl}${issueBaseUrl.includes("?") ? "&" : "?"}table=${tableParam}&record=${encodeURIComponent(recordId)}`;
}

function text(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function sanitizeFileName(name) {
  return String(name).replace(/[^\w.\-]+/g, "_").slice(0, 120);
}

function maskToken(value) {
  const textValue = String(value || "");
  if (textValue.length <= 10) return textValue ? "<masked>" : "";
  return `${textValue.slice(0, 4)}...${textValue.slice(-4)}`;
}

function required(value, label) {
  if (!value || String(value).includes("<")) throw new Error(`Missing ${label}. Use config.local.json, not config.template.json.`);
  return value;
}

function isValidHttpUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function valueAfter(flag) {
  const index = process.argv.indexOf(flag);
  return index >= 0 ? process.argv[index + 1] || "" : "";
}

function numberArg(flag, fallback) {
  const value = Number(valueAfter(flag));
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

function writeJson(name, value) {
  writeFileSync(path.join(outDir, name), JSON.stringify(value, null, 2));
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function printComparison(selected, variables) {
  console.error("section | record_id | payload title/line | owner | image_key | source_url");
  selected.newIssues.forEach((issue, index) => {
    const item = variables.new_issues[index];
    console.error(["new", issue.record_id, item.title_line, issue.owner, maskToken(item.image_key.img_key), item.source_url].join(" | "));
  });
  selected.resolvedIssues.forEach((issue, index) => {
    const item = variables.processing_issues[index];
    console.error(["resolved", issue.record_id, item.line, issue.owner, "", ""].join(" | "));
  });
}
