import fs from "node:fs";
import path from "node:path";

export function loadConfig(configPath = "config.local.json") {
  loadEnvFile(path.resolve(path.dirname(configPath), ".env"));
  if (!fs.existsSync(configPath)) {
    throw new Error(`找不到配置文件 ${configPath}。请先运行 npm run setup。`);
  }
  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  config.__path = path.resolve(configPath);
  config.runtimeDir = path.resolve(path.dirname(config.__path), config.runtimeDir || "runtime");
  return config;
}

export function loadEnvFile(file = ".env") {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || match[1] in process.env) continue;
    const value = match[2].replace(/^(['"])(.*)\1$/, "$2");
    process.env[match[1]] = value;
  }
}

export function findPlaceholders(value, prefix = "") {
  const found = [];
  if (typeof value === "string" && /<[^>]+>|replace_me/i.test(value)) found.push(prefix || "(root)");
  if (Array.isArray(value)) {
    value.forEach((item, index) => found.push(...findPlaceholders(item, `${prefix}[${index}]`)));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => {
      found.push(...findPlaceholders(item, prefix ? `${prefix}.${key}` : key));
    });
  }
  return found;
}

export function requireConfig(config, paths) {
  const missing = paths.filter((keyPath) => {
    const value = keyPath.split(".").reduce((current, key) => current?.[key], config);
    return value === undefined || value === null || value === "" || (typeof value === "string" && /<[^>]+>/.test(value));
  });
  if (missing.length) throw new Error(`缺少必填配置：${missing.join("、")}`);
}

export function arg(name, fallback = "") {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? true : fallback;
}

export function ensureRuntime(config) {
  fs.mkdirSync(config.runtimeDir, { recursive: true });
  fs.mkdirSync(path.join(config.runtimeDir, "group-inbox"), { recursive: true });
  fs.mkdirSync(path.join(config.runtimeDir, "group-media"), { recursive: true });
}
