figma.showUI(__html__, { width: 320, height: 170 });

const bridgePluginVersion = "0.1.6";
const bridgePluginCapabilities = [
  "probeFont",
  "renderDesign",
  "replaceText",
  "applyPingfangFont",
  "debugCurrentPage",
  "setCurrentPage",
];

const defaultFont = {
  fontFamily: "PingFang SC",
  weights: {
    regular: "Regular",
    medium: "Medium",
    semibold: "Semibold",
  },
};

function solidPaint(value) {
  if (!value) return null;
  if (typeof value !== "string") return null;

  const rgbaMatch = value.match(/^rgba\((\d+),\s*(\d+),\s*(\d+),\s*([\d.]+)\)$/i);
  if (rgbaMatch) {
    const [, r, g, b, a] = rgbaMatch;
    return {
      type: "SOLID",
      color: {
        r: Number(r) / 255,
        g: Number(g) / 255,
        b: Number(b) / 255,
      },
      opacity: Number(a),
    };
  }

  const hex = value.replace("#", "").trim();
  if (!/^[0-9a-f]{6}$/i.test(hex)) return null;
  return {
    type: "SOLID",
    color: {
      r: parseInt(hex.slice(0, 2), 16) / 255,
      g: parseInt(hex.slice(2, 4), 16) / 255,
      b: parseInt(hex.slice(4, 6), 16) / 255,
    },
  };
}

function applyBox(node, spec) {
  if (spec.name) node.name = spec.name;
  if (typeof spec.x === "number") node.x = spec.x;
  if (typeof spec.y === "number") node.y = spec.y;
  if (typeof spec.width === "number" && typeof spec.height === "number") {
    node.resize(spec.width, spec.height);
  }

  const fill = solidPaint(spec.fill);
  if (fill && "fills" in node) node.fills = [fill];

  const stroke = solidPaint(spec.stroke);
  if (stroke && "strokes" in node) {
    node.strokes = [stroke];
    node.strokeWeight = typeof spec.strokeWidth === "number" ? spec.strokeWidth : 1;
  }

  if (typeof spec.cornerRadius === "number" && "cornerRadius" in node) {
    node.cornerRadius = spec.cornerRadius;
  }
}

function applyAutoLayout(frame, spec) {
  if (spec.layout === "horizontal") frame.layoutMode = "HORIZONTAL";
  if (spec.layout === "vertical") frame.layoutMode = "VERTICAL";
  if (!spec.layout) return;

  frame.itemSpacing = typeof spec.gap === "number" ? spec.gap : 0;
  frame.primaryAxisAlignItems = spec.primaryAxisAlignItems || "MIN";
  frame.counterAxisAlignItems = spec.counterAxisAlignItems || "MIN";

  const padding = spec.padding || {};
  if (typeof padding === "number") {
    frame.paddingTop = padding;
    frame.paddingRight = padding;
    frame.paddingBottom = padding;
    frame.paddingLeft = padding;
  } else {
    frame.paddingTop = padding.top || 0;
    frame.paddingRight = padding.right || 0;
    frame.paddingBottom = padding.bottom || 0;
    frame.paddingLeft = padding.left || 0;
  }
}

function normalizeWeight(weight) {
  if (typeof weight === "number") {
    if (weight >= 600) return "semibold";
    if (weight >= 500) return "medium";
    return "regular";
  }
  if (typeof weight !== "string") return "regular";
  const normalized = weight.toLowerCase().replace(/\s+/g, "");
  if (normalized === "600" || normalized === "semibold" || normalized === "semi-bold") return "semibold";
  if (normalized === "500" || normalized === "medium") return "medium";
  return normalized || "regular";
}

function resolveFont(fontConfig, weight) {
  const config = fontConfig || defaultFont;
  const weights = config.weights || defaultFont.weights;
  const key = normalizeWeight(weight);
  return {
    family: config.fontFamily || defaultFont.fontFamily,
    style: weights[key] || weights.regular || "Regular",
  };
}

async function createText(spec, fontConfig) {
  const node = figma.createText();
  const fontName = resolveFont(fontConfig, spec.fontWeight);
  await figma.loadFontAsync(fontName);
  node.fontName = fontName;
  node.characters = spec.text || spec.content || "";
  node.fontSize = typeof spec.fontSize === "number" ? spec.fontSize : 16;
  if (!spec.fill && spec.color) spec.fill = spec.color;
  applyBox(node, spec);
  if (typeof spec.lineHeight === "number") {
    node.lineHeight = { unit: "PIXELS", value: spec.lineHeight };
  }
  if (typeof spec.width === "number") {
    node.resize(spec.width, node.height);
  }
  return node;
}

async function createNode(spec, fontConfig) {
  if (!spec || typeof spec !== "object") {
    throw new Error("Invalid node spec");
  }

  if (spec.type === "text") {
    return createText(spec, fontConfig);
  }

  const node = spec.type === "rectangle" ? figma.createRectangle() : figma.createFrame();
  applyBox(node, spec);
  if (node.type === "FRAME") {
    applyAutoLayout(node, spec);
    for (const childSpec of spec.children || []) {
      const child = await createNode(childSpec, fontConfig);
      node.appendChild(child);
    }
  }
  return node;
}

function countNodes(node) {
  if (!("children" in node)) return 1;
  return 1 + node.children.reduce((total, child) => total + countNodes(child), 0);
}

async function renderDesign(job) {
  const payload = job.payload || {};
  if (payload.clearPage) {
    for (const child of [...figma.currentPage.children]) child.remove();
  }

  const root = await createNode(payload.document, payload.font);
  if (payload.appendToFrameName) {
    const parent = figma.currentPage.findChild(
      (node) => node.type === "FRAME" && node.name === payload.appendToFrameName
    );
    if (!parent || parent.type !== "FRAME") {
      throw new Error(`Target frame not found: ${payload.appendToFrameName}`);
    }
    parent.appendChild(root);
  } else {
    figma.currentPage.appendChild(root);
  }
  figma.viewport.scrollAndZoomIntoView([root]);

  return {
    id: job.id,
    ok: true,
    createdCount: countNodes(root),
  };
}

async function replaceText(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const replacements = Array.isArray(payload.replacements) ? payload.replacements : [];
  let updatedCount = 0;

  await figma.loadFontAsync(resolveFont(fontConfig, "regular"));
  await figma.loadFontAsync(resolveFont(fontConfig, "medium"));
  await figma.loadFontAsync(resolveFont(fontConfig, "semibold"));

  for (const item of replacements) {
    if (!item || !item.nodeId) continue;
    const node = await figma.getNodeByIdAsync(item.nodeId);
    if (!node || node.type !== "TEXT") {
      throw new Error(`Text node not found: ${item.nodeId}`);
    }
    node.fontName = resolveFont(fontConfig, pingfangWeightForNode(node));
    node.characters = item.text || "";
    if (typeof item.visible === "boolean") node.visible = item.visible;
    if ("textAutoResize" in node) node.textAutoResize = "WIDTH_AND_HEIGHT";
    updatedCount += 1;
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
  };
}

async function replaceIndustryStatus(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const items = Array.isArray(payload.items) ? payload.items : [];
  let updatedCount = 0;

  await figma.loadFontAsync(resolveFont(fontConfig, "regular"));
  await figma.loadFontAsync(resolveFont(fontConfig, "medium"));

  for (const item of items) {
    if (!item || !item.frameId) continue;
    const frame = figma.getNodeById(item.frameId);
    if (!frame || !("findOne" in frame)) {
      throw new Error(`Frame not found: ${item.frameId}`);
    }
    const industry = frame.findOne((node) => node.name === "行业卡片");
    if (!industry || !("findAll" in industry)) {
      throw new Error(`行业卡片 not found in frame: ${item.frameId}`);
    }
    const texts = industry.findAll((node) => node.type === "TEXT");
    const statusText =
      texts.find((node) => node.name === "查看详情") ||
      texts.find((node) => node.characters.includes("等待商家安排安装"));
    const actionText =
      texts.find((node) => node.name === "行动点") ||
      texts.find((node) => node.characters === "预约");
    if (!statusText) {
      throw new Error(`Status text not found in frame: ${item.frameId}`);
    }
    if (statusText.fontName && statusText.fontName !== figma.mixed) {
      await figma.loadFontAsync(statusText.fontName);
    }
    statusText.fontName = resolveFont(fontConfig, "regular");
    statusText.characters = item.text || "";
    if ("textAutoResize" in statusText) statusText.textAutoResize = "WIDTH_AND_HEIGHT";
    updatedCount += 1;

    if (item.hideAction && actionText) {
      actionText.visible = false;
      updatedCount += 1;
    }
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
  };
}

