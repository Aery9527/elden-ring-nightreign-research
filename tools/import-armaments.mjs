// 由鎖定版本的遊戲參數與《艾爾登法環》本篇文字產生 public/data/armaments/weapons.json 與 spells.json。
// 用法：node tools/import-armaments.mjs；之後執行 python tools/fetch-icons.py 下載資料引用的圖示。
// 輸入：
//   tools/relics-config.json   來源 commit (與遺物共用同一份遊戲參數)
//   public/data/common.json    標籤定義 (tags)
//   Eldenpedia API             圖示檔案頁是否存在與授權標示；查詢結果快取在 tools/.cache/eldenpedia/files.json
// 收錄：
//   武器：ID 為 10000 倍數、wepType 有定義武器種類標籤、本篇有名稱、sortId 不是 9999999 的基本武器，以及所有搭載法術的武器列。
//         具名武器另收錄原始參數值：基礎攻擊、能力補正、致命補正、固定效果名稱 (黑夜君臨文字) 與命中時的異常狀態累積。
//   法術：所有武器 equippedSpell_R1/R2 引用的 ID；名稱只取本篇法術清單，Magic 沒有該列時類型與系別為 null。
//         有 Magic 列的法術另收錄原始消耗參數：通常施放與蓄力施放的 FP、耐力。

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, TOOLS, byId, parseCsv, parseFmg, readJson, slug, source } from "./sources.mjs";

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
const spRows = byId(parseCsv(await source("params", "SpEffectParam")), "SpEffectParam");
const attachRows = byId(parseCsv(await source("params", "AttachEffectParam")), "AttachEffectParam");
const effectZh = parseFmg(await source("text", "effectZh"), await source("text", "effectZhDlc"));
const effectEn = parseFmg(await source("text", "effectEn"), await source("text", "effectEnDlc"));
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

// ---------- 武器數值 ----------
// 皆為原始參數值，不是遊戲內顯示值：黑夜君臨的攻擊力另隨等級與稀有度變化，計算方式尚未核實。
const ATTACK = { physical: "attackBasePhysics", magic: "attackBaseMagic", fire: "attackBaseFire", lightning: "attackBaseThunder", holy: "attackBaseDark" };
// 鍵與 common.json 的 stats 相同，頁面以能力值名稱顯示。
const SCALING = { strength: "correctStrength", dexterity: "correctAgility", intelligence: "correctMagic", faith: "correctFaith", arcane: "correctLuck" };
// 命中時發動的特殊效果 (spEffectBehaviorId0–2) 只取異常狀態累積值；同一列的其他欄位 (例如減傷、恢復) 不收錄。
const BUILDUP = {
  poison: "poizonAttackPower",
  rot: "diseaseAttackPower",
  blood: "bloodAttackPower",
  frost: "freezeAttackPower",
  sleep: "sleepAttackPower",
  madness: "madnessAttackPower",
  deathBlight: "curseAttackPower",
};
const BEHAVIORS = ["spEffectBehaviorId0", "spEffectBehaviorId1", "spEffectBehaviorId2"];

// 參數值必須是數字；空白或非數字記錄錯誤，不當成 0。
function numberOf(row, field, owner) {
  const value = row[field];
  const number = Number(value);
  if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(number)) fail(`${owner} 的 ${field} 不是數字：${value}`);
  return number;
}
const pick = (fields, row, owner) => Object.fromEntries(Object.entries(fields).map(([key, field]) => [key, numberOf(row, field, owner)]));

