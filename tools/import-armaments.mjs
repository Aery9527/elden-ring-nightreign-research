// 由鎖定版本的遊戲參數與《艾爾登法環》本篇文字產生 public/data/armaments/weapons.json、spells.json 與 skills.json。
// 用法：node tools/import-armaments.mjs；之後執行 python tools/fetch-icons.py 下載資料引用的圖示。
// 輸入：
//   tools/relics-config.json   來源 commit (與遺物共用同一份遊戲參數)
//   public/data/common.json    標籤定義 (tags)
//   tools/skill-text-zh.json   戰技名稱與說明的繁中轉寫 (以 textId 為鍵，保存官方簡中原文 cn 與本站轉寫 zh)
//   Eldenpedia API             圖示檔案頁是否存在與授權標示；查詢結果快取在 tools/.cache/eldenpedia/files.json
// 收錄：
//   武器：ID 為 10000 倍數、wepType 有定義武器種類標籤、本篇有名稱、sortId 不是 9999999，且有 EquipParamCustomWeapon 列以 targetWeaponId
//         指向的基本武器，以及所有搭載法術的武器列。本篇有、黑夜君臨沒有的武器 (例如落葉格鬥術) 沒有 EquipParamCustomWeapon 列。
//         具名武器另收錄原始參數值：基礎攻擊、能力補正、致命補正、固定效果名稱 (黑夜君臨文字) 與命中時的異常狀態累積。
//   法術：所有武器 equippedSpell_R1/R2 引用的 ID；名稱只取本篇法術清單，Magic 沒有該列時類型與系別為 null。
//         有 Magic 列的法術另收錄原始消耗參數：通常施放與蓄力施放的 FP、耐力。
//   戰技：具名武器的參數預設戰技 (swordArtsParamId)，以及其 EquipParamCustomWeapon 列的戰技池 (swordArtsTableId → SwordArtsTableParam)
//         中權重大於 0 的戰技。武器另記 skill: { default, pool }；pool 是各生成列戰技池的聯集，不加入 -1 (未指定戰技池) 推定的戰技。
//         英文名稱與說明取自本篇 ArtsName／ArtsCaption (依 textId)。繁中名稱取自英文名稱唯一相同的本篇戰灰；沒有時用本站依本篇官方
//         簡中轉寫的名稱。繁中說明一律是本站轉寫。

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { ROOT, TOOLS, byId, groupById, parseCsv, parseFmg, readJson, slug, source } from "./sources.mjs";

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