function findDescendant(root, predicate) {
  if (!root || !("findOne" in root)) return null;
  return root.findOne(predicate);
}

function allDescendants(root, predicate) {
  if (!root || !("findAll" in root)) return [];
  return root.findAll(predicate);
}

function textNodes(root) {
  if (root && root.type === "TEXT") return [root];
  return allDescendants(root, (node) => node.type === "TEXT");
}

function findText(root, predicate) {
  return textNodes(root).find(predicate) || null;
}

function findTextByCharacters(root, characters) {
  return findText(root, (node) => node.characters === characters);
}

function findTextContaining(root, value) {
  return findText(root, (node) => node.characters.includes(value));
}

function findAncestor(node, predicate, stopNode) {
  let current = node;
  while (current && current !== stopNode) {
    if (predicate(current)) return current;
    current = current.parent;
  }
  return null;
}

async function loadFontsInSubtree(root, fontConfig) {
  const fonts = new Map();
  fonts.set(JSON.stringify(resolveFont(fontConfig, "regular")), resolveFont(fontConfig, "regular"));
  fonts.set(JSON.stringify(resolveFont(fontConfig, "medium")), resolveFont(fontConfig, "medium"));
  fonts.set(JSON.stringify(resolveFont(fontConfig, "semibold")), resolveFont(fontConfig, "semibold"));
  for (const node of textNodes(root)) {
    const segments = node.getStyledTextSegments(["fontName"]);
    for (const segment of segments) {
      if (segment.fontName && segment.fontName !== figma.mixed) {
        fonts.set(JSON.stringify(segment.fontName), segment.fontName);
      }
    }
    if (node.fontName && node.fontName !== figma.mixed) {
      fonts.set(JSON.stringify(node.fontName), node.fontName);
    }
  }
  for (const fontName of fonts.values()) {
    await figma.loadFontAsync(fontName);
  }
}

async function setText(node, value, fontConfig, weight) {
  if (!node || node.type !== "TEXT") return false;
  const fontName = resolveFont(fontConfig, weight || "regular");
  await figma.loadFontAsync(fontName);
  if (node.fontName && node.fontName !== figma.mixed) {
    await figma.loadFontAsync(node.fontName);
  }
  node.fontName = fontName;
  node.characters = value || "";
  if ("textAutoResize" in node) node.textAutoResize = "WIDTH_AND_HEIGHT";
  node.visible = true;
  return true;
}

function setNodeVisible(node, visible) {
  if (node && "visible" in node) node.visible = visible;
}

function visibleChildren(node) {
  return node && "children" in node ? [...node.children].filter((child) => "visible" in child) : [];
}

function sortByX(nodes) {
  return [...nodes].sort((a, b) => a.x - b.x);
}

async function applyInstallDetailState(frame, state, fontConfig) {
  let updatedCount = 0;
  const content = findDescendant(frame, (node) => node.name === "内容");
  const topCard =
    findDescendant(frame, (node) => node.name === "顶卡") ||
    findDescendant(frame, (node) => node.name === "头部卡片");
  const header =
    findDescendant(frame, (node) => node.name === "头部状态") ||
    findDescendant(frame, (node) => node.name === "头部卡片");
  const fulfillment =
    findDescendant(frame, (node) => node.name === "履约信息") ||
    findDescendant(frame, (node) => node.name === "头部卡片");
  const evaluation = findDescendant(frame, (node) => node.name === "评价");
  const product = findDescendant(frame, (node) => node.name === "商品模块");
  const problem = findDescendant(frame, (node) => node.name === "遇到问题");
  const compensation =
    findDescendant(frame, (node) => node.name === "投诉详情") ||
    findDescendant(frame, (node) => node.name === "赔付模块");
  const orderActions = findDescendant(frame, (node) => node.name === "订单操作");

  const titleText =
    (header && findText(header, (node) => node.name === "主文本")) ||
    findTextByCharacters(frame, "待商家安装");
  if (await setText(titleText, state.mainTitle, fontConfig, "semibold")) updatedCount += 1;

  const subtitleText =
    (header && findTextContaining(header, "您可以选择安装时间")) ||
    (header && findTextContaining(header, "商家分配的安装师傅")) ||
    findTextContaining(frame, "商家分配的安装师傅");
  if (await setText(subtitleText, state.subtitle, fontConfig, "regular")) updatedCount += 1;

  if (fulfillment) {
    const addressBlock = findDescendant(fulfillment, (node) => node.name === "安装地址");
    const showAddress = state.addressVisible !== false && state.address !== "隐藏";
    if (addressBlock) {
      setNodeVisible(addressBlock, showAddress);
      updatedCount += 1;
    }

    const buttonContainer = findDescendant(fulfillment, (node) => node.name === "按钮");
    const buttonGroup =
      buttonContainer && findDescendant(buttonContainer, (node) => node.name === "按钮组合");
    const groupedButtons = sortByX(
      buttonGroup && buttonGroup.children
        ? buttonGroup.children.filter((node) => node.name === "常规按钮")
        : []
    );
    const headAux = buttonContainer && findDescendant(buttonContainer, (node) => node.name === "辅助操作");
    const isHeadCard = topCard && topCard.name === "头部卡片";
    const auxButtons = Array.isArray(state.auxButtons) ? state.auxButtons : [];

    if (isHeadCard && buttonContainer && groupedButtons.length > 0) {
      setNodeVisible(buttonContainer, Boolean(state.mainButton) || auxButtons.length > 0);
      const visiblePrimaryButtons = [state.mainButton, ...auxButtons].filter(Boolean).slice(0, groupedButtons.length);
      for (let i = 0; i < groupedButtons.length; i++) {
        const button = groupedButtons[i];
        const label = visiblePrimaryButtons[i];
        setNodeVisible(button, Boolean(label));
        if (label) {
          const buttonText = textNodes(button)[0];
          if (await setText(buttonText, label, fontConfig, "medium")) updatedCount += 1;
        }
      }
      const remainingAux = [state.mainButton, ...auxButtons].filter(Boolean).slice(groupedButtons.length);
      if (headAux) {
        setNodeVisible(headAux, remainingAux.length > 0);
        const opItems = sortByX(
          headAux.children ? headAux.children.filter((node) => node.name === "操作元素") : []
        );
        for (let i = 0; i < opItems.length; i++) {
          const item = opItems[i];
          const label = remainingAux[i];
          setNodeVisible(item, Boolean(label));
          if (label) {
            const labelNode = textNodes(item)[0];
            if (await setText(labelNode, label, fontConfig, "regular")) updatedCount += 1;
          }
        }
      }
      if (topCard) {
        // Component instances in this file lock internal button coordinates.
        // Keep the original component geometry and only override text/visibility.
      }
    } else {
      const mainButtonInstance = findDescendant(
      fulfillment,
      (node) => node.name === "常规按钮" && node.type === "INSTANCE"
      );
      if (state.mainButton) {
        setNodeVisible(mainButtonInstance, true);
        const mainButtonText =
          findTextByCharacters(mainButtonInstance, "联系商家安装") ||
          findTextByCharacters(mainButtonInstance, "确认安装完成") ||
          findTextByCharacters(mainButtonInstance, "联系商家") ||
          (mainButtonInstance && textNodes(mainButtonInstance)[0]);
        if (await setText(mainButtonText, state.mainButton, fontConfig, "medium")) updatedCount += 1;
      } else {
        setNodeVisible(mainButtonInstance, false);
      }

      const aux = findDescendant(fulfillment, (node) => node.name === "辅助操作");
      if (aux) {
        setNodeVisible(aux, auxButtons.length > 0);
        const opItems = sortByX(
          aux.children ? aux.children.filter((node) => node.name === "操作元素") : []
        );
        for (let i = 0; i < opItems.length; i++) {
          const item = opItems[i];
          const label = auxButtons[i];
          setNodeVisible(item, Boolean(label));
          if (label) {
            const labelNode = textNodes(item)[0];
            if (await setText(labelNode, label, fontConfig, "regular")) updatedCount += 1;
          }
        }
      }
    }
  }

  if (compensation) {
    const showCompensation = Boolean(state.compensation && state.compensation !== "隐藏");
    setNodeVisible(compensation, showCompensation);
    if (showCompensation) {
      const labelText = textNodes(compensation)[0];
      if (await setText(labelText, state.compensation, fontConfig, "regular")) updatedCount += 1;
    }
    updatedCount += 1;
  }

  if (evaluation) {
    setNodeVisible(evaluation, Boolean(state.showEvaluation));
    updatedCount += 1;
  }

  if (orderActions) {
    const bottomButtons = Array.isArray(state.bottomButtons) ? state.bottomButtons : [];
    setNodeVisible(orderActions, bottomButtons.length > 0);
    if (bottomButtons.length > 0) {
      const buttonWrap =
        findDescendant(orderActions, (node) => node.name === "按钮" && node.type === "FRAME") ||
        orderActions;
      const buttons = sortByX(
        buttonWrap.children
          ? buttonWrap.children.filter((node) => node.name === "常规按钮")
          : []
      );
      for (let i = 0; i < buttons.length; i++) {
        const button = buttons[i];
        const label = bottomButtons[i];
        setNodeVisible(button, Boolean(label));
        if (label) {
          const text = textNodes(button)[0];
          if (await setText(text, label, fontConfig, "regular")) updatedCount += 1;
        }
      }
    }
  }

  if (content && topCard && product && problem) {
    const gap = 8;
    let cursor = topCard.y + topCard.height + gap;
    if (compensation && compensation.visible) {
      compensation.x = 0;
      compensation.y = cursor;
      cursor += compensation.height + gap;
    }
    if (evaluation && evaluation.visible) {
      evaluation.x = 0;
      evaluation.y = cursor;
      cursor += evaluation.height + gap;
    }
    product.x = 0;
    product.y = cursor;
    cursor += product.height + gap;
    problem.x = 0;
    problem.y = cursor;
    content.resize(content.width, Math.max(content.height, cursor + problem.height));
  }

  return updatedCount;
}

