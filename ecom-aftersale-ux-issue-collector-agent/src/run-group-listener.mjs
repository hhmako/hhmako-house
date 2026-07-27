import fs from "node:fs";
import path from "node:path";
import * as lark from "@larksuiteoapi/node-sdk";
import { arg, ensureRuntime, loadConfig, requireConfig } from "./config.mjs";
import { MessageBatcher, normalizeGroupEvent } from "./group-event.mjs";
import { GroupPipeline } from "./group-pipeline.mjs";
import { LarkOpenApi } from "./lark-openapi.mjs";
import { StateStore } from "./state-store.mjs";

const config = loadConfig(arg("config") || "config.local.json");
const fixture = arg("fixture");
const dryRun = Boolean(arg("dry-run"));
ensureRuntime(config);
requireConfig(config, [
  "baseToken",
  "tables.issues",
  "fields.imagesFieldId",
  "cardTemplate.realtimeTemplateId",
  "cardTemplate.issueBaseUrl",
]);

if (!fixture && (!process.env.LARK_APP_ID || !process.env.LARK_APP_SECRET)) {
  throw new Error("实时监听需要 LARK_APP_ID 和 LARK_APP_SECRET。");
}

const state = new StateStore(path.join(config.runtimeDir, "group-listener-state.json"));
const openApi = fixture && dryRun
  ? {
      downloadMessageImage: async (_messageId, _fileKey, output) => {
        fs.mkdirSync(path.dirname(output), { recursive: true });
        fs.writeFileSync(output, Buffer.from("fixture"));
        return output;
      },
      uploadMessageImage: async () => "img_fixture_dry_run",
    }
  : new LarkOpenApi();
const pipeline = new GroupPipeline({ config, openApi, state, dryRun });
const batcher = new MessageBatcher({
  waitMs: config.realtimeGroups?.mergeWindowMs || 6000,
  onFlush: async (candidate) => {
    try {
      const result = await pipeline.process(candidate);
      console.log(JSON.stringify({ event: "candidate_processed", messageIds: candidate.messageIds, ...result }));
    } catch (error) {
      console.error(JSON.stringify({ event: "candidate_failed", messageIds: candidate.messageIds, error: error.message }));
    }
  },
});

if (fixture) {
  const payload = JSON.parse(fs.readFileSync(fixture, "utf8"));
  const items = Array.isArray(payload) ? payload : [payload];
  if (dryRun) {
    const fixtureChatIds = new Set(items.map((item) => normalizeGroupEvent(item).chatId).filter(Boolean));
    config.realtimeGroups.sources = [
      ...(config.realtimeGroups.sources || []),
      ...[...fixtureChatIds].map((chatId) => ({
        chatId,
        label: "本地测试群",
        sourceValue: "本地测试",
        mode: "all",
      })),
    ];
  }
  for (const item of items) batcher.add(normalizeGroupEvent(item));
  await batcher.flushAll();
} else {
  const eventDispatcher = new lark.EventDispatcher({}).register({
    "im.message.receive_v1": async (data) => {
      const event = normalizeGroupEvent(data);
      if (!event.messageId || !event.chatId) return;
      batcher.add(event);
    },
  });
  const wsClient = new lark.WSClient({
    appId: process.env.LARK_APP_ID,
    appSecret: process.env.LARK_APP_SECRET,
    domain: lark.Domain.Feishu,
    loggerLevel: lark.LoggerLevel.info,
  });
  console.log(JSON.stringify({
    event: "listener_starting",
    sourceGroups: config.realtimeGroups.sources.map((item) => item.label),
    stateFile: path.join(config.runtimeDir, "group-listener-state.json"),
  }));
  await wsClient.start({ eventDispatcher });
}
