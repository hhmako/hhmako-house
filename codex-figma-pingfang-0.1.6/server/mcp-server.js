import http from "node:http";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");
const port = Number(process.env.PORT || 3957);
const host = process.env.HOST || "";
const serverId = randomUUID();
const startedAt = new Date().toISOString();
const jobTimeoutMs = Number(process.env.BRIDGE_JOB_TIMEOUT_MS || 180_000);
const probeTimeoutMs = Number(process.env.BRIDGE_PROBE_TIMEOUT_MS || 20_000);
const requiredPluginCapabilities = [
  "probeFont",
  "renderDesign",
  "replaceText",
  "applyPingfangFont",
  "debugCurrentPage",
  "setCurrentPage",
];
const fontConfig = JSON.parse(
  await readFile(resolve(root, "config/font.json"), "utf8")
);

const sessions = new Set();
const pendingJobs = [];
const waitingMcpCalls = new Map();
const bridgeClients = new Map();

function activeBridgeClients() {
  const now = Date.now();
  return [...bridgeClients.values()].filter((client) => now - client.lastSeenAt < 3_000);
}

function trackBridgeClient(req) {
  const remoteAddress = req.socket.remoteAddress || "unknown";
  const remotePort = req.socket.remotePort || "unknown";
  const key = `${remoteAddress}:${remotePort}`;
  bridgeClients.set(key, {
    key,
    remoteAddress,
    remotePort,
    lastSeenAt: Date.now(),
  });
}

function sendJson(res, status, data, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type, mcp-session-id",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    ...headers,
  });
  res.end(JSON.stringify(data));
}

function sendSse(res, data, headers = {}) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "mcp-session-id",
    ...headers,
  });
  res.end(`event: message\ndata: ${JSON.stringify(data)}\n\n`);
}

function readBody(req) {
  return new Promise((resolveBody, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 5_000_000) {
        reject(new Error("Request body too large"));
        req.destroy();
      }
    });
    req.on("end", () => {
      if (!body) return resolveBody({});
      try {
        resolveBody(JSON.parse(body));
      } catch (error) {
        reject(error);
      }
    });
    req.on("error", reject);
  });
}

function toolsList(id) {
  return {
    jsonrpc: "2.0",
    id,
    result: {
      tools: [
        {
          name: "generate_pingfang_design",
          description:
            "Render a simple Figma design into the currently open Figma Desktop file. Text nodes are created with PingFang SC by default.",
          inputSchema: {
            type: "object",
            properties: {
              clearPage: {
                type: "boolean",
                description:
                  "When true, remove current page children before rendering.",
              },
              document: {
                type: "object",
                description:
                  "Design tree with frame, rectangle, and text nodes.",
              },
              appendToFrameName: {
                type: "string",
                description:
                  "When provided, append the rendered document inside the first top-level frame with this exact name.",
              },
            },
            required: ["document"],
            additionalProperties: true,
          },
        },
        {
          name: "replace_pingfang_text",
          description:
            "Replace existing text nodes in the currently open Figma Desktop file. Fonts are loaded locally, so PingFang SC text can be edited.",
          inputSchema: {
            type: "object",
            properties: {
              replacements: {
                type: "array",
                description:
                  "List of text replacements, each with nodeId and text.",
                items: {
                  type: "object",
                  properties: {
                    nodeId: { type: "string" },
                    text: { type: "string" },
                    visible: { type: "boolean" },
                  },
                  required: ["nodeId", "text"],
                  additionalProperties: true,
                },
              },
            },
            required: ["replacements"],
            additionalProperties: true,
          },
        },
        {
          name: "apply_pingfang_font",
          description:
            "Apply PingFang SC to every text node under the given text, frame, group, or page nodes in the currently open Figma Desktop file.",
          inputSchema: {
            type: "object",
            properties: {
              frameIds: {
                type: "array",
                items: { type: "string" },
                description: "Target node IDs. Text descendants under each target are updated.",
              },
              pageId: {
                type: "string",
                description: "Optional Figma page ID to switch to before applying fonts.",
              },
            },
            required: ["frameIds"],
            additionalProperties: true,
          },
        },
        {
          name: "debug_current_page",
          description:
            "Return the current Figma page, available pages, and top-level children visible to the local PingFang plugin.",
          inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
          },
        },
        {
          name: "set_current_page",
          description:
            "Switch the local Figma plugin runtime to a specific page ID before later operations.",
          inputSchema: {
            type: "object",
            properties: {
              pageId: { type: "string" },
            },
            required: ["pageId"],
            additionalProperties: false,
          },
        },
        {
          name: "replace_industry_status_text",
          description:
            "Replace the right-side status text inside 行业卡片 for cloned install-order frames in the currently open Figma Desktop file.",
          inputSchema: {
            type: "object",
            properties: {
              items: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    frameId: { type: "string" },
                    text: { type: "string" },
                    hideAction: { type: "boolean" },
                  },
                  required: ["frameId", "text"],
                  additionalProperties: true,
                },
              },
            },
            required: ["items"],
            additionalProperties: true,
          },
        },
        {
          name: "expand_install_detail_states",
          description:
            "Clone an install detail frame and apply per-state PingFang copy/button/evaluation visibility changes in the currently open Figma Desktop file.",
          inputSchema: {
            type: "object",
            properties: {
              sourceFrameId: { type: "string" },
              states: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    status: { type: "string" },
                    mainTitle: { type: "string" },
                    subtitle: { type: "string" },
                    mainButton: { type: "string" },
                    auxButtons: {
                      type: "array",
                      items: { type: "string" },
                    },
                    showEvaluation: { type: "boolean" },
                    bottomButtons: {
                      type: "array",
                      items: { type: "string" },
                    },
                  },
                  required: ["status", "mainTitle", "subtitle"],
                  additionalProperties: true,
                },
              },
            },
            required: ["sourceFrameId", "states"],
            additionalProperties: true,
          },
        },
      ],
    },
  };
}

