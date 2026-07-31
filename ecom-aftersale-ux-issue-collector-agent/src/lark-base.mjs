import { execFileSync } from "node:child_process";

export function larkCli(args) {
  const command = `lark-cli ${args.map(shellQuote).join(" ")}`;
  const output = execFileSync("zsh", ["-lic", command], {
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });
  return JSON.parse(output);
}

export function listRecords(baseToken, tableId) {
  return larkCli([
    "base",
    "+record-list",
    "--as",
    "user",
    "--base-token",
    baseToken,
    "--table-id",
    tableId,
    "--format",
    "json",
  ]).data;
}

export function updateRecords(baseToken, tableId, recordIds, patch) {
  return larkCli([
    "base",
    "+record-batch-update",
    "--as",
    "user",
    "--base-token",
    baseToken,
    "--table-id",
    tableId,
    "--json",
    JSON.stringify({ record_id_list: recordIds, patch }),
  ]);
}

export function upsertRecord(baseToken, tableId, fields) {
  return larkCli([
    "base",
    "+record-upsert",
    "--as",
    "user",
    "--base-token",
    baseToken,
    "--table-id",
    tableId,
    "--json",
    JSON.stringify(fields),
  ]);
}

export function uploadAttachment(baseToken, tableId, recordId, fieldId, file, name) {
  return larkCli([
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
    fieldId,
    "--file",
    file,
    "--name",
    name,
  ]);
}

export function extractRecordId(result) {
  return result?.data?.record?.record_id
    || result?.data?.record?.record_id_list?.[0]
    || result?.data?.record_id
    || "";
}

export function rowsAsObjects(recordListData) {
  return recordListData.data.map((row, index) => ({
    recordId: recordListData.record_id_list[index],
    fields: Object.fromEntries(recordListData.fields.map((field, i) => [field, row[i]])),
  }));
}

export function firstSelect(value) {
  return Array.isArray(value) ? value[0] || "" : value || "";
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'\\''`)}'`;
}
