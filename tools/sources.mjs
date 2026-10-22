// 匯入程式共用：專案路徑、來源設定，以及鎖定版本來源檔的下載與解析。
// 來源檔下載到 tools/.cache/<commit>/，不提交版本庫。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const TOOLS = join(ROOT, "tools");
export const readJson = (path) => JSON.parse(readFileSync(path, "utf8"));
export const config = readJson(join(TOOLS, "relics-config.json"));

export async function source(sourceKey, fileKey) {
  const { repo, commit, files } = config.sources[sourceKey];
  const cachePath = join(TOOLS, ".cache", commit, files[fileKey]);
  if (!existsSync(cachePath)) {
    const url = `https://raw.githubusercontent.com/${repo}/${commit}/${files[fileKey]}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error(`${url}：HTTP ${response.status}`);
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, Buffer.from(await response.arrayBuffer()));
  }
  return readFileSync(cachePath, "utf8").replace(/^﻿/, "");
}

// 參數 CSV 沒有含逗號的欄位 (陣列欄位以 | 分隔)，逐行切割即可。
export function parseCsv(text) {
  const [header, ...lines] = text.split(/\r?\n/).filter(Boolean);
  const keys = header.split(",");
  return lines.map((line) => {
    const cells = line.split(",");
    return Object.fromEntries(keys.map((key, i) => [key, cells[i]]));
  });
}

// 以 ID 建索引；ID 重複時丟出錯誤 (同 ID 多列的參數表，例如 AttachEffectTableParam，須改用 groupById)。
export function byId(rows, name) {
  const map = new Map();
  for (const row of rows) {
    if (map.has(row.ID)) throw new Error(`${name} 的 ID 重複：${row.ID}`);
    map.set(row.ID, row);
  }
  return map;
}

// 遊戲文字 FMG XML：每個 <text id> 一筆，%null% 為無文字；還原 XML 實體。
export function parseFmg(...texts) {
  const entities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
  const map = new Map();
  for (const text of texts) {
    for (const [, id, value] of text.matchAll(/<text id="(\d+)">([\s\S]*?)<\/text>/g)) {
      if (value !== "%null%") map.set(id, value.replace(/&\w+;/g, (e) => entities[e] ?? e));
    }
  }
  return map;
}

export function groupById(rows) {
  const map = new Map();
  for (const row of rows) map.set(row.ID, [...(map.get(row.ID) ?? []), row]);
  return map;
}

export const slug = (text) =>
  text
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