function enqueueBridgeJob(job, timeoutMs = jobTimeoutMs) {
  const jobId = randomUUID();
  const timeout = setTimeout(() => {
    const pendingIndex = pendingJobs.findIndex((pendingJob) => pendingJob.id === jobId);
    if (pendingIndex >= 0) pendingJobs.splice(pendingIndex, 1);

    const waiter = waitingMcpCalls.get(jobId);
    if (!waiter) return;
    waitingMcpCalls.delete(jobId);
    waiter.reject(
      new Error(
        "Timed out waiting for Figma plugin. Open the PingFang bridge plugin in Figma Desktop and keep it running."
      )
    );
  }, timeoutMs);

  pendingJobs.push({
    id: jobId,
    ...job,
  });

  return new Promise((resolveCall, reject) => {
    waitingMcpCalls.set(jobId, {
      job: pendingJobs[pendingJobs.length - 1],
      resolve: (result) => {
        clearTimeout(timeout);
        resolveCall(result);
      },
      reject: (error) => {
        clearTimeout(timeout);
        reject(error);
      },
    });
  });
}

async function enqueueRenderCall(id, params) {
  const result = await enqueueBridgeJob({
    type: "renderDesign",
    payload: {
      clearPage: Boolean(params?.arguments?.clearPage),
      appendToFrameName: params?.arguments?.appendToFrameName,
      document: params?.arguments?.document,
      font: fontConfig,
    },
  });

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Rendered ${result.createdCount || 0} nodes with ${fontConfig.fontFamily}.`,
        },
      ],
    },
  };
}

async function enqueueReplaceTextCall(id, params) {
  const result = await enqueueBridgeJob({
    type: "replaceText",
    payload: {
      replacements: params?.arguments?.replacements || [],
      font: fontConfig,
    },
  });

  return {
    jsonrpc: "2.0",
    id,
    result: {
      content: [
        {
          type: "text",
          text: `Replaced ${result.updatedCount || 0} text nodes with ${fontConfig.fontFamily}.`,
        },
      ],
    },
  };
}

async function enqueueReplaceTextHttp(replacements) {
  const result = await enqueueBridgeJob({
    type: "replaceText",
    payload: {
      replacements: replacements || [],
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    fontFamily: fontConfig.fontFamily,
  };
}

async function enqueueReplaceIndustryStatusHttp(items) {
  const result = await enqueueBridgeJob({
    type: "replaceIndustryStatus",
    payload: {
      items: items || [],
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    fontFamily: fontConfig.fontFamily,
  };
}

async function enqueueExpandInstallDetailStatesHttp(sourceFrameId, states, startIndex = 0) {
  const result = await enqueueBridgeJob({
    type: "expandInstallDetailStates",
    payload: {
      sourceFrameId,
      startIndex: Number(startIndex) || 0,
      states: states || [],
      font: fontConfig,
    },
  });

  return {
    ok: true,
    variants: result.variants || [],
    updatedCount: result.updatedCount || 0,
    fontFamily: fontConfig.fontFamily,
  };
}

async function enqueueFixInstallDetailSubtitlesHttp(frameIds) {
  const result = await enqueueBridgeJob({
    type: "fixInstallDetailSubtitles",
    payload: {
      frameIds: frameIds || [],
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    fontFamily: fontConfig.fontFamily,
  };
}

async function enqueueFixGeneratedInstallDetail9778Http(items) {
  const result = await enqueueBridgeJob({
    type: "fixGeneratedInstallDetail9778",
    payload: {
      items: items || [],
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    fontFamily: fontConfig.fontFamily,
  };
}

async function enqueueApplyPingfangFontHttp(frameIds, pageId) {
  const result = await enqueueBridgeJob({
    type: "applyPingfangFont",
    payload: {
      frameIds: frameIds || [],
      pageId,
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    skippedCount: result.skippedCount || 0,
    fontFamily: fontConfig.fontFamily,
  };
}

async function enqueueReplaceRepairCopyInSolutionHttp(rootId, pageId, frameIds = []) {
  const result = await enqueueBridgeJob({
    type: "replaceRepairCopyInSolution",
    payload: {
      rootId,
      pageId,
      frameIds,
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    fontFamily: fontConfig.fontFamily,
    sample: result.sample || [],
  };
}

async function enqueueFixRepairServiceCopyAndWeightsHttp(rootId, pageId, frameIds = []) {
  const result = await enqueueBridgeJob({
    type: "fixRepairServiceCopyAndWeights",
    payload: {
      rootId,
      pageId,
      frameIds,
      font: fontConfig,
    },
  });

  return {
    ok: true,
    copyUpdatedCount: result.copyUpdatedCount || 0,
    regularUpdatedCount: result.regularUpdatedCount || 0,
    fontFamily: fontConfig.fontFamily,
    sample: result.sample || [],
  };
}

async function enqueueFixExactTextNodesHttp(items) {
  const result = await enqueueBridgeJob({
    type: "fixExactTextNodes",
    payload: {
      items: items || [],
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    fontFamily: fontConfig.fontFamily,
    sample: result.sample || [],
  };
}

async function enqueueApplyServiceDetailRowsHttp(rows, dryRun = false) {
  const result = await enqueueBridgeJob({
    type: "applyServiceDetailRows",
    payload: {
      rows: rows || [],
      dryRun,
      font: fontConfig,
    },
  });

  return {
    ok: true,
    dryRun: result.dryRun || false,
    updatedCount: result.updatedCount || 0,
    diffCount: result.diffCount || 0,
    diffs: result.diffs || [],
    missingFrames: result.missingFrames || [],
    fontFamily: fontConfig.fontFamily,
    sample: result.sample || [],
  };
}

async function enqueueFixBottomActionsAndServiceTitlesHttp(rows) {
  const result = await enqueueBridgeJob({
    type: "fixBottomActionsAndServiceTitles",
    payload: {
      rows: rows || [],
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    missingFrames: result.missingFrames || [],
    fontFamily: fontConfig.fontFamily,
    sample: result.sample || [],
  };
}

async function enqueueSetSmallLeftTitlesFontHttp(frameIds, pageId, weight = "regular") {
  const result = await enqueueBridgeJob({
    type: "setSmallLeftTitlesFont",
    payload: {
      frameIds: frameIds || [],
      pageId,
      weight,
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    fontFamily: fontConfig.fontFamily,
    sample: result.sample || [],
  };
}

async function enqueueFixNoReturnProgressHttp(frameIds, pageId) {
  const result = await enqueueBridgeJob({
    type: "fixNoReturnProgress",
    payload: {
      frameIds: frameIds || [],
      pageId,
      font: fontConfig,
    },
  });

  return {
    ok: true,
    updatedCount: result.updatedCount || 0,
    removedCount: result.removedCount || 0,
    fontFamily: fontConfig.fontFamily,
    sample: result.sample || [],
  };
}

async function enqueueOrganizeRepairStateComponentsHttp(rootId, pageId) {
  const result = await enqueueBridgeJob({
    type: "organizeRepairStateComponents",
    payload: {
      rootId,
      pageId,
      font: fontConfig,
    },
  });

  return {
    ok: true,
    createdCount: result.createdCount || 0,
    created: result.created || [],
    gaps: result.gaps || [],
    fontFamily: fontConfig.fontFamily,
  };
}

async function enqueueDebugCurrentPageHttp() {
  const result = await enqueueBridgeJob({
    type: "debugCurrentPage",
    payload: {},
  });

  return {
    ok: true,
    ...result,
  };
}

async function enqueueSetCurrentPageHttp(pageId) {
  const result = await enqueueBridgeJob({
    type: "setCurrentPage",
    payload: { pageId },
  });

  return {
    ok: true,
    ...result,
  };
}

async function handleMcp(req, res) {
  const message = await readBody(req);

  if (message.method === "initialize") {
    const sessionId = randomUUID();
    sessions.add(sessionId);
    sendSse(
      res,
      {
        jsonrpc: "2.0",
        id: message.id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: { tools: { listChanged: false } },
          serverInfo: {
            name: "codex-figma-pingfang",
            version: "0.1.6",
          },
        },
      },
      { "mcp-session-id": sessionId }
    );
    return;
  }

  if (message.method === "notifications/initialized") {
    res.writeHead(202, { "Access-Control-Allow-Origin": "*" });
    res.end();
    return;
  }

  const sessionId = req.headers["mcp-session-id"];
  if (!sessionId) {
    sendSse(res, {
      jsonrpc: "2.0",
      id: message.id ?? null,
      error: { code: -32001, message: "Invalid sessionId" },
    });
    return;
  }
  sessions.add(String(sessionId));

  if (message.method === "tools/list") {
    sendSse(res, toolsList(message.id));
    return;
  }

  if (message.method === "tools/call") {
    const params = message.params || {};
    if (
      ![
        "generate_pingfang_design",
        "replace_pingfang_text",
        "apply_pingfang_font",
        "debug_current_page",
        "set_current_page",
        "replace_industry_status_text",
        "expand_install_detail_states",
      ].includes(params.name)
    ) {
      sendSse(res, {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32601, message: `Unknown tool: ${params.name}` },
      });
      return;
    }

    try {
      const response =
        params.name === "replace_industry_status_text"
          ? {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Updated ${(await enqueueReplaceIndustryStatusHttp(params?.arguments?.items || [])).updatedCount} industry status nodes with ${fontConfig.fontFamily}.`,
                  },
                ],
              },
            }
          : params.name === "expand_install_detail_states"
          ? {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Expanded ${(await enqueueExpandInstallDetailStatesHttp(params?.arguments?.sourceFrameId, params?.arguments?.states || [], params?.arguments?.startIndex || 0)).variants.length} install detail state frames with ${fontConfig.fontFamily}.`,
                  },
                ],
              },
            }
          : params.name === "replace_pingfang_text"
          ? await enqueueReplaceTextCall(message.id, params)
          : params.name === "apply_pingfang_font"
          ? {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: `Applied ${fontConfig.fontFamily} to ${(await enqueueApplyPingfangFontHttp(params?.arguments?.frameIds || [], params?.arguments?.pageId)).updatedCount} text nodes.`,
                  },
                ],
              },
            }
          : params.name === "debug_current_page"
          ? {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await enqueueDebugCurrentPageHttp()),
                  },
                ],
              },
            }
          : params.name === "set_current_page"
          ? {
              jsonrpc: "2.0",
              id: message.id,
              result: {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify(await enqueueSetCurrentPageHttp(params?.arguments?.pageId)),
                  },
                ],
              },
            }
          : await enqueueRenderCall(message.id, params);
      sendSse(res, response);
    } catch (error) {
      sendSse(res, {
        jsonrpc: "2.0",
        id: message.id,
        error: { code: -32000, message: error.message },
      });
    }
    return;
  }

  sendSse(res, {
    jsonrpc: "2.0",
    id: message.id ?? null,
    error: { code: -32601, message: `Unsupported method: ${message.method}` },
  });
}

async function handleBridgeNext(req, res) {
  trackBridgeClient(req);
  const job = pendingJobs.shift();
  if (!job) {
    sendJson(res, 200, {
      job: null,
      serverId,
      startedAt,
    });
    return;
  }
  sendJson(res, 200, { job, serverId, startedAt });
}

async function handleBridgeResult(req, res) {
  const result = await readBody(req);
  const waiter = waitingMcpCalls.get(result.id);
  if (!waiter) {
    sendJson(res, 404, { ok: false, error: "Unknown or expired job" });
    return;
  }

  waitingMcpCalls.delete(result.id);
  if (result.ok) {
    waiter.resolve(result);
  } else {
    waiter.reject(new Error(result.error || "Figma render failed"));
  }
  sendJson(res, 200, { ok: true });
}

async function handleProbe(res) {
  try {
    const result = await enqueueBridgeJob(
      {
        type: "probeFont",
        payload: {
          font: fontConfig,
        },
      },
      probeTimeoutMs
    );
    sendJson(res, 200, {
      ok: true,
      serverId,
      startedAt,
      fontFamily: fontConfig.fontFamily,
      requiredPluginCapabilities,
      missingPluginCapabilities: requiredPluginCapabilities.filter(
        (capability) => !Array.isArray(result.capabilities) || !result.capabilities.includes(capability)
      ),
      plugin: result,
    });
  } catch (error) {
    sendJson(res, 503, {
      ok: false,
      serverId,
      startedAt,
      error: error.message,
      activeBridgeClients: activeBridgeClients().length,
      pendingJobs: pendingJobs.length,
      waitingCalls: waitingMcpCalls.size,
    });
  }
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === "OPTIONS") {
      sendJson(res, 200, { ok: true });
      return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    if (req.method === "GET" && url.pathname === "/health") {
      sendJson(res, 200, {
        ok: true,
        serverId,
        startedAt,
        pendingJobs: pendingJobs.length,
        waitingCalls: waitingMcpCalls.size,
        activeBridgeClients: activeBridgeClients().length,
        bridgeClients: activeBridgeClients().map((client) => ({
          remoteAddress: client.remoteAddress,
          remotePort: client.remotePort,
          lastSeenAgoMs: Date.now() - client.lastSeenAt,
        })),
        fontFamily: fontConfig.fontFamily,
        requiredPluginCapabilities,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/probe") {
      await handleProbe(res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/replace-text") {
      const body = await readBody(req);
      const result = await enqueueReplaceTextHttp(body.replacements || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/replace-industry-status") {
      const body = await readBody(req);
      const result = await enqueueReplaceIndustryStatusHttp(body.items || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/expand-install-detail-states") {
      const body = await readBody(req);
      const result = await enqueueExpandInstallDetailStatesHttp(body.sourceFrameId, body.states || [], body.startIndex || 0);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/fix-install-detail-subtitles") {
      const body = await readBody(req);
      const result = await enqueueFixInstallDetailSubtitlesHttp(body.frameIds || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/fix-generated-install-detail-9778") {
      const body = await readBody(req);
      const result = await enqueueFixGeneratedInstallDetail9778Http(body.items || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/apply-pingfang-font") {
      const body = await readBody(req);
      const result = await enqueueApplyPingfangFontHttp(body.frameIds || [], body.pageId);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/replace-repair-copy-in-solution") {
      const body = await readBody(req);
      const result = await enqueueReplaceRepairCopyInSolutionHttp(body.rootId, body.pageId, body.frameIds || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/fix-repair-service-copy-and-weights") {
      const body = await readBody(req);
      const result = await enqueueFixRepairServiceCopyAndWeightsHttp(body.rootId, body.pageId, body.frameIds || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/fix-exact-text-nodes") {
      const body = await readBody(req);
      const result = await enqueueFixExactTextNodesHttp(body.items || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/apply-service-detail-rows") {
      const body = await readBody(req);
      const result = await enqueueApplyServiceDetailRowsHttp(body.rows || [], Boolean(body.dryRun));
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/fix-bottom-actions-and-service-titles") {
      const body = await readBody(req);
      const result = await enqueueFixBottomActionsAndServiceTitlesHttp(body.rows || []);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/set-small-left-titles-medium") {
      const body = await readBody(req);
      const result = await enqueueSetSmallLeftTitlesFontHttp(body.frameIds || [], body.pageId, "medium");
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/set-small-left-titles-font") {
      const body = await readBody(req);
      const result = await enqueueSetSmallLeftTitlesFontHttp(body.frameIds || [], body.pageId, body.weight || "regular");
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/fix-no-return-progress") {
      const body = await readBody(req);
      const result = await enqueueFixNoReturnProgressHttp(body.frameIds || [], body.pageId);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/organize-repair-state-components") {
      const body = await readBody(req);
      const result = await enqueueOrganizeRepairStateComponentsHttp(body.rootId, body.pageId);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "GET" && url.pathname === "/debug-current-page") {
      const result = await enqueueDebugCurrentPageHttp();
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/set-current-page") {
      const body = await readBody(req);
      const result = await enqueueSetCurrentPageHttp(body.pageId);
      sendJson(res, 200, result);
      return;
    }

    if (req.method === "POST" && url.pathname === "/mcp") {
      await handleMcp(req, res);
      return;
    }

    if (req.method === "GET" && url.pathname === "/bridge/next") {
      await handleBridgeNext(req, res);
      return;
    }

    if (req.method === "POST" && url.pathname === "/bridge/result") {
      await handleBridgeResult(req, res);
      return;
    }

    sendJson(res, 404, { ok: false, error: "Not found" });
  } catch (error) {
    sendJson(res, 500, { ok: false, error: error.message });
  }
});

const listenArgs = host ? [port, host] : [port];
server.listen(...listenArgs, () => {
  const displayHost = host || "localhost";
  console.log(`codex-figma-pingfang listening on http://${displayHost}:${port}`);
  console.log(`MCP endpoint: http://${displayHost}:${port}/mcp`);
});
