import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";

const categories = [
  "界面显示与适配问题",
  "信息表达与理解问题",
  "操作交互与反馈问题",
  "任务流程与闭环问题",
];

export function analyzeCandidate(candidate, config) {
  const command = process.env[config.realtimeGroups?.analyzer?.commandEnv || "ISSUE_ANALYZER_COMMAND"];
  if (config.realtimeGroups?.analyzer?.mode === "command" && command) {
    return runExternalAnalyzer(candidate, command, config.realtimeGroups.analyzer.timeoutMs);
  }
  return builtInAnalysis(candidate, config);
}

export function builtInAnalysis(candidate, config) {
  const text = clean(candidate.text);
  const excluded = /(商家态度|客服态度|不回复|拒绝退款|虚假宣传|不发货|物流延误|快递员|丢件|破损|商品质量|生活服务|本地生活)/;
  const design = /(遮挡|裁切|截断|重叠|错位|超出屏幕|看不全|看不清|小屏|大字体|安全区|点不了|点击无响应|没有反馈|入口难找|找不到入口|无法滚动|文案.*不清|规则.*不清|状态.*不清|容易误解|缺少.*入口|没有.*入口|流程中断|无法继续|没有下一步|缺少重试)/;
  const technicalFailure = /(服务端|接口|网络|数据库|第三方服务|崩溃|闪退|白屏|加载失败|数据异常|同步错误|资源失败)/;
  const technicalFallback = /(错误提示|失败提示|重试入口|重新加载|进度保留|替代路径|返回路径|异常状态|兜底)/;
  const platform = pattern(config.scene?.platformTerms);
  const scope = pattern(config.scene?.scopeTerms);
  const evidence = candidate.files?.length > 0 || candidate.imageRefs?.length > 0;
  const reasons = [];
  if (!text) reasons.push("缺少文字说明");
  if (config.realtimeGroups?.requireEvidence !== false && !evidence) reasons.push("缺少原始截图证据");
  if (!platform.test(text) && !scope.test(text)) reasons.push("无法确认属于抖音电商交易场景");
  if (!design.test(text)) reasons.push("未发现明确的界面、交互、信息或流程设计异常");
  if (excluded.test(text) && !design.test(text)) reasons.push("直接责任主体属于商家、客服、物流、商品或生活服务");
  if (technicalFailure.test(text) && !technicalFallback.test(text)) reasons.push("属于纯技术故障，未发现异常提示、重试或替代路径的设计问题");
  if (reasons.length) return { accepted: false, reasons, confidence: "pending" };

  const category = inferCategory(text);
  const page = inferPage(text);
  const priority = inferPriority(text);
  const title = compactTitle(text, category);
  const owners = config.ownerMappings?.[page] || [];
  return {
    accepted: true,
    reasons: [`存在可观察证据`, `命中${category}`, `可通过产品设计优化`],
    category,
    page,
    priority,
    title,
    problem: summarize(text),
    owners,
    confidence: "strong",
  };
}

function runExternalAnalyzer(candidate, command, timeoutMs = 20000) {
  const file = path.join(os.tmpdir(), `ux-candidate-${process.pid}-${Date.now()}.json`);
  fs.writeFileSync(file, JSON.stringify(candidate, null, 2));
  try {
    const output = execFileSync("zsh", ["-lc", `${command} ${shellQuote(file)}`], {
      encoding: "utf8",
      timeout: timeoutMs,
      maxBuffer: 5 * 1024 * 1024,
    });
    const result = JSON.parse(output);
    if (result.accepted && !categories.includes(result.category)) throw new Error("外部分析器返回了非法问题分类。");
    return result;
  } finally {
    fs.rmSync(file, { force: true });
  }
}

function inferCategory(text) {
  if (/(遮挡|裁切|截断|重叠|错位|超出屏幕|看不全|看不清|小屏|大字体|安全区|字号|对比度)/.test(text)) return categories[0];
  if (/(点不了|点击无响应|没有反馈|入口难找|找不到入口|无法滚动|重试)/.test(text)) return categories[2];
  if (/(流程中断|无法继续|没有下一步|缺少.*入口|无法完成|没有后续)/.test(text)) return categories[3];
  return categories[1];
}

function inferPage(text) {
  if (/退款|退货|售后|补寄|换货|运费险|优惠券|权益/.test(text)) return "售后&权益";
  if (/物流|包裹|快递|签收/.test(text)) return "物流";
  if (/客服|转人工|会话|聊天/.test(text)) return "客服";
  if (/安装|维修|国补|以旧换新|鉴定/.test(text)) return "行业";
  return "订单";
}

function inferPriority(text) {
  if (/(退款|支付|下单|售后|申诉|身份验证).*(裁切|遮挡|不可见|点不了|无法继续|无法完成)/.test(text)) return "P0 体验阻断或问题严重";
  if (/(无法|不能|难找|误解|截断|不清|无反馈)/.test(text)) return "P1 体验曲折或影响理解";
  return "P2 细节体验问题";
}

function compactTitle(text, category) {
  const prefix = category === categories[0] ? "界面" : category === categories[1] ? "信息" : category === categories[2] ? "交互" : "流程";
  const sentence = text.split(/[。；;\n]/).find(Boolean) || text;
  const cleanText = sentence.replace(/^(求助|吐槽|反馈)[：:\s]*/g, "").trim();
  return (cleanText.length > 22 ? `${cleanText.slice(0, 21)}…` : cleanText) || `${prefix}体验异常`;
}

function summarize(text) {
  const value = clean(text);
  return value.length > 46 ? `${value.slice(0, 45)}…` : value;
}

function clean(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function pattern(values) {
  const source = (values || []).filter(Boolean).map(escapeRegExp).join("|");
  return new RegExp(source || "(?!)");
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
