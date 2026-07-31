import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const mcpName = "figma_pingfang";
const mcpUrl = "http://127.0.0.1:3957/mcp";
const configPath = join(homedir(), ".codex", "config.toml");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const pendingConfigPath = join(root, "CODEX-MCP-CONFIG-TO-ADD.toml");
const block = `[mcp_servers.figma_pingfang]
type = "http"
url = "${mcpUrl}"
`;

function runCodexMcp() {
  const remove = spawnSync("codex", ["mcp", "remove", mcpName], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (remove.error && remove.error.code === "ENOENT") return false;

  const add = spawnSync("codex", ["mcp", "add", mcpName, "--url", mcpUrl], {
    encoding: "utf8",
    stdio: "pipe",
  });

  if (add.status === 0) {
    console.log(`Codex MCP config installed with codex mcp: ${mcpName} -> ${mcpUrl}`);
    console.log("Restart Codex or open a new Codex session for the MCP server to appear.");
    return true;
  }

  const stderr = `${add.stderr || ""}${remove.stderr || ""}`.trim();
  if (stderr) console.warn(stderr);
  return false;
}

function writeConfigFile() {
  mkdirSync(dirname(configPath), { recursive: true });

  let content = "";
  try {
    content = readFileSync(configPath, "utf8");
  } catch (_error) {
    content = "";
  }

  const sectionPattern = /\n?\[mcp_servers\.figma_pingfang\]\n(?:[^\n]*\n?)*?(?=\n\[|$)/m;

  if (sectionPattern.test(content)) {
    content = content.replace(sectionPattern, `\n${block}`);
  } else {
    const trimmed = content.trimEnd();
    content = `${trimmed}${trimmed ? "\n\n" : ""}${block}`;
  }

  writeFileSync(configPath, content.endsWith("\n") ? content : `${content}\n`);
  console.log(`Codex MCP config installed: ${configPath}`);
  console.log("Restart Codex or open a new Codex session for the MCP server to appear.");
}

try {
  if (!runCodexMcp()) writeConfigFile();
} catch (error) {
  writeFileSync(pendingConfigPath, block);
  console.warn("Could not install Codex MCP config automatically.");
  console.warn(error.message);
  console.warn("");
  console.warn(`Wrote fallback config snippet: ${pendingConfigPath}`);
  console.warn("");
  console.warn("Codex should now guide the user through exactly one required action:");
  console.warn(`Add MCP server '${mcpName}' with URL '${mcpUrl}' in Codex MCP settings, or paste the snippet from CODEX-MCP-CONFIG-TO-ADD.toml into config.toml, then restart Codex.`);
  console.warn("");
  console.warn("Continuing setup so the rest of the package can still be prepared.");
}
