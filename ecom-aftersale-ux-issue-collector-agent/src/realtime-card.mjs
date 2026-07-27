import { execFileSync } from "node:child_process";

export function buildRealtimeVariables(issue, config) {
  const map = config.cardTemplate.realtimeVariables || {};
  const values = {
    [map.headerTitle || "header_title"]: "问题反馈列表",
    [map.titleLine || "title_line"]: `${normalizePriority(issue.priority)} · ${issue.title}`,
    [map.problemLine || "problem_line"]: `问题：${issue.problem}`,
    [map.ownerLine || "owner_line"]: `负责人：${ownerNames(issue.owners)}`,
    [map.imageKey || "image_key"]: { img_key: issue.imageKey },
    [map.sourceUrl || "source_url"]: issue.sourceUrl,
    [map.detailUrl || "detail_url"]: issue.detailUrl,
    [map.issueBaseUrl || "issue_base_url"]: config.cardTemplate.issueBaseUrl,
  };
  return values;
}

export function buildRealtimePayload(issue, config) {
  return {
    msg_type: "interactive",
    card: {
      type: "template",
      data: {
        template_id: config.cardTemplate.realtimeTemplateId,
        template_variable: buildRealtimeVariables(issue, config),
      },
    },
  };
}

export function validateRealtimePayload(payload, issue, config) {
  const body = JSON.stringify(payload);
  const errors = [];
  if (payload.card?.data?.template_id !== config.cardTemplate.realtimeTemplateId) errors.push("实时卡片模板 ID 不匹配");
  if (!issue.recordId) errors.push("没有真实 Base record_id");
  if (!issue.imageKey?.startsWith("img_")) errors.push("没有真实飞书 image_key");
  if (!validUrl(issue.sourceUrl)) errors.push("来源链接无效");
  if (!validUrl(issue.detailUrl)) errors.push("详情链接无效");
  if (/(mock|示例标题|张明、李华|首页轮播图加载缓慢)/i.test(body)) errors.push("检测到 mock 或模板示例数据");
  if (errors.length) throw new Error(`实时卡片校验失败：${errors.join("；")}`);
}

export async function sendRealtimeCard(issue, config) {
  const payload = buildRealtimePayload(issue, config);
  validateRealtimePayload(payload, issue, config);
  const envName = config.progressBot?.webhookEnv || "LARK_BOT_WEBHOOK";
  const webhook = process.env[envName];
  if (webhook) {
    const response = await fetch(webhook, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    const result = await response.json();
    if (!response.ok || result.code !== 0) throw new Error(`实时卡片发送失败：${JSON.stringify(result)}`);
    return result;
  }
  const chatId = config.progressBot?.chatId;
  if (!chatId || chatId.startsWith("<")) throw new Error(`未配置 ${envName} 或 progressBot.chatId。`);
  const output = execFileSync("lark-cli", [
    "im", "+messages-send", "--as", "bot", "--chat-id", chatId,
    "--msg-type", "interactive", "--content", JSON.stringify(payload.card), "--format", "json",
  ], { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  return JSON.parse(output);
}

function normalizePriority(value) {
  return String(value || "").match(/P[0-2]/)?.[0] || "待判断";
}

function ownerNames(value) {
  if (!Array.isArray(value) || value.length === 0) return "待分配";
  return value.map((item) => item?.name || item?.text || item).filter(Boolean).slice(0, 2).join("、") || "待分配";
}

function validUrl(value) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}
