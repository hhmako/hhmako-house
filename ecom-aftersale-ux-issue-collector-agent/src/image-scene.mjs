import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const tesseract = require("tesseract.js");

const DEFAULT_IN_SCOPE_TERMS = [
  "商详", "商品详情", "详情页", "购物车", "进购物车", "加购物车", "加入购物车", "加购",
  "sku", "SKU", "规格", "选择规格", "提单", "确认订单", "提交订单", "去结算",
  "结算页", "立即购买", "不可配送", "配送至", "领券", "券后", "领取优惠券",
];

export async function analyzeImageScene(files, textHints = [], sceneConfig = {}) {
  const texts = [...textHints];
  for (const file of files) {
    try {
      const result = await tesseract.recognize(file, "chi_sim", {
        langPath: process.cwd(),
        logger: () => {},
      });
      texts.push(result.data.text || "");
    } catch {
      texts.push("");
    }
  }
  const text = texts.join("\n").replace(/\s+/g, "");
  const inScopePattern = buildPattern(sceneConfig.imageTerms || sceneConfig.scopeTerms || DEFAULT_IN_SCOPE_TERMS);
  return {
    text,
    inScope: inScopePattern.test(text),
  };
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