// 本篇名稱清單：[{ id, name }]，例如法術清單 (只收法術，鑰匙等道具不在其中) 與戰灰清單。
function parseNameList(...texts) {
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

// Eldenpedia 檔名：英文名稱去冒號、空白保留 (API 標題格式)。武器與法術為 ER SB Icon 系列，戰技為黑夜君臨的 ERN Icon skill 系列。
const iconTitle = (kind, en) => `File:ER SB Icon ${kind} ${en.replace(/:/g, "")}.png`;
const skillIconTitle = (en) => `File:ERN Icon skill ${en.replace(/:/g, "")}.png`;

// title 為 null 表示沒有可查的檔名 (例如沒有名稱)
function iconOf(pages, title, prefix, name) {
  if (!title) return null;
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
// 黑夜君臨的武器生成參數 (武器等級、附加效果表、戰技池)，依指向的武器 ID 分組；同一武器可有多列。
const customByWeapon = new Map();
for (const row of parseCsv(await source("params", "EquipParamCustomWeapon"))) {
  customByWeapon.set(row.targetWeaponId, [...(customByWeapon.get(row.targetWeaponId) ?? []), row]);
}
const generated = new Set(customByWeapon.keys());
const artsRows = byId(parseCsv(await source("params", "SwordArtsParam")), "SwordArtsParam");
// 戰技池：同一 ID 多列，每列一個戰技與權重
const artsTables = groupById(parseCsv(await source("params", "SwordArtsTableParam")));
const artsNameEn = parseFmg(await source("erArts", "nameEn"));
const artsCaptionEn = parseFmg(await source("erArts", "captionEn"));
// 本篇官方簡中戰技文字：[{ id, eng, chn }]，以 FMG ID 為鍵
const cnList = (text) => new Map(JSON.parse(text).map((item) => [String(item.id), item]));
const artsNameCn = cnList(await source("erArtsCn", "name"));
const artsCaptionCn = cnList(await source("erArtsCn", "caption"));
// 繁中轉寫輸入檔：必須是 JSON.stringify 2 空格縮排的標準輸出 (避免重複的鍵被 JSON.parse 靜默覆蓋)
const SKILL_TEXT_ZH = join(TOOLS, "skill-text-zh.json");
const skillTextZhRaw = readFileSync(SKILL_TEXT_ZH, "utf8").replace(/\r\n/g, "\n");
const skillTextZh = JSON.parse(skillTextZhRaw);
if (skillTextZhRaw !== `${JSON.stringify(skillTextZh, null, 2)}\n`) fail(`${SKILL_TEXT_ZH} 有重複的鍵或不是標準格式 (JSON.stringify 2 空格縮排)`);
const spRows = byId(parseCsv(await source("params", "SpEffectParam")), "SpEffectParam");
const attachRows = byId(parseCsv(await source("params", "AttachEffectParam")), "AttachEffectParam");
const effectZh = parseFmg(await source("text", "effectZh"), await source("text", "effectZhDlc"));
const effectEn = parseFmg(await source("text", "effectEn"), await source("text", "effectEnDlc"));
const weaponZh = parseText(await source("erText", "weaponZh"), await source("erText", "weaponZhDlc"));
const weaponEn = parseText(await source("erText", "weaponEn"), await source("erText", "weaponEnDlc"));
const spellZh = parseNameList(
  ...(await Promise.all(["sorceryZh", "sorceryZhDlc", "incantationZh", "incantationZhDlc"].map((key) => source("erText", key)))),
);
const spellEn = parseNameList(
  ...(await Promise.all(["sorceryEn", "sorceryEnDlc", "incantationEn", "incantationEnDlc"].map((key) => source("erText", key)))),
);
const ashZh = parseNameList(await source("erText", "ashesZh"), await source("erText", "ashesZhDlc"));
const ashEn = parseNameList(await source("erText", "ashesEn"), await source("erText", "ashesEnDlc"));

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
  const listed = Number(row.ID) % 10000 === 0 && type && name && row.sortId !== "9999999" && generated.has(row.ID);
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

// ---------- 戰技 ----------

const byNumber = (a, b) => Number(a) - Number(b);

// 具名武器的戰技：參數預設 (swordArtsParamId) 與生成池候選 (各生成列戰技池中權重大於 0 的戰技聯集，依 ID 排序)。
// 生成列的 swordArtsTableId 為 -1 時沒有戰技池；參數無法說明此時實際帶哪個戰技，因此不推定為預設戰技。
function weaponSkill(row) {
  const owner = `武器 ${row.ID}`;
  if (!isRef(row.swordArtsParamId)) fail(`${owner} 沒有預設戰技`);
  const pool = new Set();
  for (const custom of customByWeapon.get(row.ID) ?? []) {
    if (custom.swordArtsTableId === "-1") continue;
    const entries = artsTables.get(custom.swordArtsTableId);
    if (!entries) {
      fail(`${owner} 的生成列 ${custom.ID} 引用不存在的戰技池 ${custom.swordArtsTableId}`);
      continue;
    }
    for (const entry of entries) {
      if (numberOf(entry, "chanceWeight", `戰技池 ${entry.ID}`) <= 0) continue;
      if (isRef(entry.swordArtsId)) pool.add(entry.swordArtsId);
      else fail(`戰技池 ${entry.ID} 有權重但沒有戰技`);
    }
  }
  return { default: row.swordArtsParamId, pool: [...pool].sort(byNumber) };
}
const weaponSkills = new Map(weapons.filter((w) => w.name).map(({ row }) => [row.ID, weaponSkill(row)]));
const skillIds = [...new Set([...weaponSkills.values()].flatMap((skill) => [skill.default, ...skill.pool]))].sort(byNumber);
const skillRows = skillIds.flatMap((id) => {
  const row = artsRows.get(id);
  if (!row) fail(`戰技 ${id} 不在 SwordArtsParam`);
  return row ? [row] : [];
});

// 戰灰名稱「戰灰：X」／「Ash of War: X」去掉前綴後，以英文名稱對照戰技；同一英文名稱對到多個戰灰時無法判斷，停止。
const ASH_PREFIX = { zh: "戰灰：", en: "Ash of War: " };
const ashByEn = new Map();
for (const [id, en] of ashEn) {
  if (!en.startsWith(ASH_PREFIX.en)) fail(`戰灰 ${id} 的英文名稱沒有前綴：${en}`);
  const name = en.slice(ASH_PREFIX.en.length);
  ashByEn.set(name, [...(ashByEn.get(name) ?? []), id]);
}

// 繁中轉寫 (tools/skill-text-zh.json)：收錄戰技的每個 textId 恰有一筆 { cn: { name, caption }, zh: { name, caption } }，皆為非空文字。
// cn 與官方簡中來源不同，或兩份來源的本篇英文不一致時停止，須重新核對轉寫。
const sameKeys = (value, keys) =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
function skillText(textId) {
  const entry = skillTextZh[textId];
  const valid =
    sameKeys(entry, ["cn", "zh"]) &&
    ["cn", "zh"].every((side) => sameKeys(entry[side], ["name", "caption"]) && Object.values(entry[side]).every((text) => typeof text === "string" && text.trim() !== ""));
  if (!valid) {
    fail(`${SKILL_TEXT_ZH} 的 ${textId} 必須恰有 cn 與 zh，各有非空的 name 與 caption`);
    return null;
  }
  for (const [field, cn, en] of [["name", artsNameCn, artsNameEn], ["caption", artsCaptionCn, artsCaptionEn]]) {
    const item = cn.get(textId);
    if (item?.chn !== entry.cn[field]) fail(`戰技文字 ${textId} 的 cn.${field} 與官方簡中來源不同，須重新核對轉寫`);
    if (item?.eng !== en.get(textId)) fail(`戰技文字 ${textId} 的英文 ${field} 在兩份來源不同`);
  }
  return entry.zh;
}
const skillTexts = new Map(skillRows.map((row) => [row.textId, skillText(row.textId)]));
for (const textId of Object.keys(skillTextZh)) if (!skillTexts.has(textId)) fail(`${SKILL_TEXT_ZH} 的 ${textId} 不是收錄戰技的 textId`);

// 戰技名稱：英文取自本篇 ArtsName。繁中取自英文名稱相同的本篇戰灰，此時轉寫名稱必須與之相同 (驗證轉寫)；沒有對應的戰灰
// (例如武器專屬戰技) 時用轉寫名稱。zhSource 記錄繁中名稱的來源。
function skillName(row) {
  const en = artsNameEn.get(row.textId)?.trim();
  if (!validName(en)) {
    fail(`戰技 ${row.ID} 的 textId ${row.textId} 沒有英文名稱`);
    return null;
  }
  const converted = skillTexts.get(row.textId)?.name;
  const ashes = ashByEn.get(en) ?? [];
  if (ashes.length > 1) fail(`戰技 ${row.ID} 的英文名稱對到多個戰灰：${ashes.join("、")}`);
  if (ashes.length !== 1) return { zh: converted ?? null, en, zhSource: "er-arts-cn-text" };
  // 不以 ID 推算：本篇戰灰 ID 多為戰技 ID 的 100 倍，但有例外 (戰灰 30900 → 戰技 10、31000 → 309)
  const ash = ashZh.get(ashes[0]);
  if (!ash?.startsWith(ASH_PREFIX.zh)) fail(`戰灰 ${ashes[0]} 的繁中名稱缺少或沒有前綴：${ash}`);
  const zh = ash?.slice(ASH_PREFIX.zh.length) ?? null;
  if (converted !== undefined && converted !== zh) fail(`戰技 ${row.ID} 的轉寫名稱「${converted}」與官方戰灰名稱「${zh}」不同`);
  return { zh, en, zhSource: "er-base-text" };
}
const skillNames = new Map(skillRows.map((row) => [row.ID, skillName(row)]));

// 戰技圖示只依英文名稱尋找。在完整的 SwordArtsParam 中同一 textId 由多個戰技共用，或在完整的 ArtsName 中同一英文名稱
// 出現在多個 textId 時，無法判斷圖示屬於哪一列，不採用圖示 (不限於收錄的戰技，例如 302 與 304 同名為 Parry)。
const textOwners = new Map();
for (const row of artsRows.values()) textOwners.set(row.textId, (textOwners.get(row.textId) ?? 0) + 1);
const nameTexts = new Map();
for (const [textId, text] of artsNameEn) {
  if (validName(text)) nameTexts.set(text.trim(), (nameTexts.get(text.trim()) ?? 0) + 1);
}
const skillIconTitles = new Map(
  skillRows.map((row) => {
    const name = skillNames.get(row.ID);
    const ambiguous = textOwners.get(row.textId) > 1 || nameTexts.get(name?.en) > 1;
    return [row.ID, name && !ambiguous ? skillIconTitle(name.en) : null];
  }),
);

const iconKind = (item) => (SHIELDS.has(item.type) ? "shield" : "weapon");
const titles = [
  ...weapons.filter((w) => w.name).map((w) => iconTitle(iconKind(w), w.name.en)),
  ...spells.filter((s) => s.name).map((s) => iconTitle("Spell", s.name.en)),
  ...[...skillIconTitles.values()].filter(Boolean),
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
        icon: iconOf(pages, name && iconTitle(iconKind({ type }), name.en), "weapon", name),
        tags: { weaponType: [type] },
        sortId: Number(row.sortId),
        ...(Object.keys(slots).length ? { spells: slots } : {}),
        ...(stats ?? {}),
        ...(name ? { skill: weaponSkills.get(row.ID) } : {}),
        ...weaponSources(name, stats),
      },
    ];
  }),
);
const spellData = Object.fromEntries(
  spells.map(({ id, magic, name }) => [
    id,
    {
      name,
      icon: iconOf(pages, name && iconTitle("Spell", name.en), "spell", name),
      tags: spellTags(magic, id),
      ...(magic ? spellCosts(magic) : {}),
      ...withName(name),
    },
  ]),
);