async function expandInstallDetailStates(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const states = Array.isArray(payload.states) ? payload.states : [];
  const startIndex = Number(payload.startIndex) || 0;
  const source = await figma.getNodeByIdAsync(payload.sourceFrameId);
  if (!source || source.type !== "FRAME") {
    throw new Error(`Source frame not found: ${payload.sourceFrameId}`);
  }

  await loadFontsInSubtree(source, fontConfig);
  const page = source.parent && source.parent.type === "PAGE" ? source.parent : figma.currentPage;
  const gap = 80;
  const startX = source.x + source.width + 120;
  const variants = [];
  let updatedCount = 0;

  for (let i = 0; i < states.length; i++) {
    const state = states[i] || {};
    const clone = source.clone();
    await loadFontsInSubtree(clone, fontConfig);
    clone.name = `安装单详情 / ${state.status || i + 1}`;
    clone.x = startX + (startIndex + i) * (source.width + gap);
    clone.y = source.y;
    page.appendChild(clone);

    const label = figma.createText();
    const labelFont = resolveFont(fontConfig, "medium");
    await figma.loadFontAsync(labelFont);
    label.fontName = labelFont;
    label.fontSize = 14;
    label.characters = state.status || "";
    label.fills = [{ type: "SOLID", color: { r: 0.08, g: 0.52, b: 1 } }];
    label.textAutoResize = "WIDTH_AND_HEIGHT";
    label.x = clone.x;
    label.y = source.y - 34;
    page.appendChild(label);

    updatedCount += await applyInstallDetailState(clone, state, fontConfig);
    variants.push({ status: state.status, frameId: clone.id, labelId: label.id });
  }

  figma.viewport.scrollAndZoomIntoView(
    variants.map((item) => figma.getNodeById(item.frameId)).filter(Boolean)
  );

  return {
    id: job.id,
    ok: true,
    variants,
    updatedCount,
  };
}

async function fixInstallDetailSubtitles(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const frameIds = Array.isArray(payload.frameIds) ? payload.frameIds : [];
  let updatedCount = 0;

  await figma.loadFontAsync(resolveFont(fontConfig, "regular"));

  for (const frameId of frameIds) {
    const frame = await figma.getNodeByIdAsync(frameId);
    if (!frame || !("findOne" in frame)) continue;
    const header = frame.findOne((node) => node.name === "头部状态");
    if (!header || !("findAll" in header)) continue;
    const subtitle = header
      .findAll((node) => node.type === "TEXT" && node.characters.length > 20)
      .sort((a, b) => b.characters.length - a.characters.length)[0];
    if (!subtitle) continue;
    if (subtitle.fontName && subtitle.fontName !== figma.mixed) {
      await figma.loadFontAsync(subtitle.fontName);
    }
    subtitle.textAutoResize = "HEIGHT";
    subtitle.resize(335, subtitle.height);
    updatedCount += 1;
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
  };
}

function effectiveVisible(node, root) {
  let current = node;
  while (current) {
    if ("visible" in current && !current.visible) return false;
    if (current === root) return true;
    current = current.parent;
  }
  return true;
}

async function setInstanceTextProperty(instance, value) {
  if (!instance || instance.type !== "INSTANCE") return false;
  const props = instance.componentProperties || {};
  const textKey = Object.keys(props).find((key) => props[key] && props[key].type === "TEXT");
  if (!textKey) return false;
  instance.setProperties({ [textKey]: value || "" });
  return true;
}

async function fixGeneratedInstallDetail9778(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const items = Array.isArray(payload.items) ? payload.items : [];
  let updatedCount = 0;

  await figma.loadFontAsync(resolveFont(fontConfig, "regular"));
  await figma.loadFontAsync(resolveFont(fontConfig, "medium"));
  await figma.loadFontAsync(resolveFont(fontConfig, "semibold"));

  for (const item of items) {
    if (!item || !item.frameId) continue;
    const frame = await figma.getNodeByIdAsync(item.frameId);
    if (!frame || !("findOne" in frame)) continue;
    await loadFontsInSubtree(frame, fontConfig);

    const content = findDescendant(frame, (node) => node.name === "内容");
    const headCard = findDescendant(frame, (node) => node.name === "头部卡片");
    const address = headCard && findDescendant(headCard, (node) => node.name === "安装地址");
    const button = headCard && findDescendant(headCard, (node) => node.name === "按钮" && node.type === "INSTANCE");
    const evaluation = findDescendant(frame, (node) => node.name === "评价");
    const product = findDescendant(frame, (node) => node.name === "商品模块");
    const problem = findDescendant(frame, (node) => node.name === "遇到问题");
    const compensation = findDescendant(frame, (node) => node.name === "投诉详情");

    const auxButtons = Array.isArray(item.auxButtons) ? item.auxButtons.filter(Boolean) : [];
    if (address) {
      address.visible = item.addressVisible !== false;
      updatedCount += 1;
    }

    if (button) {
      if (auxButtons.length > 0) {
        button.setProperties({ 数量: "1个主操作+2/3个辅助操作" });
        updatedCount += 1;
      } else {
        button.setProperties({ 数量: "1个主操作" });
        updatedCount += 1;
      }

      const mainButtons = allDescendants(
        button,
        (node) => node.name === "常规按钮" && node.type === "INSTANCE"
      ).filter((node) => effectiveVisible(node, button));
      const mainButton =
        mainButtons.find((node) => Math.round(node.width) >= 300) || mainButtons[0];
      if (mainButton) {
        await setInstanceTextProperty(mainButton, item.mainButton || "");
        if (mainButton.componentProperties && mainButton.componentProperties["类型"]) {
          mainButton.setProperties({ 类型: "红色面性" });
        }
        updatedCount += 1;
      }

      const aux = findDescendant(button, (node) => node.name === "辅助操作" && node.type === "INSTANCE");
      if (aux) {
        aux.visible = auxButtons.length > 0;
        if (auxButtons.length > 0) {
          aux.setProperties({ 辅助操作: auxButtons.length > 3 ? "大于3个" : "小于3个" });
        }
        const opItems = sortByX(
          allDescendants(aux, (node) => node.name === "操作元素" && node.type === "INSTANCE").filter(
            (node) => node.parent === aux
          )
        );
        for (let i = 0; i < opItems.length; i++) {
          const op = opItems[i];
          op.visible = i < auxButtons.length;
          if (i < auxButtons.length) {
            const label = textNodes(op).find((node) => node.name === "辅助操作") || textNodes(op)[0];
            if (label) {
              await setText(label, auxButtons[i], fontConfig, "regular");
            }
          }
          updatedCount += 1;
        }
      }
    }

    if (compensation) {
      compensation.visible = Boolean(item.compensation && item.compensation !== "隐藏");
      if (compensation.visible) {
        const title = textNodes(compensation)[0];
        if (title) await setText(title, item.compensation, fontConfig, "regular");
      }
      updatedCount += 1;
    }

    if (evaluation) {
      evaluation.visible = Boolean(item.showEvaluation);
      updatedCount += 1;
    }

    if (headCard) {
      const children = headCard.children || [];
      let maxY = 0;
      for (const child of children) {
        if (child.visible) maxY = Math.max(maxY, child.y + child.height);
      }
      const bottomPadding = address && address.visible ? 21 : 33;
      headCard.resize(headCard.width, Math.round(maxY + bottomPadding));
      updatedCount += 1;
    }

    if (content && headCard && product && problem) {
      const gap = 8;
      let cursor = headCard.y + headCard.height + gap;
      if (evaluation && evaluation.visible) {
        evaluation.y = cursor;
        cursor += evaluation.height + gap;
      }
      product.y = cursor;
      cursor += product.height + gap;
      problem.y = cursor;
      cursor += problem.height + gap;
      if (compensation && compensation.visible) {
        compensation.y = cursor;
        cursor += compensation.height + gap;
      }
      content.resize(content.width, Math.max(content.height, cursor));
      updatedCount += 1;
    }
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
  };
}

