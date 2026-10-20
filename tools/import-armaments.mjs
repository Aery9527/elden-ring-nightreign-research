// 由鎖定版本的遊戲參數與《艾爾登法環》本篇文字產生 public/data/armaments/weapons.json 與 spells.json。
// 用法：node tools/import-armaments.mjs；之後執行 python tools/fetch-icons.py 下載資料引用的圖示。
// 輸入：
//   tools/relics-config.json   來源 commit (與遺物共用同一份遊戲參數)
//   public/data/common.json    標籤定義 (tags)
//   Eldenpedia API             圖示檔案頁是否存在與授權標示；查詢結果快取在 tools/.cache/eldenpedia/files.json
// 收錄：
//   武器：ID 為 10000 倍數、wepType 有定義武器種類標籤、本篇有名稱、sortId 不是 9999999 的基本武器，以及所有搭載法術的武器列。
//   法術：所有武器 equippedSpell_R1/R2 引用的 ID；名稱只取本篇法術清單，Magic 沒有該列時類型與系別為 null。

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, TOOLS, byId, parseCsv, readJson, slug, source } from "./sources.mjs";

const common = readJson(join(ROOT, "public/data/common.json"));
const problems = [];
const fail = (message) => problems.push(message);

// ---------- 名稱 ----------

// 空白、%null% 與 [ERROR] 開頭為無效名稱。
const validName = (value) => typeof value === "string" && value.trim() !== "" && value.trim() !== "%null%" && !value.trim().startsWith("[ERROR]");

// 本篇文字表：每行「ID<Tab>文字」。
function parseText(...texts) {
  const map = new Map();
  for (const text of texts) {
    for (const line of text.split(/\r?\n/)) {
      const [id, value] = line.split("\t");
      if (validName(value)) map.set(id, value.trim());
    }
  }
  return map;
}

// 本篇法術清單：[{ id, name }]；只收法術，鑰匙等道具不在其中。
function parseSpellList(...texts) {
  const map = new Map();
  for (const text of texts) for (const { id, name } of JSON.parse(text)) if (validName(name)) map.set(String(id), name.trim());
  return map;
}

function nameOf(zh, en, id, kind) {
  if (!zh.has(id) && !en.has(id)) return null;
  if (!zh.has(id) || !en.has(id)) {
    fail(`${kind} ${id} 只有單一語言的名稱`);
    return null;
  }
  return { zh: zh.get(id), en: en.get(id) };
}

// ---------- 圖示 ----------

const ICON_CACHE = join(TOOLS, ".cache", "eldenpedia", "files.json");
const LICENSE = "{{License|game}}";