// 固定效果 (attachEffectId → AttachEffectParam.attachTextId) 只收名稱；效果數值與作用條件 (passive、onHit、permanent 引用鏈) 尚未收錄。
function weaponStats(row) {
  const owner = `武器 ${row.ID}`;
  const buildup = {};
  for (const column of BEHAVIORS) {
    if (!isRef(row[column])) continue;
    const sp = spRows.get(row[column]);
    if (!sp) {
      fail(`${owner} 的 ${column} 引用不存在的 SpEffectParam ${row[column]}`);
      continue;
    }
    for (const [key, value] of Object.entries(pick(BUILDUP, sp, `SpEffectParam ${sp.ID}`))) {
      if (value === 0) continue;
      if (key in buildup) fail(`${owner} 的命中效果重複累積 ${key}`);
      buildup[key] = value;
    }
  }
  let passive = null;
  if (isRef(row.attachEffectId)) {
    const effect = attachRows.get(row.attachEffectId);
    if (!effect) fail(`${owner} 的 attachEffectId ${row.attachEffectId} 不存在`);
    else {
      passive = nameOf(effectZh, effectEn, effect.attachTextId, "武器固定效果");
      if (!passive) fail(`${owner} 的固定效果 ${effect.attachTextId} 沒有名稱`);
    }
  }
  return { attack: pick(ATTACK, row, owner), scaling: pick(SCALING, row, owner), critical: numberOf(row, "criticalAtkRate", owner), passive, buildup };
}

// 法術消耗 (Magic)：通常施放 mp、stamina；蓄力施放 mp_charge、stamina_charge，兩者皆為 0 時為 null。
// 皆為原始參數值，尚未套用減少消耗的效果；持續施放的消耗 (consumeLoopMP_forMenu) 不收錄。
function spellCosts(magic) {
  const owner = `法術 ${magic.ID}`;
  const cost = { fp: numberOf(magic, "mp", owner), stamina: numberOf(magic, "stamina", owner) };
  const charge = { fp: numberOf(magic, "mp_charge", owner), stamina: numberOf(magic, "stamina_charge", owner) };
  return { cost, chargeCost: charge.fp === 0 && charge.stamina === 0 ? null : charge };
}

// 武器來源：名稱取自本篇文字，固定效果名稱取自黑夜君臨文字，其餘取自遊戲參數。
function weaponSources(name, stats) {
  const sourcesFor = { ...(name ? { name: ["er-base-text"] } : {}), ...(stats?.passive ? { passive: ["game-text"] } : {}) };
  return { sources: ["game-params"], ...(Object.keys(sourcesFor).length ? { sourcesFor } : {}) };
}

const weaponData = Object.fromEntries(
  weapons.map(({ row, name, type, spells: slots }) => {
    // 數值只收具名武器 (頁面只列具名武器)；未具名的法器變體只用於搭載法器計數。
    const stats = name ? weaponStats(row) : null;
    return [
      row.ID,
      {
        name,
        icon: iconOf(pages, iconKind({ type }), "weapon", name),
        tags: { weaponType: [type] },
        sortId: Number(row.sortId),
        ...(Object.keys(slots).length ? { spells: slots } : {}),
        ...(stats ?? {}),
        ...weaponSources(name, stats),
      },
    ];
  }),
);
const spellData = Object.fromEntries(
  spells.map(({ id, magic, name }) => [
    id,
    { name, icon: iconOf(pages, "Spell", "spell", name), tags: spellTags(magic, id), ...(magic ? spellCosts(magic) : {}), ...withName(name) },
  ]),
);

// 引用檢查：搭載的法術都要收錄；圖示檔名不重複
for (const [id, weapon] of Object.entries(weaponData)) {
  for (const spell of Object.values(weapon.spells ?? {})) if (!spellData[spell]) fail(`武器 ${id} 搭載的法術 ${spell} 沒有收錄`);
}
const srcs = [...Object.values(weaponData), ...Object.values(spellData)].flatMap((item) => (item.icon ? [item.icon.src] : []));
for (const src of srcs.filter((src, i) => srcs.indexOf(src) !== i)) fail(`圖示檔名重複：${src}`);
for (const id of ["er-base-text", "game-params", "game-text"]) if (!common.sources[id]) fail(`來源 ${id} 不在 common.json`);

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
