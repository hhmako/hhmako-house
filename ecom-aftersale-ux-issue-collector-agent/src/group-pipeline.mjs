import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { analyzeCandidate } from "./rules-engine.mjs";
import { extractRecordId, uploadAttachment, upsertRecord } from "./lark-base.mjs";
import { groupSourceUrl } from "./group-event.mjs";
import { sendRealtimeCard } from "./realtime-card.mjs";

export class GroupPipeline {
  constructor({ config, openApi, state, dryRun = false }) {
    this.config = config;
    this.openApi = openApi;
    this.state = state;
    this.dryRun = dryRun;
  }

  sourceFor(candidate) {
    return (this.config.realtimeGroups?.sources || []).find((item) => item.chatId === candidate.chatId);
  }

  shouldReceive(candidate) {
    const source = this.sourceFor(candidate);
    if (!source) return false;
    if (source.mode !== "mention") return true;
    const expected = source.mentionNames || [];
    return candidate.mentions.some((mention) => expected.includes(mention.name));
  }

  async process(candidate) {
    if (!this.shouldReceive(candidate)) return { status: "ignored", reason: "非授权群或未 @ 指定机器人" };
    if (candidate.messageIds.every((id) => this.state.has(id))) return { status: "duplicate" };

    const source = this.sourceFor(candidate);
    candidate.sourceUrl = groupSourceUrl({ ...candidate, messageId: candidate.latestMessageId });
    candidate.sourceLabel = source.sourceValue || source.label;
    candidate.files = await this.downloadEvidence(candidate);
    const analysis = analyzeCandidate(candidate, this.config);

    if (!analysis.accepted) {
      const pendingFile = this.writePending(candidate, analysis);
      this.state.mark(candidate.messageIds, { status: "pending", pendingFile, reasons: analysis.reasons });
      return { status: "pending", reasons: analysis.reasons, pendingFile };
    }

    const issue = {
      ...analysis,
      sourceUrl: candidate.sourceUrl,
      sourceLabel: candidate.sourceLabel,
      messageId: candidate.latestMessageId,
      date: new Date(candidate.createTime).getTime(),
      files: candidate.files,
    };

    if (this.dryRun) {
      const previewFile = this.writePending(candidate, { ...analysis, accepted: true, dryRun: true });
      return { status: "dry-run", issue, previewFile };
    }

    const fields = this.buildFields(issue);
    const created = await upsertRecord(this.config.baseToken, this.config.tables.issues, fields);
    issue.recordId = extractRecordId(created);
    if (!issue.recordId) throw new Error("Base 写入成功响应中没有 record_id，已停止发送卡片。");

    for (const file of issue.files) {
      uploadAttachment(
        this.config.baseToken,
        this.config.tables.issues,
        issue.recordId,
        this.config.fields.imagesFieldId,
        file,
        path.basename(file),
      );
    }
    issue.imageKey = await this.openApi.uploadMessageImage(issue.files[0]);
    issue.detailUrl = recordUrl(this.config, issue.recordId);
    const cardResult = await sendRealtimeCard(issue, this.config);
    this.state.mark(candidate.messageIds, { status: "inserted", recordId: issue.recordId });
    return { status: "inserted", recordId: issue.recordId, cardResult };
  }

  async downloadEvidence(candidate) {
    const dir = path.join(this.config.runtimeDir, "group-media", safe(candidate.chatId), safe(candidate.latestMessageId));
    fs.mkdirSync(dir, { recursive: true });
    const files = [];
    for (const [index, ref] of candidate.imageRefs.entries()) {
      const file = path.join(dir, `evidence-${String(index + 1).padStart(2, "0")}.png`);
      await this.openApi.downloadMessageImage(ref.messageId, ref.fileKey, file);
      files.push(file);
    }
    return files;
  }

  buildFields(issue) {
    const fields = this.config.fields;
    const result = {
      [fields.title]: issue.title,
      [fields.problem]: issue.problem,
      [fields.priority]: issue.priority,
      [fields.owners]: issue.owners,
      [fields.source]: issue.sourceLabel,
      [fields.sourceUrl]: issue.sourceUrl,
      [fields.page]: [issue.page],
      [fields.category]: issue.category,
      [fields.progress]: "待确认",
      [fields.date]: issue.date,
    };
    if (fields.sourceMessageId) result[fields.sourceMessageId] = issue.messageId;
    if (fields.dedupeKey) result[fields.dedupeKey] = hash(`${issue.sourceLabel}:${issue.messageId}`);
    return Object.fromEntries(Object.entries(result).filter(([, value]) => value !== undefined && value !== ""));
  }

  writePending(candidate, analysis) {
    const file = path.join(this.config.runtimeDir, "group-inbox", `${Date.now()}-${safe(candidate.latestMessageId)}.json`);
    fs.writeFileSync(file, JSON.stringify({
      createdAt: new Date().toISOString(),
      candidate: redactRaw(candidate),
      analysis,
    }, null, 2));
    return file;
  }
}

function recordUrl(config, recordId) {
  const url = config.cardTemplate.issueBaseUrl;
  return `${url}${url.includes("?") ? "&" : "?"}table=${encodeURIComponent(config.tables.issues)}&record=${encodeURIComponent(recordId)}`;
}

function redactRaw(candidate) {
  const { raw, ...safeCandidate } = candidate;
  return safeCandidate;
}

function safe(value) {
  return String(value || "unknown").replace(/[^\w.-]+/g, "_").slice(0, 100);
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}
