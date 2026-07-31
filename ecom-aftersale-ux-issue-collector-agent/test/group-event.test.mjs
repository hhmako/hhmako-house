import test from "node:test";
import assert from "node:assert/strict";
import { mergeEvents, normalizeGroupEvent } from "../src/group-event.mjs";
import { builtInAnalysis } from "../src/rules-engine.mjs";
import { buildRealtimePayload, validateRealtimePayload } from "../src/realtime-card.mjs";

test("群消息文字与图片会合并为一条候选问题", () => {
  const text = normalizeGroupEvent({ event: { sender: { sender_id: { open_id: "ou_1" } }, message: {
    message_id: "om_1", chat_id: "oc_1", message_type: "text", create_time: "1",
    content: JSON.stringify({ text: "抖音商城退款弹窗底部被裁切，无法继续退款" }),
  } } });
  const image = normalizeGroupEvent({ event: { sender: { sender_id: { open_id: "ou_1" } }, message: {
    message_id: "om_2", chat_id: "oc_1", message_type: "image", create_time: "2",
    content: JSON.stringify({ image_key: "img_1" }),
  } } });
  const merged = mergeEvents([text, image]);
  assert.deepEqual(merged.messageIds, ["om_1", "om_2"]);
  assert.equal(merged.imageRefs[0].fileKey, "img_1");
});

test("有截图的界面适配问题通过，纯物流履约问题被拦截", () => {
  const config = {
    scene: { platformTerms: ["抖音商城"], scopeTerms: ["退款", "物流"] },
    realtimeGroups: { requireEvidence: true },
    ownerMappings: { "售后&权益": [{ id: "ou_owner" }] },
  };
  const accepted = builtInAnalysis({ text: "抖音商城退款弹窗底部被裁切，无法继续退款", files: ["proof.png"] }, config);
  assert.equal(accepted.accepted, true);
  assert.equal(accepted.category, "界面显示与适配问题");
  const rejected = builtInAnalysis({ text: "抖音商城快递延误三天仍未送到", files: ["proof.png"] }, config);
  assert.equal(rejected.accepted, false);
});

test("post 消息会解析标题、正文和图片，秒级时间戳会转换为毫秒", () => {
  const event = normalizeGroupEvent({ event: { message: {
    message_id: "om_post",
    chat_id: "oc_fixture",
    message_type: "post",
    create_time: "1700000000",
    content: JSON.stringify({
      zh_cn: {
        title: "抖音商城退款问题",
        content: [[
          { tag: "text", text: "退款弹窗底部被裁切" },
          { tag: "img", image_key: "img_post" }
        ]]
      }
    })
  } } });
  assert.match(event.text, /退款弹窗底部被裁切/);
  assert.deepEqual(event.imageKeys, ["img_post"]);
  assert.equal(event.createTime, 1700000000000);
});

test("无截图问题和纯技术故障会被拦截，异常兜底设计问题可保留", () => {
  const config = {
    scene: { platformTerms: ["抖音商城"], scopeTerms: ["退款", "订单"] },
    realtimeGroups: { requireEvidence: true },
    ownerMappings: {},
  };
  assert.equal(builtInAnalysis({
    text: "抖音商城退款弹窗底部被裁切，无法继续退款",
    files: [],
  }, config).accepted, false);
  assert.equal(builtInAnalysis({
    text: "抖音商城订单接口加载失败，页面无法使用",
    files: ["proof.png"],
  }, config).accepted, false);
  assert.equal(builtInAnalysis({
    text: "抖音商城订单加载失败后没有错误提示和重试入口",
    files: ["proof.png"],
  }, config).accepted, true);
});

test("实时卡片直接使用真实问题字段、图片和来源链接", () => {
  const config = {
    cardTemplate: {
      realtimeTemplateId: "AAq_placeholder",
      issueBaseUrl: "https://example.com/base/placeholder",
      realtimeVariables: {},
    },
  };
  const issue = {
    recordId: "rec_fixture",
    priority: "P1 体验曲折或影响理解",
    title: "退款入口难找",
    problem: "退款入口层级过深，用户难以继续售后。",
    owners: ["负责人A"],
    imageKey: "img_fixture_123",
    sourceUrl: "https://example.com/source/1",
    detailUrl: "https://example.com/base/placeholder?record=rec_fixture",
  };
  const payload = buildRealtimePayload(issue, config);
  validateRealtimePayload(payload, issue, config);
  const variables = payload.card.data.template_variable;
  assert.match(variables.title_line, /退款入口难找/);
  assert.deepEqual(variables.image_key, { img_key: "img_fixture_123" });
  assert.equal(variables.source_url, issue.sourceUrl);
});
