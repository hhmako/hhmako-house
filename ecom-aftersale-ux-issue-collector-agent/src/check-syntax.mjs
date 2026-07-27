import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
const files = fs.readdirSync(path.join(root, "src"))
  .filter((name) => name.endsWith(".mjs"))
  .map((name) => path.join("src", name));

for (const file of files) {
  execFileSync(process.execPath, ["--check", file], { cwd: root, stdio: "inherit" });
}
console.log(`PASS  ${files.length} 个源码文件语法检查通过`);
