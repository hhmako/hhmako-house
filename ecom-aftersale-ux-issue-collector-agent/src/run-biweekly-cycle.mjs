import { spawnSync } from "node:child_process";
import { arg, loadConfig } from "./config.mjs";

const configPath = arg("config") || "config.local.json";
const config = loadConfig(configPath);
const dryRun = process.argv.includes("--dry-run");
const send = process.argv.includes("--send");
const force = process.argv.includes("--force");
const phase = String(arg("phase") || "all");
const now = new Date();

if (!force && !isScheduledWeek(now, config.schedule?.biweeklyAnchorDate)) {
  console.log(JSON.stringify({ skipped: true, reason: "not_biweekly_cycle", date: dateString(now) }));
  process.exit(0);
}

if (!["collect", "send", "all"].includes(phase)) {
  throw new Error("--phase 仅支持 collect、send 或 all。");
}

if (phase === "collect" || phase === "all") {
  run("src/run-external-monitor.mjs", ["--config", configPath]);
}

if (phase === "send" || phase === "all") {
  const lookback = Number(config.schedule?.lookbackDays || 14);
  const since = new Date(now);
  since.setDate(since.getDate() - lookback);
  run("src/run-template-sync-card.mjs", [
    "--config", configPath,
    "--since", dateString(since),
    dryRun ? "--dry-run" : send ? "--send" : "--dry-run",
  ]);
}

function run(script, args) {
  const result = spawnSync(process.execPath, [script, ...args], { stdio: "inherit" });
  if (result.status !== 0) throw new Error(`${script} 运行失败（exit ${result.status}）`);
}

function isScheduledWeek(date, anchorValue) {
  const anchor = parseDate(anchorValue);
  if (!anchor) throw new Error("schedule.biweeklyAnchorDate 必须是 YYYY-MM-DD。");
  const days = Math.floor((startOfDay(date) - startOfDay(anchor)) / 86400000);
  return days >= 0 && Math.floor(days / 7) % 2 === 0;
}

function parseDate(value) {
  const match = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : null;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function dateString(date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