// 戰技 FP 消耗 (SwordArtsParam.useMagicPoint_*)：依輸入 L1、L2、R1、R2 各一個原始參數值，-1 照原值保留，不解讀為不消耗。
const SKILL_FP = { L1: "useMagicPoint_L1", L2: "useMagicPoint_L2", R1: "useMagicPoint_R1", R2: "useMagicPoint_R2" };

// 戰技分組 (common.json 的 skillGroups)：SwordArtsParam.sortGroupId 在該組的清單中，且該組有 defaultWepAttr 清單時預設屬性也在其中。
// 每個戰技必須恰好符合一組。
function skillGroup(row) {
  const matches = Object.entries(common.skillGroups).filter(
    ([, group]) => group.sortGroupId.includes(Number(row.sortGroupId)) && (!group.defaultWepAttr || group.defaultWepAttr.includes(Number(row.defaultWepAttr))),
  );
  if (matches.length !== 1) fail(`戰技 ${row.ID} (sortGroupId ${row.sortGroupId}、defaultWepAttr ${row.defaultWepAttr}) 必須恰好符合一個戰技分組，目前 ${matches.length} 個`);
  return matches[0]?.[0] ?? null;
}

const skillData = Object.fromEntries(
  skillRows.map((row) => {
    const { zhSource, ...name } = skillNames.get(row.ID) ?? {};
    const caption = artsCaptionEn.get(row.textId)?.trim();
    if (!validName(caption)) fail(`戰技 ${row.ID} 的 textId ${row.textId} 沒有英文說明`);
    // 英文名稱與說明取自本篇戰技文字；繁中名稱取自本篇戰灰名稱或本站轉寫，繁中說明為本站轉寫 (依本篇官方簡中)；其餘取自遊戲參數
    const sourcesFor = { "name.en": ["er-arts-text"], "name.zh": [zhSource], "caption.en": ["er-arts-text"], "caption.zh": ["er-arts-cn-text"] };
    return [
      row.ID,
      {
        name,
        textId: row.textId,
        icon: iconOf(pages, skillIconTitles.get(row.ID), "skill", name),
        group: skillGroup(row),
        fp: pick(SKILL_FP, row, `戰技 ${row.ID}`),
        caption: { zh: skillTexts.get(row.textId)?.caption ?? null, en: caption },
        sources: ["game-params"],
        sourcesFor,
      },
    ];
  }),
);