function pingfangWeightForNode(node) {
  const fontName = node.fontName && node.fontName !== figma.mixed ? node.fontName : null;
  const style = fontName ? String(fontName.style || "").toLowerCase() : "";
  const name = String(node.name || "").toLowerCase();
  const size = typeof node.fontSize === "number" ? node.fontSize : 0;

  if (
    style.includes("bold") ||
    style.includes("black") ||
    style.includes("heavy") ||
    style.includes("semibold") ||
    style.includes("semi bold")
  ) {
    return "semibold";
  }
  if (style.includes("medium") || style.includes("500")) return "medium";
  if (
    name.includes("title") ||
    name.includes("标题") ||
    name.includes("label") ||
    size >= 18
  ) {
    return "semibold";
  }
  return "regular";
}

async function applyPingfangFont(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const frameIds = Array.isArray(payload.frameIds) ? payload.frameIds : [];
  const roots = [];
  let updatedCount = 0;
  let skippedCount = 0;

  if (payload.pageId) {
    const page = await figma.getNodeByIdAsync(payload.pageId);
    if (!page || page.type !== "PAGE") {
      throw new Error(`Page not found: ${payload.pageId}`);
    }
    await figma.setCurrentPageAsync(page);
  }

  await figma.loadFontAsync(resolveFont(fontConfig, "regular"));
  await figma.loadFontAsync(resolveFont(fontConfig, "medium"));
  await figma.loadFontAsync(resolveFont(fontConfig, "semibold"));

  if (frameIds.length === 0) {
    roots.push(figma.currentPage);
  } else {
    for (const frameId of frameIds) {
      const node = await figma.getNodeByIdAsync(frameId);
      if (node && (node.type === "TEXT" || "findAll" in node)) roots.push(node);
    }
  }

  if (frameIds.length > 0 && roots.length === 0) {
    throw new Error(`Target frames not found: ${frameIds.join(",")}`);
  }

  for (const root of roots) {
    for (const node of textNodes(root)) {
      try {
        const segments = node.getStyledTextSegments(["fontName"]);
        for (const segment of segments) {
          if (segment.fontName && segment.fontName !== figma.mixed) {
            try {
              await figma.loadFontAsync(segment.fontName);
            } catch (_error) {
              // Some source fonts may not exist locally. Skip loading that
              // exact font and still attempt to replace the node with PingFang.
            }
          }
        }
        if (node.fontName && node.fontName !== figma.mixed) {
          try {
            await figma.loadFontAsync(node.fontName);
          } catch (_error) {
            // See note above.
          }
        }
        const targetFont = resolveFont(fontConfig, pingfangWeightForNode(node));
        await figma.loadFontAsync(targetFont);
        node.fontName = targetFont;
        updatedCount += 1;
      } catch (_error) {
        skippedCount += 1;
      }
    }
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
    skippedCount,
  };
}

function ancestorNamePath(node, stopNode) {
  const names = [];
  let parent = node.parent;
  while (parent && parent !== stopNode) {
    names.push(parent.name || "");
    parent = parent.parent;
  }
  return names.join("/");
}

function topLevelUnderRoot(node, root) {
  let current = node;
  while (current && current.parent && current.parent !== root) current = current.parent;
  return current;
}

