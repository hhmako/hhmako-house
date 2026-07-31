import fs from "node:fs";
import path from "node:path";
import { larkCli } from "./lark-base.mjs";

const baseToken = getArg("base-token");
const tableId = getArg("table-id");
const recordId = getArg("record-id");
const imagesDir = getArg("images-dir");

if (!baseToken || !tableId || !recordId || !imagesDir) {
  throw new Error("Usage: upload-post-images.mjs --base-token <token> --table-id <table> --record-id <record> --images-dir <dir>");
}

const files = fs.readdirSync(imagesDir)
  .filter((file) => /\.(png|jpe?g|webp)$/i.test(file))
  .sort()
  .map((file) => path.join(imagesDir, file));

for (const file of files) {
  larkCli([
    "base",
    "+record-upload-attachment",
    "--as",
    "user",
    "--base-token",
    baseToken,
    "--table-id",
    tableId,
    "--record-id",
    recordId,
    "--field-id",
    "截图",
    "--file",
    file,
    "--name",
    path.basename(file),
  ]);
}

console.log(JSON.stringify({ uploaded: files.length, files }));

function getArg(name) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : "";
}

