import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const sharp = require("sharp");

const url = getArg("url");
const channel = getArg("channel") || "xiaohongshu";
const profilesDir = getArg("profiles-dir") || path.resolve(".agent-profiles");
const output = getArg("output");
const mode = getArg("mode") || "largest-image";
const outputDir = getArg("output-dir");

if (!url || (!output && !outputDir)) {
  throw new Error("Usage: capture-url.mjs --url <url> --output <png> | --output-dir <dir> [--channel xiaohongshu|weibo]");
}

if (output) fs.mkdirSync(path.dirname(output), { recursive: true });
if (outputDir) fs.mkdirSync(outputDir, { recursive: true });

const context = await chromium.launchPersistentContext(path.join(profilesDir, channel), {
  executablePath: "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  headless: true,
  viewport: { width: 1280, height: 1600 },
});

try {
  const page = context.pages()[0] || await context.newPage();
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForTimeout(5000);
  if (mode === "post-images") {
    const files = await screenshotPostImages(page, outputDir);
    console.log(JSON.stringify({ ok: true, files, mode: "post-images" }));
    await context.close();
    process.exit(0);
  }
  const captured = mode === "largest-image"
    ? await screenshotLargestImage(page, output)
    : false;
  if (!captured) {
    await page.screenshot({ path: output, fullPage: true });
  }
  console.log(JSON.stringify({ ok: true, output, mode: captured ? "largest-image" : "full-page" }));
} finally {
  await context.close();
}

async function screenshotLargestImage(page, outputPath) {
  const handles = await page.locator("img").elementHandles();
  const candidates = [];
  for (const handle of handles) {
    const box = await handle.boundingBox();
    if (!box) continue;
    if (box.width < 180 || box.height < 180) continue;
    candidates.push({ handle, area: box.width * box.height });
  }
  candidates.sort((a, b) => b.area - a.area);
  const target = candidates[0]?.handle;
  if (!target) return false;
  await target.screenshot({ path: outputPath });
  return true;
}

async function screenshotPostImages(page, outputDir) {
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
  return files;
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

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}