// 引用檢查：搭載的法術、武器的戰技都要收錄；圖示檔名不重複
for (const [id, weapon] of Object.entries(weaponData)) {
  for (const spell of Object.values(weapon.spells ?? {})) if (!spellData[spell]) fail(`武器 ${id} 搭載的法術 ${spell} 沒有收錄`);
  for (const skill of weapon.skill ? [weapon.skill.default, ...weapon.skill.pool] : []) if (!skillData[skill]) fail(`武器 ${id} 的戰技 ${skill} 沒有收錄`);
}
const srcs = [weaponData, spellData, skillData].flatMap((data) => Object.values(data)).flatMap((item) => (item.icon ? [item.icon.src] : []));
for (const src of srcs.filter((src, i) => srcs.indexOf(src) !== i)) fail(`圖示檔名重複：${src}`);
for (const id of ["er-base-text", "er-arts-text", "er-arts-cn-text", "game-params", "game-text"]) if (!common.sources[id]) fail(`來源 ${id} 不在 common.json`);

if (problems.length) {
  console.error(`無法產生：\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

mkdirSync(join(ROOT, "public/data/armaments"), { recursive: true });
for (const [file, key, data] of [["weapons", "weapons", weaponData], ["spells", "spells", spellData], ["skills", "skills", skillData]]) {
  const path = join(ROOT, "public/data/armaments", `${file}.json`);
  writeFileSync(path, `${JSON.stringify({ [key]: data }, null, 2)}\n`);
  const items = Object.values(data);
  console.log(`${path}：${items.length} 筆，具名 ${items.filter((i) => i.name).length}，有圖示 ${items.filter((i) => i.icon).length}`);
}