// 查詢 Eldenpedia 檔案頁：是否存在、授權是否為遊戲素材。結果快取，避免每次重新查詢。
async function iconPages(titles) {
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

// Eldenpedia ER SB Icon 系列檔名：英文名稱去冒號、空白保留 (API 標題格式)。
const iconTitle = (kind, en) => `File:ER SB Icon ${kind} ${en.replace(/:/g, "")}.png`;

function iconOf(pages, kind, prefix, name) {
  if (!name) return null;
  const title = iconTitle(kind, name.en);
  const page = pages[title];
  if (!page.exists || !page.licensed) return null;
  return {
    src: `images/${prefix}-${slug(name.en)}.png`,
    page: `https://eldenring.wiki.gg/wiki/${encodeURI(title.replace(/ /g, "_"))}`,
  };
}

// ---------- 主程式 ----------

const weaponRows = byId(parseCsv(await source("params", "EquipParamWeapon")), "EquipParamWeapon");
const magicRows = byId(parseCsv(await source("params", "Magic")), "Magic");
const weaponZh = parseText(await source("erText", "weaponZh"), await source("erText", "weaponZhDlc"));
const weaponEn = parseText(await source("erText", "weaponEn"), await source("erText", "weaponEnDlc"));
const spellZh = parseSpellList(
  ...(await Promise.all(["sorceryZh", "sorceryZhDlc", "incantationZh", "incantationZhDlc"].map((key) => source("erText", key)))),
);
const spellEn = parseSpellList(
  ...(await Promise.all(["sorceryEn", "sorceryEnDlc", "incantationEn", "incantationEnDlc"].map((key) => source("erText", key)))),
);

const tagByParam = (dimension) => new Map(Object.entries(common.tags[dimension]).map(([key, tag]) => [String(tag.param), key]));
const weaponTypes = tagByParam("weaponType");
const spellTypes = tagByParam("spellType");
const spellSchools = tagByParam("spellSchool");
const SHIELDS = new Set(["small-shield", "medium-shield", "greatshield"]);
const SLOTS = { R1: "equippedSpell_R1", R2: "equippedSpell_R2" };
const isRef = (value) => value !== "0" && value !== "-1";

// 武器
const weapons = [];
for (const row of weaponRows.values()) {
  const spells = Object.fromEntries(Object.entries(SLOTS).filter(([, column]) => isRef(row[column])).map(([slot, column]) => [slot, row[column]]));
  const type = weaponTypes.get(row.wepType);
  const name = nameOf(weaponZh, weaponEn, row.ID, "武器");
  const listed = Number(row.ID) % 10000 === 0 && type && name && row.sortId !== "9999999";
  if (!listed && !Object.keys(spells).length) continue;
  if (!type) fail(`搭載法術的武器 ${row.ID} 的 wepType ${row.wepType} 沒有定義武器種類標籤`);
  weapons.push({ row, name, type, spells });
}
weapons.sort((a, b) => Number(a.row.sortId) - Number(b.row.sortId) || Number(a.row.ID) - Number(b.row.ID));

// 法術：所有武器列的引用，不限於收錄的武器
const spellIds = new Set();
for (const row of weaponRows.values()) for (const column of Object.values(SLOTS)) if (isRef(row[column])) spellIds.add(row[column]);
const spells = [...spellIds].map((id) => {
  const magic = magicRows.get(id);
  return { id, magic, name: nameOf(spellZh, spellEn, id, "法術") };
});
spells.sort((a, b) => Number(a.magic?.sortId ?? Infinity) - Number(b.magic?.sortId ?? Infinity) || Number(a.id) - Number(b.id));

const iconKind = (item) => (SHIELDS.has(item.type) ? "shield" : "weapon");
const titles = [
  ...weapons.filter((w) => w.name).map((w) => iconTitle(iconKind(w), w.name.en)),
  ...spells.filter((s) => s.name).map((s) => iconTitle("Spell", s.name.en)),
];
const pages = await iconPages([...new Set(titles)]);

function spellTags(magic, id) {
  if (!magic) return { spellType: null, spellSchool: null };
  const type = spellTypes.get(magic.ezStateBehaviorType);
  if (!type) fail(`法術 ${id} 的 ezStateBehaviorType ${magic.ezStateBehaviorType} 沒有定義法術類型標籤`);
  const schools = [magic.subCategory1, magic.subCategory2].map((value) => spellSchools.get(value)).filter(Boolean);
  return { spellType: [type], spellSchool: [...new Set(schools)] };
}

const withName = (name) => (name ? { sources: ["game-params"], sourcesFor: { name: ["er-base-text"] } } : { sources: ["game-params"] });

const weaponData = Object.fromEntries(
  weapons.map(({ row, name, type, spells: slots }) => [
    row.ID,
    {
      name,
      icon: iconOf(pages, iconKind({ type }), "weapon", name),
      tags: { weaponType: [type] },
      sortId: Number(row.sortId),
      ...(Object.keys(slots).length ? { spells: slots } : {}),
      ...withName(name),
    },
  ]),
);
const spellData = Object.fromEntries(
  spells.map(({ id, magic, name }) => [id, { name, icon: iconOf(pages, "Spell", "spell", name), tags: spellTags(magic, id), ...withName(name) }]),
);

// 引用檢查：搭載的法術都要收錄；圖示檔名不重複
for (const [id, weapon] of Object.entries(weaponData)) {
  for (const spell of Object.values(weapon.spells ?? {})) if (!spellData[spell]) fail(`武器 ${id} 搭載的法術 ${spell} 沒有收錄`);
}
const srcs = [...Object.values(weaponData), ...Object.values(spellData)].flatMap((item) => (item.icon ? [item.icon.src] : []));
for (const src of srcs.filter((src, i) => srcs.indexOf(src) !== i)) fail(`圖示檔名重複：${src}`);
for (const id of ["er-base-text", "game-params"]) if (!common.sources[id]) fail(`來源 ${id} 不在 common.json`);

if (problems.length) {
  console.error(`無法產生：\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

mkdirSync(join(ROOT, "public/data/armaments"), { recursive: true });
for (const [file, key, data] of [["weapons", "weapons", weaponData], ["spells", "spells", spellData]]) {
  const path = join(ROOT, "public/data/armaments", `${file}.json`);
  writeFileSync(path, `${JSON.stringify({ [key]: data }, null, 2)}\n`);
  const items = Object.values(data);
  console.log(`${path}：${items.length} 筆，具名 ${items.filter((i) => i.name).length}，有圖示 ${items.filter((i) => i.icon).length}`);
}