async function replaceRepairCopyInSolution(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const rootId = payload.rootId || "6071:100827";
  const frameIds = Array.isArray(payload.frameIds) ? payload.frameIds : [];
  const regularFont = resolveFont(fontConfig, "regular");
  const mediumFont = resolveFont(fontConfig, "medium");
  const semiboldFont = resolveFont(fontConfig, "semibold");
  const sample = [];
  let updatedCount = 0;

  if (payload.pageId) {
    const page = await figma.getNodeByIdAsync(payload.pageId);
    if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${payload.pageId}`);
    await figma.setCurrentPageAsync(page);
  }

  const root = figma.getNodeById(rootId) || await figma.getNodeByIdAsync(rootId);
  if (!root || !("findAll" in root)) throw new Error(`Root not found: ${rootId}`);

  await figma.loadFontAsync(regularFont);
  await figma.loadFontAsync(mediumFont);
  await figma.loadFontAsync(semiboldFont);

  const infoTexts = new Set([
    "维修信息",
    "维修服务",
    "维修类型",
    "维修件数",
    "维修原因",
    "维修说明",
    "维修凭证",
  ]);

  const roots = [];
  if (frameIds.length > 0) {
    for (const frameId of frameIds) {
      const frame = figma.getNodeById(frameId) || await figma.getNodeByIdAsync(frameId);
      if (frame && "findAll" in frame) roots.push(frame);
    }
  } else {
    roots.push(root);
  }

  for (const scanRoot of roots) {
  const rootIsDesignFrame =
    scanRoot !== root &&
    /^(P|N)\d{2}|增值服务详情页|申请维修|填单号|Group 213091/.test(String(scanRoot.name || ""));

  const repairTextNodes = scanRoot.findAll((node) => {
    return node.type === "TEXT" && String(node.characters || "").includes("维修");
  });

  for (const node of repairTextNodes) {
    const oldText = String(node.characters || "");
    if (!oldText.includes("维修")) continue;

    const top = rootIsDesignFrame ? scanRoot : topLevelUnderRoot(node, root);
    const topName = String((top && top.name) || "");
    const topY = top && typeof top.y === "number" ? top.y : 0;
    const path = ancestorNamePath(node, scanRoot);
    const isDesignFrame =
      rootIsDesignFrame ||
      top &&
      (top.type === "FRAME" || top.type === "GROUP" || top.type === "INSTANCE") &&
      topY >= 7200 &&
      (/^(P|N)\d{2}/.test(topName) ||
        topName.includes("增值服务详情页") ||
        topName.includes("申请维修") ||
        topName.includes("填单号") ||
        topName.includes("Group 213091"));

    if (!isDesignFrame) continue;

    const isTitleBar = path.includes("标题栏") && oldText.includes("维修详情");
    const isProgress = path.includes("整体进度") && (oldText.includes("商品维修") || oldText.includes("维修完成"));
    const isInfo = infoTexts.has(oldText);
    if (!isTitleBar && !isProgress && !isInfo) continue;

    const newText = oldText.replace(/维修/g, "服务");
    if (newText === oldText) continue;

    try {
      node.fontName = resolveFont(fontConfig, pingfangWeightForNode(node));
      node.characters = newText;
      updatedCount += 1;
      if (sample.length < 40) {
        sample.push({
          id: node.id,
          top: topName,
          area: isTitleBar ? "标题栏" : isProgress ? "进度条" : "维修信息",
          from: oldText,
          to: newText,
        });
      }
    } catch (_error) {
      // Skip locked or non-editable text overrides; the summary will show the
      // successfully changed nodes.
    }
  }
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
    sample,
  };
}

function replacementForRepairServiceCopy(oldText) {
  const exact = new Map([
    ["维修信息", "服务信息"],
    ["维修服务", "服务"],
    ["维修类型", "服务类型"],
    ["维修件数", "服务件数"],
    ["维修原因", "服务原因"],
    ["维修说明", "服务说明"],
    ["维修凭证", "服务凭证"],
    ["服务服务", "服务"],
  ]);
  if (exact.has(oldText)) return exact.get(oldText);
  let nextText = oldText
    .replace(/维修服务/g, "服务")
    .replace(/服务服务/g, "服务")
    .replace(/维修详情/g, "服务详情");
  if (nextText === "商品维修") nextText = "商品服务";
  if (nextText === "维修完成") nextText = "服务完成";
  if (nextText.includes("->") || nextText.includes("·")) {
    nextText = nextText.replace(/商品维修/g, "商品服务").replace(/维修完成/g, "服务完成");
  }
  return nextText;
}

async function fixRepairServiceCopyAndWeights(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const rootId = payload.rootId || "6071:100827";
  const frameIds = Array.isArray(payload.frameIds) ? payload.frameIds : [];
  const regularFont = resolveFont(fontConfig, "regular");
  const roots = [];
  const infoLabelTexts = new Set([
    "服务信息",
    "服务",
    "服务类型",
    "服务件数",
    "服务原因",
    "服务说明",
    "服务凭证",
  ]);
  const sample = [];
  let copyUpdatedCount = 0;
  let regularUpdatedCount = 0;

  if (payload.pageId) {
    const page = await figma.getNodeByIdAsync(payload.pageId);
    if (!page || page.type !== "PAGE") throw new Error(`Page not found: ${payload.pageId}`);
    await figma.setCurrentPageAsync(page);
  }

  if (frameIds.length > 0) {
    for (const frameId of frameIds) {
      const frame = figma.getNodeById(frameId) || await figma.getNodeByIdAsync(frameId);
      if (frame && "findAll" in frame) roots.push(frame);
    }
  } else {
    const root = figma.getNodeById(rootId) || await figma.getNodeByIdAsync(rootId);
    if (!root || !("findAll" in root)) throw new Error(`Root not found: ${rootId}`);
    roots.push(root);
  }

  await figma.loadFontAsync(regularFont);
  for (const scanRoot of roots) {
    const nodes = textNodes(scanRoot);
    for (const node of nodes) {
      const oldText = String(node.characters || "");
      const newText =
        oldText === "服务服务" || oldText.includes("维修服务")
          ? oldText.replace(/维修服务/g, "服务").replace(/服务服务/g, "服务")
          : replacementForRepairServiceCopy(oldText);
      if (newText !== oldText) {
        try {
          if (
            oldText === "服务服务" ||
            oldText.includes("维修服务") ||
            infoLabelTexts.has(newText)
          ) {
            node.fontName = regularFont;
          }
          node.characters = newText;
          copyUpdatedCount += 1;
          if (sample.length < 60) {
            sample.push({ id: node.id, from: oldText, to: newText, kind: "copy" });
          }
        } catch (_error) {
          // Keep batch resilient for instance overrides.
        }
      }

      const currentText = String(node.characters || "");
      const fontSize = typeof node.fontSize === "number" ? node.fontSize : 0;
      if (infoLabelTexts.has(currentText) && node.name === "标题" && fontSize <= 16.5) {
        try {
          node.fontName = regularFont;
          regularUpdatedCount += 1;
          if (sample.length < 60) {
            sample.push({ id: node.id, text: currentText, kind: "regular" });
          }
        } catch (_error) {
          // Keep batch resilient for instance overrides.
        }
      }
    }
  }

  return {
    id: job.id,
    ok: true,
    copyUpdatedCount,
    regularUpdatedCount,
    sample,
  };
}

async function fixExactTextNodes(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const items = Array.isArray(payload.items) ? payload.items : [];
  const regularFont = resolveFont(fontConfig, "regular");
  const sample = [];
  let updatedCount = 0;

  await figma.loadFontAsync(regularFont);
  for (const item of items) {
    const node = figma.getNodeById(item.id) || await figma.getNodeByIdAsync(item.id);
    if (!node || node.type !== "TEXT") continue;
    try {
      node.fontName = regularFont;
      if (typeof item.text === "string") node.characters = item.text;
      updatedCount += 1;
      if (sample.length < 80) {
        sample.push({ id: item.id, text: node.characters });
      }
    } catch (_error) {
      // Keep batch resilient for instance overrides.
    }
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
    sample,
  };
}

function splitCellList(value) {
  return String(value || "")
    .split(/[、；;，,\n]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function findTexts(root, predicate) {
  return textNodes(root).filter(predicate);
}

async function applyServiceDetailRows(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const dryRun = Boolean(payload.dryRun);
  const regularFont = resolveFont(fontConfig, "regular");
  const mediumFont = resolveFont(fontConfig, "medium");
  const semiboldFont = resolveFont(fontConfig, "semibold");
  const sample = [];
  const diffs = [];
  const missingFrames = [];
  let updatedCount = 0;

  await figma.loadFontAsync(regularFont);
  await figma.loadFontAsync(mediumFont);
  await figma.loadFontAsync(semiboldFont);

  function setNodeText(node, text, fontName) {
    if (!node || node.type !== "TEXT" || typeof text !== "string" || text === "") return false;
    try {
      if (node.characters !== text) {
        diffs.push({ id: node.id, from: node.characters, to: text });
        if (!dryRun) {
          if (fontName) node.fontName = fontName;
          node.characters = text;
          updatedCount += 1;
          if (sample.length < 80) sample.push({ id: node.id, text });
        }
      }
      if (!dryRun) node.visible = true;
      return true;
    } catch (_error) {
      return false;
    }
  }

  function isVisibleNode(node, stopNode) {
    let current = node;
    while (current && current !== stopNode) {
      if ("visible" in current && !current.visible) return false;
      current = current.parent;
    }
    return true;
  }

  for (const row of rows) {
    const frame = figma.getNodeById(row.frameId) || await figma.getNodeByIdAsync(row.frameId);
    if (!frame || !("findAll" in frame)) {
      missingFrames.push({ code: row.code, frameId: row.frameId });
      continue;
    }

    const allTexts = textNodes(frame);

    for (const title of allTexts.filter((node) => ["维修详情", "服务详情"].includes(node.characters))) {
      setNodeText(title, row.pageTitle || "服务详情", mediumFont);
    }

    const progressLabels = row.progress && row.progress !== "无" ? splitCellList(row.progress.replace(/→/g, "、")) : [];
    const progressInstances = frame.findAll((node) => node.type === "INSTANCE" && node.name === "整体进度");
    for (const progress of progressInstances) {
      progress.visible = progressLabels.length > 0;
      if (progressLabels.length === 0) continue;
      const labels = progress
        .findAll((node) => node.type === "TEXT" && typeof node.fontSize === "number" && node.fontSize <= 11.5)
        .filter((node) => isVisibleNode(node, progress))
        .sort((a, b) => {
          const ax = a.absoluteBoundingBox ? a.absoluteBoundingBox.x : a.x;
          const bx = b.absoluteBoundingBox ? b.absoluteBoundingBox.x : b.x;
          return ax - bx;
        });
      const usedX = new Set();
      let labelIndex = 0;
      for (const label of labels) {
        const x = Math.round(label.absoluteBoundingBox ? label.absoluteBoundingBox.x : label.x);
        if (usedX.has(x)) {
          if (!dryRun) label.visible = false;
          continue;
        }
        usedX.add(x);
        if (labelIndex < progressLabels.length) {
          if (!dryRun) label.visible = true;
          setNodeText(label, progressLabels[labelIndex], regularFont);
          labelIndex += 1;
        } else {
          if (!dryRun) label.visible = false;
        }
      }
    }

    const statusTitle = allTexts.find((node) => node.name === "主文本" && typeof node.fontSize === "number" && node.fontSize >= 23 && node.fontSize <= 25);
    setNodeText(statusTitle, row.mainStatus, semiboldFont);
    const statusSub = allTexts.find((node) => node.name === "辅助信息");
    setNodeText(statusSub, row.subtitle, regularFont);

    const floorTitles = splitCellList(row.floors);
    const serviceTitleNodes = allTexts.filter((node) => node.name === "标题" && node.characters === "服务信息");
    for (const node of serviceTitleNodes) setNodeText(node, "服务信息", regularFont);

    for (const floor of floorTitles) {
      if (floor.includes("商品寄件信息")) {
        const node = allTexts.find((n) => n.characters === "商品寄件信息" || n.characters === "我的寄件信息");
        setNodeText(node, "商品寄件信息", regularFont);
      }
      if (floor.includes("我的收货地址")) {
        const node = allTexts.find((n) => n.characters === "我的收货地址");
        setNodeText(node, "我的收货地址", regularFont);
      }
      if (floor.includes("填写单号")) {
        const node = allTexts.find((n) => n.characters === "填写单号");
        setNodeText(node, "填写单号", mediumFont);
      }
    }

    const serviceFields = splitCellList(row.serviceFields);
    const serviceLabelNodes = allTexts
      .filter((node) => {
        const size = typeof node.fontSize === "number" ? node.fontSize : 0;
        const path = ancestorNamePath(node, frame);
        return node.name === "标题" && size <= 13.5 && path.includes("服务信息") && isVisibleNode(node, frame);
      })
      .sort((a, b) => {
        const ay = a.absoluteBoundingBox ? a.absoluteBoundingBox.y : a.y;
        const by = b.absoluteBoundingBox ? b.absoluteBoundingBox.y : b.y;
        return ay - by;
      });
    for (let index = 0; index < Math.min(serviceFields.length, serviceLabelNodes.length); index += 1) {
      setNodeText(serviceLabelNodes[index], serviceFields[index], regularFont);
    }

    const buttons = splitCellList(row.buttons);
    for (const buttonText of buttons) {
      let node = allTexts.find((n) => n.characters === buttonText);
      if (!node && buttonText === "重新申请") {
        node = allTexts.find((n) => n.characters === "再次申请维修" || n.characters === "申请服务" || n.characters === "重新申请");
      }
      if (!node && buttonText === "再次申请维修") {
        node = allTexts.find((n) => n.characters === "重新申请" || n.characters === "申请服务" || n.characters === "再次申请维修");
      }
      if (!node && buttonText === "取消申请") {
        node = allTexts.find((n) => n.characters === "取消寄件" || n.characters === "取消申请");
      }
      if (node) setNodeText(node, buttonText, node.fontSize >= 14 ? mediumFont : regularFont);
    }
  }

  return {
    id: job.id,
    ok: true,
    dryRun,
    updatedCount,
    diffCount: diffs.length,
    diffs: diffs.slice(0, 200),
    missingFrames,
    sample,
  };
}

async function fixBottomActionsAndServiceTitles(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const rows = Array.isArray(payload.rows) ? payload.rows : [];
  const regularFont = resolveFont(fontConfig, "regular");
  const mediumFont = resolveFont(fontConfig, "medium");
  const sample = [];
  const missingFrames = [];
  let updatedCount = 0;

  await figma.loadFontAsync(regularFont);
  await figma.loadFontAsync(mediumFont);

  function setVisibleToFrame(node, frame, visible) {
    let current = node;
    while (current && current !== frame) {
      if ("visible" in current) current.visible = visible;
      current = current.parent;
    }
  }

  function setText(node, text, fontName) {
    if (!node || node.type !== "TEXT") return false;
    try {
      if (fontName) node.fontName = fontName;
      if (typeof text === "string" && node.characters !== text) node.characters = text;
      updatedCount += 1;
      if (sample.length < 80) sample.push({ id: node.id, text: node.characters });
      return true;
    } catch (_error) {
      return false;
    }
  }

  function bottomTextNodes(frame) {
    const box = frame.absoluteBoundingBox || { y: frame.y || 0, height: frame.height || 0 };
    return textNodes(frame).filter((node) => {
      const nodeBox = node.absoluteBoundingBox;
      if (!nodeBox) return false;
      const path = ancestorNamePath(node, frame);
      return nodeBox.y > box.y + box.height - 150 && (path.includes("底bar") || path.includes("操作栏"));
    });
  }

  for (const row of rows) {
    const frame = figma.getNodeById(row.frameId) || await figma.getNodeByIdAsync(row.frameId);
    if (!frame || !("findAll" in frame)) {
      missingFrames.push({ code: row.code, frameId: row.frameId });
      continue;
    }

    for (const title of textNodes(frame).filter((node) => {
      const size = typeof node.fontSize === "number" ? node.fontSize : 0;
      return node.name === "标题" && node.characters === "服务信息" && size >= 15.5 && size <= 16.5;
    })) {
      setText(title, "服务信息", regularFont);
    }

    const actions = splitCellList(row.buttons);
    const bottomTexts = bottomTextNodes(frame);
    const bottomRoots = new Set();
    for (const node of bottomTexts) {
      let current = node.parent;
      while (current && current !== frame) {
        const name = String(current.name || "");
        if (name.includes("5_按钮") || name.includes("常规按钮") || name.includes("36尺寸按钮") || name.includes("Button")) {
          bottomRoots.add(current);
          break;
        }
        current = current.parent;
      }
    }
    for (const root of bottomRoots) {
      if ("visible" in root) root.visible = false;
    }

    if (actions.length === 0 || actions.includes("无")) {
      for (const node of frame.findAll((item) => String(item.name || "").includes("底bar") || String(item.name || "").includes("操作栏"))) {
        if ("visible" in node) node.visible = false;
      }
      continue;
    }

    const available = bottomTextNodes(frame);
    for (const action of actions) {
      let node = available.find((item) => item.characters === action);
      if (!node && action === "再次申请维修") node = available.find((item) => item.characters === "再次申请" || item.characters === "申请服务");
      if (!node && action === "重新申请") node = available.find((item) => item.characters === "再次申请" || item.characters === "申请服务" || item.characters === "重新申请");
      if (!node && action === "取消申请") node = available.find((item) => item.characters === "取消寄件" || item.characters === "取消申请");
      if (!node && action === "规则详情") node = available.find((item) => item.characters === "规则详情" || item.characters === "更多");
      if (!node && action === "申请开票") node = available.find((item) => item.characters === "申请开票");
      if (!node) continue;

      setVisibleToFrame(node, frame, true);
      setText(node, action, action === actions[actions.length - 1] ? mediumFont : regularFont);
    }
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
    missingFrames,
    sample,
  };
}

async function setSmallLeftTitlesFont(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const frameIds = Array.isArray(payload.frameIds) ? payload.frameIds : [];
  const roots = [];
  const targetFont = resolveFont(fontConfig, payload.weight || "regular");
  const sample = [];
  let updatedCount = 0;

  if (payload.pageId) {
    const page = await figma.getNodeByIdAsync(payload.pageId);
    if (!page || page.type !== "PAGE") {
      throw new Error(`Page not found: ${payload.pageId}`);
    }
    await figma.setCurrentPageAsync(page);
  }

  await figma.loadFontAsync(targetFont);

  if (frameIds.length === 0) {
    roots.push(figma.currentPage);
  } else {
    for (const frameId of frameIds) {
      const node = await figma.getNodeByIdAsync(frameId);
      if (node && (node.type === "TEXT" || "findAll" in node)) roots.push(node);
    }
  }

  if (frameIds.length > 0 && roots.length === 0) {
    throw new Error(`Target frames not found: ${frameIds.join(",")}`);
  }

  for (const root of roots) {
    for (const node of textNodes(root)) {
      const fontSize = typeof node.fontSize === "number" ? node.fontSize : 0;
      const text = String(node.characters || "").trim();
      if (node.name !== "标题" || fontSize > 13.5 || !text) continue;

      try {
        node.fontName = targetFont;
        updatedCount += 1;
        if (sample.length < 20) {
          sample.push({
            id: node.id,
            text,
            fontSize,
          });
        }
      } catch (_error) {
        // Keep the operation resilient for nested instances or locked text.
      }
    }
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
    sample,
  };
}

function absoluteX(node) {
  return node.absoluteTransform ? node.absoluteTransform[0][2] : node.x || 0;
}

async function fixNoReturnProgress(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  const frameIds = Array.isArray(payload.frameIds) ? payload.frameIds : [];
  const labels = ["服务商处理", "寄出新品", "服务完成"];
  const variantByFrame = {
    "N01 等待服务商处理": "三分之一",
    "N02 审核通过待新品寄出": "三分之二",
    "N03 商品寄回中": "三分之二",
    "N04 服务已完成": "三分之三",
    "N05 用户主动撤销关闭": "三分之一",
    "N06 服务商驳回关闭": "三分之一",
  };
  const regularFont = resolveFont(fontConfig, "regular");
  const roots = [];
  const sample = [];
  let updatedCount = 0;
  let removedCount = 0;

  if (payload.pageId) {
    const page = await figma.getNodeByIdAsync(payload.pageId);
    if (!page || page.type !== "PAGE") {
      throw new Error(`Page not found: ${payload.pageId}`);
    }
    await figma.setCurrentPageAsync(page);
  }

  await figma.loadFontAsync(regularFont);

  if (frameIds.length === 0) {
    roots.push(figma.currentPage);
  } else {
    for (const frameId of frameIds) {
      const node = await figma.getNodeByIdAsync(frameId);
      if (node && "findAll" in node) roots.push(node);
    }
  }

  for (const root of roots) {
    const frames =
      root.type === "FRAME" && variantByFrame[root.name]
        ? [root]
        : root.findAll((node) => node.type === "FRAME" && Boolean(variantByFrame[node.name]));

    for (const frame of frames) {
      for (const child of [...frame.children]) {
        if (child.name === "无需寄回三节点进度") {
          child.remove();
          removedCount += 1;
        }
      }

      const body = frame.children.find((node) => node.type === "FRAME" && node.name === "Frame");
      const progress =
        body &&
        body.children.find((node) => node.type === "INSTANCE" && node.name === "整体进度");
      if (!progress) continue;

      progress.visible = true;
      if (typeof progress.resetOverrides === "function") {
        progress.resetOverrides();
      }
      progress.setProperties({ "整体进度": variantByFrame[frame.name] });

      const texts = progress
        .findAll((node) => node.type === "TEXT")
        .filter((node) => typeof node.fontSize === "number" && node.fontSize <= 11.5)
        .sort((a, b) => absoluteX(a) - absoluteX(b));

      for (let index = 0; index < texts.length; index += 1) {
        const textNode = texts[index];
        textNode.visible = index < labels.length;
        if (index < labels.length) {
          textNode.fontName = regularFont;
          textNode.characters = labels[index];
        }
      }

      updatedCount += 1;
      if (sample.length < 10) {
        sample.push({
          frame: frame.name,
          progressId: progress.id,
          variant: variantByFrame[frame.name],
          textCount: texts.length,
        });
      }
    }
  }

  return {
    id: job.id,
    ok: true,
    updatedCount,
    removedCount,
    sample,
  };
}

async function debugCurrentPage(job) {
  const children = figma.currentPage.children.map((node) => ({
    id: node.id,
    name: node.name,
    type: node.type,
    x: Math.round(node.x),
    y: Math.round(node.y),
    width: Math.round(node.width || 0),
    height: Math.round(node.height || 0),
  }));

  return {
    id: job.id,
    ok: true,
    pageId: figma.currentPage.id,
    pageName: figma.currentPage.name,
    pages: figma.root.children.map((page) => ({
      id: page.id,
      name: page.name,
    })),
    childCount: children.length,
    children: children.slice(0, 80),
  };
}

async function setCurrentPage(job) {
  const pageId = job.payload && job.payload.pageId;
  const page = pageId ? await figma.getNodeByIdAsync(pageId) : null;
  if (!page || page.type !== "PAGE") {
    throw new Error(`Page not found: ${pageId}`);
  }
  await figma.setCurrentPageAsync(page);
  return {
    id: job.id,
    ok: true,
    pageId: figma.currentPage.id,
    pageName: figma.currentPage.name,
  };
}

async function organizeRepairStateComponents(job) {
  const payload = job.payload || {};
  const fontConfig = payload.font || defaultFont;
  await figma.loadFontAsync(resolveFont(fontConfig, "regular"));
  await figma.loadFontAsync(resolveFont(fontConfig, "medium"));
  await figma.loadFontAsync(resolveFont(fontConfig, "semibold"));

  if (payload.pageId) {
    const page = await figma.getNodeByIdAsync(payload.pageId);
    if (page && page.type === "PAGE") await figma.setCurrentPageAsync(page);
  }

  const root = await figma.getNodeByIdAsync(payload.rootId || "6535:9904");
  if (!root || !("children" in root)) {
    throw new Error(`Root frame not found or has no children: ${payload.rootId || "6535:9904"}`);
  }

  const sourcePages = root.children
    .filter((node) => node.type === "FRAME" && /^P\d+/.test(node.name))
    .sort((a, b) => a.x - b.x);
  if (sourcePages.length < 2) {
    throw new Error("Need at least two source page frames to organize state components.");
  }

  const page = root.parent && root.parent.type === "PAGE" ? root.parent : figma.currentPage;
  const generatedNames = new Set([
    "状态拓展母组件区",
    "页面母组件/服务详情/状态",
    "页面装配规则（不组件化整页）",
    "模块母组件/售后状态卡/状态",
    "模块母组件/整体进度/当前状态",
    "模块母组件/底部操作栏/按钮数",
    "卡片组母组件/服务详情内容区-全量卡片",
    "内容模块/服务信息+遇到问题",
    "内容模块/商品寄件信息",
    "内容模块/物流卡",
    "状态拓展映射表（产品补充初稿）",
    "组件能力缺口提醒",
  ]);
  page.children
    .filter((node) => generatedNames.has(node.name))
    .forEach((node) => node.remove());

  function makeText(text, size = 14, weight = "regular", color = { r: 0.086, g: 0.094, b: 0.137 }) {
    const node = figma.createText();
    const fontName = resolveFont(fontConfig, weight);
    node.fontName = fontName;
    node.fontSize = size;
    node.characters = text;
    node.fills = [{ type: "SOLID", color }];
    node.lineHeight = { unit: "PIXELS", value: Math.round(size * 1.45) };
    return node;
  }

  function makeSection(name, x, y, width, height) {
    const frame = figma.createFrame();
    frame.name = name;
    frame.x = x;
    frame.y = y;
    frame.resize(width, height);
    frame.fills = [{ type: "SOLID", color: { r: 0.961, g: 0.965, b: 0.976 } }];
    frame.cornerRadius = 16;
    frame.clipsContent = false;
    page.appendChild(frame);
    return frame;
  }

  function addTextTo(parent, text, x, y, size = 14, weight = "regular", color) {
    const node = makeText(text, size, weight, color);
    parent.appendChild(node);
    node.x = x;
    node.y = y;
    return node;
  }

  function findChildByName(parent, name) {
    if (!parent || !("children" in parent)) return null;
    return parent.children.find((node) => node.name === name) || null;
  }

  function findDesc(parent, predicate) {
    if (!parent || !("findAll" in parent)) return null;
    return parent.findAll(predicate)[0] || null;
  }

  function statusLabel(pageFrame) {
    return pageFrame.name.replace(/^P\d+\s*/, "");
  }

  function cloneAsComponent(source, name, x, y) {
    if (!source) return null;
    let clone = source.clone();
    page.appendChild(clone);
    if (clone.type === "INSTANCE") {
      clone = clone.detachInstance();
      page.appendChild(clone);
    }
    clone.x = x;
    clone.y = y;
    let component;
    if (clone.type === "COMPONENT") {
      component = clone;
    } else {
      component = figma.createComponentFromNode(clone);
    }
    component.name = name;
    component.x = x;
    component.y = y;
    return component;
  }

  function componentizeVariants(items, setName, x, y, gap = 24) {
    const components = [];
    let cursorX = x;
    for (const item of items) {
      const component = cloneAsComponent(item.source, item.name, cursorX, y);
      if (!component) continue;
      components.push(component);
      cursorX += component.width + gap;
    }
    if (components.length < 2) return components[0] || null;
    const set = figma.combineAsVariants(components, page);
    set.name = setName;
    set.x = x;
    set.y = y;
    return set;
  }

  const startX = root.x + root.width + 80;
  const startY = root.y;
  const board = makeSection("状态拓展母组件区", startX, startY, 1900, 1760);
  addTextTo(board, "状态拓展母组件区", 32, 28, 24, "semibold");
  addTextTo(
    board,
    "基于当前 3 个服务详情页整理：把已有卡片合成一个全量内容区母组件。后续状态只控制卡片显示/隐藏，不自创缺失组件。",
    32,
    66,
    14,
    "regular",
    { r: 0.086, g: 0.094, b: 0.137 }
  );

  const created = [];

  const assembly = figma.createFrame();
  assembly.name = "页面装配规则（不组件化整页）";
  assembly.x = startX + 32;
  assembly.y = startY + 132;
  assembly.resize(820, 320);
  assembly.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  assembly.cornerRadius = 12;
  page.appendChild(assembly);
  addTextTo(assembly, "页面装配规则（不组件化整页）", 20, 18, 18, "semibold");
  addTextTo(
    assembly,
    "这 3 张页面建议不要直接做整页母组件：整页嵌套组件较重，后续状态差异会集中在模块。页面拓展时按下方模块母组件装配：标题栏 + 整体进度 + 售后状态卡 + 内容模块组 + 底部操作栏。",
    20,
    52,
    13,
    "regular",
    { r: 0.35, g: 0.36, b: 0.4 }
  ).resize(760, 64);
  const assemblyRows = [
    "P01 等待服务商处理：基础内容模块 + 3 按钮底栏",
    "P02 等待商品寄出：商品寄件信息 + 基础内容模块 + 3 按钮底栏",
    "P03 商品已寄出：物流卡 + 基础内容模块 + 2 按钮底栏",
    "新增状态：先在映射表选择模块组合；如果没有对应模块/按钮数/进度节点，标红请设计师补组件。",
  ];
  assemblyRows.forEach((line, index) => {
    addTextTo(assembly, line, 20, 132 + index * 34, 14, "regular");
  });
  created.push({ role: "页面级装配说明", id: assembly.id, name: assembly.name });

  const commonCard = findDesc(sourcePages[0], (node) => node.name === "卡片组" && node.type === "INSTANCE");
  const sendInfo = findDesc(sourcePages[1], (node) => node.name === "我的寄件信息" && node.type === "FRAME");
  const logistics = findDesc(sourcePages[2], (node) => node.name === "物流卡" && node.type === "INSTANCE");

  const allCards = figma.createComponent();
  allCards.name = "卡片组母组件/服务详情内容区-全量卡片";
  allCards.x = startX + 32;
  allCards.y = startY + 500;
  allCards.resize(359, 700);
  allCards.fills = [];
  allCards.layoutMode = "VERTICAL";
  allCards.primaryAxisSizingMode = "AUTO";
  allCards.counterAxisSizingMode = "FIXED";
  allCards.itemSpacing = 8;
  allCards.paddingTop = 0;
  allCards.paddingRight = 0;
  allCards.paddingBottom = 0;
  allCards.paddingLeft = 0;
  page.appendChild(allCards);

  function appendCard(source, name) {
    if (!source) return null;
    const clone = source.clone();
    allCards.appendChild(clone);
    clone.name = name;
    clone.visible = true;
    if ("layoutSizingHorizontal" in clone) clone.layoutSizingHorizontal = "FIXED";
    return clone;
  }

  appendCard(sendInfo, "状态控制/商品寄件信息（按状态显示隐藏）");
  appendCard(logistics, "状态控制/物流卡（按状态显示隐藏）");
  appendCard(commonCard, "状态控制/服务信息+遇到问题（常驻，可按状态隐藏）");
  created.push({ role: "卡片组母组件", id: allCards.id, name: allCards.name });

  addTextTo(board, "卡片组母组件", 430, 500, 18, "semibold");
  addTextTo(
    board,
    "把 3 张样例里的卡片合并到一个内容区：商品寄件信息、物流卡、服务信息+遇到问题。状态拓展时只切 visible，不新增卡片。",
    430,
    532,
    13,
    "regular",
    { r: 0.35, g: 0.36, b: 0.4 }
  ).resize(500, 56);

  const table = figma.createFrame();
  table.name = "状态拓展映射表（产品补充初稿）";
  table.x = startX + 1010;
  table.y = startY + 1010;
  table.resize(820, 560);
  table.fills = [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }];
  table.cornerRadius = 12;
  table.clipsContent = false;
  page.appendChild(table);
  addTextTo(table, "状态拓展映射表（产品补充初稿）", 20, 18, 18, "semibold");
  addTextTo(
    table,
    "表头根据当前设计稿结构生成：当前核心变量是状态文案、进度节点、卡片显示/隐藏、底部按钮。",
    20,
    50,
    13,
    "regular",
    { r: 0.35, g: 0.36, b: 0.4 }
  );
  const rows = [
    ["状态/场景", "是否单独出图", "页面标题", "状态标题", "状态说明", "当前进度节点", "商品寄件信息", "物流卡", "服务信息/遇到问题", "底部按钮", "备注"],
    ["等待服务商处理", "是", "服务详情", "等待服务商处理", "您已提交服务申请，请耐心等待服务商处理", "服务商处理", "隐藏", "隐藏", "展示", "申请开票、规则详情、取消申请", "已有样例"],
    ["等待商品寄出", "是", "服务详情", "等待商品寄出", "您提交的服务申请已通过，请尽快寄出商品", "寄回商品", "展示", "隐藏", "展示", "申请开票、规则详情、取消申请", "已有样例"],
    ["商品已寄出", "是", "服务详情", "商品已寄出", "快递员已揽收您的商品，发往服务商网点中", "寄回商品", "隐藏", "展示", "展示", "规则详情、申请开票", "已有样例"],
    ["待补状态", "待产品补", "服务详情", "待产品补", "待产品补", "待产品补", "展示/隐藏", "展示/隐藏", "展示/隐藏", "从已有按钮数组合中选", "没有的卡片/按钮数先标红"],
  ];
  const colWidths = [70, 66, 62, 92, 146, 76, 70, 54, 96, 104, 80];
  let y = 92;
  for (let r = 0; r < rows.length; r += 1) {
    let x = 20;
    const rowHeight = r === 0 ? 34 : 64;
    for (let c = 0; c < rows[r].length; c += 1) {
      const cell = figma.createFrame();
      cell.name = `cell-${r}-${c}`;
      cell.x = x;
      cell.y = y;
      cell.resize(colWidths[c], rowHeight);
      cell.fills = [{ type: "SOLID", color: r === 0 ? { r: 0.961, g: 0.965, b: 0.976 } : { r: 1, g: 1, b: 1 } }];
      cell.strokes = [{ type: "SOLID", color: { r: 0.9, g: 0.91, b: 0.93 } }];
      cell.strokeWeight = 1;
      table.appendChild(cell);
      const text = addTextTo(cell, rows[r][c], 6, 7, r === 0 ? 11 : 10, r === 0 ? "semibold" : "regular", r === 0 ? { r: 0.086, g: 0.094, b: 0.137 } : { r: 0.28, g: 0.29, b: 0.32 });
      text.resize(Math.max(10, colWidths[c] - 12), rowHeight - 12);
      text.textAutoResize = "HEIGHT";
      x += colWidths[c];
    }
    y += rowHeight;
  }

  const gapFrame = figma.createFrame();
  gapFrame.name = "组件能力缺口提醒";
  gapFrame.x = startX + 1010;
  gapFrame.y = startY + 1590;
  gapFrame.resize(820, 120);
  gapFrame.fills = [{ type: "SOLID", color: { r: 1, g: 0.953, b: 0.94 } }];
  gapFrame.cornerRadius = 12;
  page.appendChild(gapFrame);
  addTextTo(gapFrame, "组件能力缺口提醒", 20, 16, 16, "semibold", { r: 0.84, g: 0, b: 0.196 });
  addTextTo(
    gapFrame,
    "当前内容区母组件只包含：商品寄件信息、物流卡、服务信息+遇到问题。后续若状态需要新卡片、新按钮数或不同进度结构，先标红阻断，请设计师补组件或指定复用基准。",
    20,
    46,
    13,
    "regular",
    { r: 0.3, g: 0.16, b: 0.12 }
  ).resize(760, 60);

  figma.viewport.scrollAndZoomIntoView([board, assembly || root]);
  return {
    id: job.id,
    ok: true,
    createdCount: created.length + 3,
    created,
    gaps: [
      "内容区当前只支持商品寄件信息、物流卡、服务信息+遇到问题三类卡片显示/隐藏。",
      "仅支持当前样例中的 2/3 按钮底栏；更多按钮需补组件。",
      "新增卡片楼层需先提供设计稿样例，不能自动创造。",
    ],
  };
}

figma.ui.onmessage = async (job) => {
  if (!job || !job.type) return;

  try {
    if (job.type === "probeFont") {
      const payload = job.payload || {};
      const fontConfig = payload.font || defaultFont;
      await figma.loadFontAsync(resolveFont(fontConfig, "regular"));
      await figma.loadFontAsync(resolveFont(fontConfig, "medium"));
      figma.ui.postMessage({
        id: job.id,
        ok: true,
        probe: true,
        pluginVersion: bridgePluginVersion,
        capabilities: bridgePluginCapabilities,
        fontFamily: fontConfig.fontFamily || defaultFont.fontFamily,
      });
      return;
    }

    if (job.type === "replaceText") {
      const result = await replaceText(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "replaceIndustryStatus") {
      const result = await replaceIndustryStatus(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "expandInstallDetailStates") {
      const result = await expandInstallDetailStates(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "fixInstallDetailSubtitles") {
      const result = await fixInstallDetailSubtitles(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "fixGeneratedInstallDetail9778") {
      const result = await fixGeneratedInstallDetail9778(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "applyPingfangFont") {
      const result = await applyPingfangFont(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "replaceRepairCopyInSolution") {
      const result = await replaceRepairCopyInSolution(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "fixRepairServiceCopyAndWeights") {
      const result = await fixRepairServiceCopyAndWeights(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "fixExactTextNodes") {
      const result = await fixExactTextNodes(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "applyServiceDetailRows") {
      const result = await applyServiceDetailRows(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "fixBottomActionsAndServiceTitles") {
      const result = await fixBottomActionsAndServiceTitles(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "setSmallLeftTitlesFont" || job.type === "setSmallLeftTitlesMedium") {
      const result = await setSmallLeftTitlesFont(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "fixNoReturnProgress") {
      const result = await fixNoReturnProgress(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "debugCurrentPage") {
      const result = await debugCurrentPage(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "setCurrentPage") {
      const result = await setCurrentPage(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type === "organizeRepairStateComponents") {
      const result = await organizeRepairStateComponents(job);
      figma.ui.postMessage(result);
      return;
    }

    if (job.type !== "renderDesign") return;

    const result = await renderDesign(job);
    figma.ui.postMessage(result);
  } catch (error) {
    figma.ui.postMessage({
      id: job.id,
      ok: false,
      error: (error && error.message) || String(error),
    });
  }
};
