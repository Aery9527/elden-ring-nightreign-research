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

// 鎖定版本的 MediaWiki 頁面原始碼 (config.sources[sourceKey] 有 api 與 revisions)：以 revision ID 取得，該版本內容不會再變。
// 快取到 tools/.cache/<網站>/<revision>.txt。
export async function wikiRevision(sourceKey, fileKey) {
  const { api, revisions } = config.sources[sourceKey];
  const revid = revisions[fileKey];
  const cachePath = join(TOOLS, ".cache", new URL(api).hostname, `${revid}.txt`);
  if (!existsSync(cachePath)) {
    const url = `${api}?${new URLSearchParams({ action: "query", prop: "revisions", revids: String(revid), rvprop: "content", rvslots: "main", format: "json", formatversion: "2" })}`;
    const response = await fetch(url, { headers: { "User-Agent": "elden-ring-nightreign-research importer" } });
    if (!response.ok) throw new Error(`${url}：HTTP ${response.status}`);
    const content = (await response.json()).query?.pages?.[0]?.revisions?.[0]?.slots?.main?.content;
    if (typeof content !== "string") throw new Error(`${url}：沒有 revision ${revid} 的內容`);
    mkdirSync(dirname(cachePath), { recursive: true });
    writeFileSync(cachePath, content);
  }
  return readFileSync(cachePath, "utf8");
}

// ---------- Eldenpedia 圖示 ----------

const ICON_CACHE = join(TOOLS, ".cache", "eldenpedia", "files.json");
const LICENSE = "{{License|game}}";

// 查詢 Eldenpedia 檔案頁：是否存在、授權是否為遊戲素材。結果快取，避免每次重新查詢。
export async function iconPages(titles) {
  const cache = existsSync(ICON_CACHE) ? readJson(ICON_CACHE) : {};
  const missing = titles.filter((title) => !(title in cache));
  for (let i = 0; i < missing.length; i += 50) {
    const batch = missing.slice(i, i + 50);
    const url = `https://eldenring.wiki.gg/api.php?${new URLSearchParams({
      action: "query",
      titles: batch.join("|"),
      prop: "revisions",
      rvprop: "content",
      rvslots: "main",
      format: "json",
      formatversion: "2",
    })}`;
    const response = await fetch(url, { headers: { "User-Agent": "elden-ring-nightreign-research importer" } });
    if (!response.ok) throw new Error(`${url}：HTTP ${response.status}`);
    const { query } = await response.json();
    const normalized = new Map((query.normalized ?? []).map(({ from, to }) => [to, from]));
    for (const page of query.pages) {
      const title = normalized.get(page.title) ?? page.title;
      const content = page.revisions?.[0]?.slots?.main?.content ?? "";
      cache[title] = { exists: !page.missing, licensed: content.includes(LICENSE) };
    }
    for (const title of batch) if (!(title in cache)) throw new Error(`Eldenpedia 沒有回傳 ${title}`);
  }
  mkdirSync(dirname(ICON_CACHE), { recursive: true });
  writeFileSync(ICON_CACHE, `${JSON.stringify(cache, null, 2)}\n`);
  return cache;
}

// 檔案頁存在且授權為遊戲素材時，回傳資料檔的 icon { src, page }；否則 null。title 為 null 表示沒有可查的檔名。
export function iconOf(pages, title, src) {
  if (!title) return null;
  const page = pages[title];
  if (!page.exists || !page.licensed) return null;
  return { src, page: `https://eldenring.wiki.gg/wiki/${encodeURI(title.replace(/ /g, "_"))}` };
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
