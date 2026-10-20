// 由鎖定版本的遊戲參數、遊戲文字與社群資料集產生 public/data/relics/<category>.json。
// 用法：node tools/import-relics.mjs [category ...]；不帶參數時產生全部大類。
// 輸入：
//   tools/relics-config.json   來源 commit、分類樹、角色與圖示對應
//   tools/relics-curated.json  人工整理的效果 (以 gameId 對應)，欄位覆寫產生值，差異會列出
//   tools/relic-details-zh.json 社群詳細說明的繁中翻譯 (以 gameId 對應，保留英文原文供比對)
//   tools/relic-stacking.json   資料集未載明 (SelfStacking 未知) 而社群來源明確寫出的自身可否疊加 (以 gameId 對應)
//   tools/relic-details-params.json 與遊戲參數不符的社群說明改依參數撰寫的中英文 (以 gameId 對應，保留社群原文與參數證據)
//   tools/relic-penalties.json  增益詞條說明中屬於負面代價的繁中原文片段 (以 gameId 對應)，網站以紅色標示
// 來源檔下載到 tools/.cache/，不提交版本庫。

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TOOLS, byId, config, groupById, parseCsv, readJson, slug, source } from "./sources.mjs";

const curated = readJson(join(TOOLS, "relics-curated.json")).effects;
// 以 gameId 為鍵的輸入檔：JSON.parse 會讓重複鍵靜默覆蓋，因此要求檔案等於標準格式 (2 空格縮排) 的輸出；有重複鍵時兩者必不相同。
function readKeyedJson(path) {
  const text = readFileSync(path, "utf8").replace(/\r\n/g, "\n");
  const data = JSON.parse(text);
  if (text !== `${JSON.stringify(data, null, 2)}\n`) throw new Error(`${path} 有重複的鍵或不是標準格式 (JSON.stringify 2 空格縮排)`);
  return data;
}
const details = readKeyedJson(join(TOOLS, "relic-details-zh.json"));
const corrections = readKeyedJson(join(TOOLS, "relic-details-params.json"));
const usedDetails = new Set();
const usedCorrections = new Set();
const stackingFills = readKeyedJson(join(TOOLS, "relic-stacking.json"));
const penalties = readKeyedJson(join(TOOLS, "relic-penalties.json"));
const usedPenalties = new Set();
const common = readJson(join(ROOT, "public/data/common.json"));

const problems = [];
const fail = (message) => problems.push(message);

// ---------- 來源 ----------

function parseFmg(...texts) {
  const entities = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&apos;": "'" };
  const map = new Map();
  for (const text of texts) {
    for (const [, id, value] of text.matchAll(/<text id="(\d+)">([\s\S]*?)<\/text>/g)) {
      if (value !== "%null%") map.set(id, value.replace(/&\w+;/g, (e) => entities[e] ?? e));
    }
  }
  return map;
}

// ---------- 文字正規化 ----------

const CJK = "\\u3000-\\u303f\\u3400-\\u9fff\\uff00-\\uffef";

// 遊戲文字：接回換行 (※ 附註前留一個空格)、全形英數與＋轉半形 (中文標點保留全形)、中文與英數之間加空格。
function normalizeZh(text) {
  let s = text.trim().replace(/\n[　 ]*(?=※)/g, " ").replace(/\n[　 ]*/g, "");
  s = s.replace(/[０-９Ａ-Ｚａ-ｚ＋]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  s = s.replace(new RegExp(`([${CJK}])([A-Za-z0-9+])`, "g"), "$1 $2");
  s = s.replace(new RegExp(`([A-Za-z0-9])([${CJK}])`, "g"), "$1 $2");
  // 標點前後不加空格
  return s.replace(/ ([，。、；：「」『』（）【】！？])/g, "$1").replace(/([，。、；：「」『』（）【】！？]) /g, "$1");
}

const normalizeEn = (text) => text.replace(/\s+/g, " ").trim();
const splitTier = (name) => {
  const match = name.match(/^(.*?)\s*\+(\d)$/);
  return match ? { base: match[1], tier: Number(match[2]) } : { base: name, tier: 0 };
};
// ---------- 建立效果 ----------

const RELIC_TYPE = { Standard: "standard-relic", "Depth Of Night": "deep-relic", Both: "both-relics" };
// 資料集的 SelfStacking：1 可疊加、0 不可、2 未知。可疊加時多份如何合成沒有來源，記為 null。
const SELF_STACKING = { 0: false, 1: true, 2: null };
const CURSE_REQUIRED = { 0: false, 1: true };

// 列舉欄位只接受已知值，未知值停止，不以 undefined 帶過。
function enumValue(table, value, field, gameId) {
  if (!Object.hasOwn(table, value)) throw new Error(`效果 ${gameId} 的 ${field} 為未知值：${value}`);
  return table[value];
}
const stackingOf = (stacks) => (stacks === true ? { stacks, combine: null } : { stacks });

async function buildEffects() {
  const params = {};
  const PARAM_TABLES = ["AttachEffectParam", "AttachEffectTableParam", "AttachEffectFilterParam", "AttachEffectFilterSubCategoryParam", "EquipParamAntique", "SpEffectParam"];
  for (const key of PARAM_TABLES) {
    const rows = parseCsv(await source("params", key));
    params[key] = key === "AttachEffectTableParam" ? groupById(rows) : byId(rows, key);
  }
  const effectZh = parseFmg(await source("text", "effectZh"), await source("text", "effectZhDlc"));
  const effectEn = parseFmg(await source("text", "effectEn"), await source("text", "effectEnDlc"));
  const relicZh = parseFmg(await source("text", "relicZh"), await source("text", "relicZhDlc"));
  const relicEn = parseFmg(await source("text", "relicEn"), await source("text", "relicEnDlc"));
  const reliquary = JSON.parse(await source("reliquary", "reliquary"));

  const subcategoryByGameId = new Map();
  for (const category of config.categories) {
    for (const sub of category.subcategories) subcategoryByGameId.set(sub.gameId, { category: category.id, ...sub });
  }

  // 遊戲內篩選子分類：AttachEffectParam.attachFilterParamId → AttachEffectFilterParam.attachEffectFilterCategory
  function subcategoryOf(gameId) {
    const filterId = params.AttachEffectParam.get(gameId).attachFilterParamId;
    const filter = params.AttachEffectFilterParam.get(filterId);
    const sub = filter && subcategoryByGameId.get(filter.attachEffectFilterCategory);
    if (!sub) throw new Error(`效果 ${gameId} 沒有對應的遊戲內篩選子分類`);
    return sub;
  }

  // 加成對象 (targets)：只為已核實參數模式的直接攻擊力強化 (SpEffect 攻擊力倍率大於 1) 產生，其他效果不產生。
  // - 武器種類：triggerOnWepType 對應武器 wepType。
  // - 法術系別：magicSubCategoryChange1 對應 Magic.subCategory，且只標記魔法 (magParamChange) 或只標記禱告 (miracleParamChange)。
  // - 魔法／禱告整體：只標記其中一種，且無系別、無武器種類。
  // 參數值只對應 common.json 已定義的標籤；未定義的值不產生。
  const tagByParam = (dimension) => new Map(Object.entries(common.tags[dimension]).map(([key, tag]) => [String(tag.param), key]));
  const weaponTypes = tagByParam("weaponType");
  const spellSchools = tagByParam("spellSchool");
  function targetsOf(param) {
    const found = [];
    for (const column of ["passiveSpEffectId_1", "passiveSpEffectId_2", "passiveSpEffectId_3"]) {
      const sp = params.SpEffectParam.get(param[column]);
      if (!sp || !(Number(sp.physicsAttackRate) > 1)) continue;
      const sorcery = sp.magParamChange === "1";
      const spellType = sorcery === (sp.miracleParamChange === "1") ? null : sorcery ? "sorcery" : "incantation";
      if (sp.triggerOnWepType !== "0" && sp.triggerOnWepType !== "-1") {
        const type = weaponTypes.get(sp.triggerOnWepType);
        if (type) found.push({ weaponType: [type] });
      } else if (sp.magicSubCategoryChange1 !== "0") {
        const school = spellSchools.get(sp.magicSubCategoryChange1);
        if (school && spellType) found.push({ spellType: [spellType], spellSchool: [school] });
      } else if (spellType) {
        found.push({ spellType: [spellType] });
      }
    }
    if (found.length > 1) fail(`效果 ${param.ID} 符合多個加成對象模式`);
    return found[0] ?? null;
  }

  function base(gameId) {
    const param = params.AttachEffectParam.get(gameId);
    if (!param) throw new Error(`遊戲參數沒有效果 ${gameId}`);
    const zh = effectZh.get(param.attachTextId);
    const en = effectEn.get(param.attachTextId);
    if (!zh || !en) throw new Error(`效果 ${gameId} 缺少遊戲文字 ${param.attachTextId}`);
    const allowed = Object.entries(config.characters)
      .filter(([column]) => param[column] === "1")
      .map(([, id]) => id);
    const icon = config.statusIcons[param.statusIconId];
    if (icon === undefined) throw new Error(`效果 ${gameId} 的圖示編號 ${param.statusIconId} 未設定對應`);
    return {
      gameId,
      sub: subcategoryOf(gameId),
      zh: normalizeZh(zh),
      en: normalizeEn(en),
      icon,
      characters: allowed.length === Object.keys(config.characters).length ? null : allowed,
      targets: targetsOf(param),
    };
  }

  // 1. 隨機詞條：Round Table Codex 資料集，與遊戲參數交叉比對互斥群組與圖示編號。
  const rows = [];
  for (const row of reliquary) {
    const item = base(row.EffectID);
    const param = params.AttachEffectParam.get(row.EffectID);
    if (param.compatibilityId !== row.CompatibilityID || param.statusIconId !== row.StatusIconID) {
      fail(`效果 ${row.EffectID} 的資料集欄位與遊戲參數不一致`);
    }
    const detailEn = row.EffectExtendedDescription.trim();
    rows.push({
      ...item,
      random: true,
      availability: enumValue(RELIC_TYPE, row.RelicType, "RelicType", row.EffectID),
      requiresCurse: enumValue(CURSE_REQUIRED, row.CurseRequired, "CurseRequired", row.EffectID),
      stacks: enumValue(SELF_STACKING, row.SelfStacking, "SelfStacking", row.EffectID),
      detailEn: detailEn === "Not Available" ? null : detailEn,
      sources: ["reliquary-json"],
    });
  }

  // 2. 固定遺物專屬詞條：固定遺物的效果表只有一個候選效果，且不在隨機詞條中；只收錄掛在具名且啟用的遺物上的效果。
  const randomIds = new Set(rows.map((row) => row.gameId));
  const tables = params.AttachEffectTableParam;
  const fixedRelics = new Map();
  for (const relic of params.EquipParamAntique.values()) {
    if (relic.disableParam_NT === "1" || !relicZh.has(relic.ID)) continue;
    for (const column of ["attachEffectTableId_1", "attachEffectTableId_2", "attachEffectTableId_3"]) {
      const candidates = (tables.get(relic[column]) ?? []).map((row) => row.attachEffectId);
      if (candidates.length !== 1 || candidates[0] === "-1" || randomIds.has(candidates[0])) continue;
      const icon = config.relicIcons[relic.iconId];
      if (icon === undefined) throw new Error(`遺物 ${relic.ID} 的圖示編號 ${relic.iconId} 未設定對應`);
      const relics = fixedRelics.get(candidates[0]) ?? new Map();
      relics.set(relic.ID, { zh: normalizeZh(relicZh.get(relic.ID)), en: normalizeEn(relicEn.get(relic.ID) ?? ""), icon });
      fixedRelics.set(candidates[0], relics);
    }
  }
  for (const [gameId, relics] of fixedRelics) {
    rows.push({
      ...base(gameId),
      random: false,
      availability: "specific-relic",
      requiresCurse: false,
      stacks: null,
      relics: [...relics.values()],
      detailEn: null,
      sources: ["game-params"],
    });
  }

  // 篩選排序：遊戲內篩選參數的 filterValue，再依 gameId。
  const order = (row) => {
    const filterId = params.AttachEffectParam.get(row.gameId).attachFilterParamId;
    return Number(params.AttachEffectFilterParam.get(filterId)?.filterValue ?? Infinity);
  };
  rows.sort((a, b) => order(a) - order(b) || Number(a.gameId) - Number(b.gameId));
  return rows;
}

// 同一子分類、同一基本名稱、同一角色限制的隨機詞條，等級各不相同且至少有一個 +N 時合為一個效果。
function groupTiers(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.random ? [row.sub.id, splitTier(row.en).base, row.characters?.join()].join("|") : row.gameId;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  const result = [];
  for (const members of groups.values()) {
    const tiers = members.map((row) => splitTier(row.en).tier);
    const isFamily = members.length > 1 && new Set(tiers).size === tiers.length && tiers.some((t) => t > 0);
    if (isFamily) result.push(members.sort((a, b) => splitTier(a.en).tier - splitTier(b.en).tier));
    else for (const row of members) result.push([row]);
  }
  return result;
}

// 社群說明 → 網站說明：與遊戲參數不符或資料集沒有說明 (source 為 null) 者改用依參數撰寫的文字並標示來源，其餘用翻譯。
function translate(gameId, en) {
  const correction = corrections[gameId];
  if (correction) {
    if (details[gameId]) return fail(`效果 ${gameId} 同時有翻譯與參數修正，只能保留一種`);
    if (correction.source !== en) return fail(`效果 ${gameId} 的社群原文已變動，需重新核對參數修正`);
    for (const field of ["en", "zh", "params"]) {
      if (typeof correction[field] !== "string" || !correction[field].trim()) return fail(`參數修正 ${gameId} 缺少 ${field}`);
    }
    if ("sources" in correction && (!Array.isArray(correction.sources) || correction.sources.length === 0)) {
      return fail(`參數修正 ${gameId} 的 sources 必須是非空陣列，或省略以使用 game-params`);
    }
    usedCorrections.add(gameId);
    return { zh: correction.zh, en: correction.en, sources: correction.sources ?? ["game-params"] };
  }
  if (en === null) return undefined;
  const entry = details[gameId];
  if (!entry) return fail(`效果 ${gameId} 缺少繁中翻譯`);
  if (entry.en !== en) return fail(`效果 ${gameId} 的英文原文已變動，需重新翻譯`);
  usedDetails.add(gameId);
  return { zh: entry.zh, en };
}

// 說明中的負面代價片段：每個片段必須出現在繁中說明裡；以數字結尾的片段不得緊接數字 (避免「智力 -1」只標到「智力 -10」的前半)。
function markPenalties(gameId, detail) {
  const phrases = penalties[gameId];
  if (!phrases || typeof detail !== "object" || detail === null) return detail;
  if (!Array.isArray(phrases) || phrases.length === 0 || phrases.some((p) => typeof p !== "string" || !p.trim())) {
    return fail(`代價片段 ${gameId} 必須是非空字串的非空陣列`);
  }
  for (const phrase of phrases) {
    const at = [];
    for (let i = detail.zh.indexOf(phrase); i >= 0; i = detail.zh.indexOf(phrase, i + 1)) at.push(i);
    if (at.length === 0) return fail(`代價片段 ${gameId} 不在說明中：${phrase}`);
    // 同一位置已由較長的片段 (例如「智力 -10」) 完整涵蓋時不算部分對應。
    const partial = (i) =>
      /\d/.test(detail.zh[i + phrase.length] ?? "") &&
      !phrases.some((other) => other.length > phrase.length && detail.zh.startsWith(other, i));
    if (/\d$/.test(phrase) && at.some(partial)) {
      return fail(`代價片段 ${gameId} 只對到較長數字的一部分：${phrase}`);
    }
  }
  usedPenalties.add(gameId);
  return { ...detail, penalties: phrases };
}

// 各級相同的欄位提到效果層級，不同的留在各級。
function hoist(effect, tiers, field) {
  const values = tiers.map((tier) => JSON.stringify(tier[field]));
  if (new Set(values).size === 1) {
    effect[field] = tiers[0][field];
    for (const tier of tiers) delete tier[field];
  }
}

function toEffect(members) {
  const first = members[0];
  const family = members.length > 1 || splitTier(first.en).tier > 0;
  const effect = {
    subcategory: first.sub.id,
    ...(family ? {} : { gameId: first.gameId }),
    name: { zh: family ? first.zh.replace(/\s*\+\d$/, "") : first.zh, en: family ? splitTier(first.en).base : first.en },
    icon: first.icon,
  };
  if (members.some((row) => row.icon !== first.icon)) fail(`效果 ${first.gameId} 各級圖示不同`);
  if (first.characters) effect.characters = first.characters;
  if (first.relics) effect.relics = first.relics;
  if (family) {
    const tiers = members.map((row) => ({
      tier: splitTier(row.en).tier,
      gameId: row.gameId,
      availability: row.availability,
      requiresCurse: row.requiresCurse,
      stacking: stackingOf(row.stacks),
      targets: row.targets ?? undefined,
      detail: markPenalties(row.gameId, translate(row.gameId, row.detailEn)),
    }));
    for (const field of ["availability", "requiresCurse", "stacking", "targets"]) hoist(effect, tiers, field);
    if (effect.targets === undefined) delete effect.targets;
    for (const tier of tiers) for (const field of ["targets", "detail"]) if (tier[field] === undefined) delete tier[field];
    effect.tiers = tiers;
  } else {
    const detail = markPenalties(first.gameId, translate(first.gameId, first.detailEn));
    if (detail) effect.detail = detail;
    effect.availability = first.availability;
    effect.requiresCurse = first.requiresCurse;
    effect.stacking = stackingOf(first.stacks);
    if (first.targets) effect.targets = first.targets;
  }
  effect.sources = first.sources;
  // 有等級的疊加值來自社群補值時，該欄位來源列出社群來源，以及其餘等級原本給值的來源。
  if (members.some((row) => row.stackSources)) {
    const stackSources = members.flatMap((row) => row.stackSources ?? (row.stacks === null ? [] : row.sources));
    effect.sourcesFor = { "stacking.stacks": [...new Set(stackSources)] };
  }
  // 加成對象由遊戲參數產生，與效果本身的來源 (例如資料集) 分開記錄。
  if (members.some((row) => row.targets)) effect.sourcesFor = { ...effect.sourcesFor, targets: ["game-params"] };
  return effect;
}

// ---------- 人工整理資料 ----------

const gameIdsOf = (effect) => (effect.tiers ? effect.tiers.map((t) => t.gameId) : [effect.gameId]).join(" ");
const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);

// 人工值覆寫產生值；兩者都有而不同時列出差異，tiers 依等級逐級合併。
function merge(generated, manual, path, diffs) {
  if (Array.isArray(generated) && Array.isArray(manual) && path.endsWith("tiers")) {
    return manual.map((tier) => {
      const match = generated.find((g) => g.tier === tier.tier);
      return match ? merge(match, tier, `${path}[${tier.tier}]`, diffs) : tier;
    });
  }
  if (isObject(generated) && isObject(manual)) {
    const result = { ...generated };
    for (const [key, value] of Object.entries(manual)) {
      result[key] = key in generated ? merge(generated[key], value, `${path}.${key}`, diffs) : value;
    }
    return result;
  }
  if (JSON.stringify(generated) !== JSON.stringify(manual)) {
    diffs.push(`${path}：產生值 ${JSON.stringify(generated)}，人工值 ${JSON.stringify(manual)}`);
  }
  return manual;
}

// ---------- 主程式 ----------

const rows = await buildEffects();
// 社群補值只填資料集未知 (null) 的自身可否疊加；資料集已有值時停止，不以社群覆寫。
// 來源限明確寫出疊加規則的社群來源；每個來源附一句引用原文。
const STACKING_SOURCES = new Set(["community-sheet", "fextralife-relic-effects"]);
function stackingFillProblem(fill) {
  const { stacks, sources, quotes } = fill;
  if (!Array.isArray(sources) || sources.length === 0) return "缺少 sources";
  if (sources.some((id) => !STACKING_SOURCES.has(id))) return `來源只能是 ${[...STACKING_SOURCES].join("、")}`;
  if (!Array.isArray(quotes) || quotes.length !== sources.length || quotes.some((q) => typeof q !== "string" || !q.trim())) {
    return "quotes 必須為每個來源各一句引用原文";
  }
  if (typeof stacks === "boolean") return null;
  const candidates = stacks?.conflict;
  if (!Array.isArray(candidates) || candidates.length < 2) return "stacks 必須是布林值或至少兩個候選的 conflict";
  for (const c of candidates) {
    if (typeof c.value !== "boolean") return "conflict 候選值必須是布林值";
    if (!Array.isArray(c.sources) || c.sources.length === 0 || c.sources.some((id) => !sources.includes(id))) return "conflict 候選的 sources 必須列在 sources 中";
  }
  if (new Set(candidates.map((c) => c.value)).size < 2) return "conflict 候選值必須不同";
  return null;
}
for (const [gameId, fill] of Object.entries(stackingFills)) {
  const row = rows.find((r) => r.gameId === gameId);
  const problem = stackingFillProblem(fill);
  if (!row) fail(`疊加補值 ${gameId} 沒有對應的效果`);
  else if (row.stacks !== null) fail(`疊加補值 ${gameId} 的資料集已有值 ${row.stacks}`);
  else if (problem) fail(`疊加補值 ${gameId} ${problem}`);
  else {
    row.stacks = fill.stacks;
    row.stackSources = fill.sources;
  }
}
const effects = groupTiers(rows).map(toEffect);

const curatedByIds = new Map();
for (const [key, effect] of Object.entries(curated)) {
  const ids = gameIdsOf(effect);
  if (curatedByIds.has(ids)) fail(`人工整理的效果 ${curatedByIds.get(ids)} 與 ${key} 對應相同的 gameId：${ids}`);
  curatedByIds.set(ids, key);
}
const usedKeys = new Set();
const keyed = [];
const diffs = [];
for (const effect of effects) {
  const ids = gameIdsOf(effect);
  let key = curatedByIds.get(ids);
  let result = effect;
  if (key) {
    result = merge(effect, curated[key], key, diffs);
    curatedByIds.delete(ids);
  } else {
    key = slug(effect.name.en);
    if (usedKeys.has(key) || key in curated) key = `${key}-${ids.split(" ")[0]}`;
  }
  if (usedKeys.has(key)) fail(`效果鍵重複：${key}`);
  usedKeys.add(key);
  keyed.push([key, result]);
}
for (const key of curatedByIds.values()) fail(`人工整理的效果 ${key} 沒有對應的遊戲效果`);
for (const gameId of Object.keys(details)) if (!usedDetails.has(gameId)) fail(`翻譯 ${gameId} 沒有對應的效果`);
for (const gameId of Object.keys(corrections)) if (!usedCorrections.has(gameId)) fail(`參數修正 ${gameId} 沒有對應的效果`);
for (const gameId of Object.keys(penalties)) if (!usedPenalties.has(gameId)) fail(`代價片段 ${gameId} 沒有對應的說明`);
// 效果內所有來源引用：sources、sourcesFor 各欄位、conflict 候選的 sources。
function sourceRefs(value) {
  if (Array.isArray(value)) return value.flatMap(sourceRefs);
  if (!isObject(value)) return [];
  return Object.entries(value).flatMap(([key, child]) => {
    if (key === "sources") return child;
    if (key === "sourcesFor") return Object.values(child).flat();
    return sourceRefs(child);
  });
}

for (const [key, effect] of keyed) {
  const icons = [effect.icon, ...(effect.relics ?? []).map((relic) => relic.icon)];
  for (const icon of icons) if (icon !== null && !common.icons[icon]) fail(`效果 ${key} 的圖示 ${icon} 不在 common.json`);
  for (const id of effect.characters ?? []) if (!common.characters[id]) fail(`效果 ${key} 的角色 ${id} 不在 common.json`);
  for (const id of sourceRefs(effect)) if (!common.sources[id]) fail(`效果 ${key} 的來源 ${id} 不在 common.json`);
  // 規則欄位只能記在效果層或各等級其中一處；人工值與分級產生值同時存在時，頁面會出現互相矛盾的規則。
  for (const field of ["availability", "requiresCurse", "stacking", "targets"]) {
    if (field in effect && (effect.tiers ?? []).some((tier) => field in tier)) {
      fail(`效果 ${key} 的 ${field} 同時記在效果層與等級，只能保留一處`);
    }
  }
}

if (diffs.length) console.log(`人工值與產生值不同 (以人工值為準)：\n  ${diffs.join("\n  ")}`);
if (problems.length) {
  console.error(`無法產生：\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

const requested = process.argv.slice(2);
for (const category of config.categories) {
  if (requested.length && !requested.includes(category.id)) continue;
  const subIds = new Set(category.subcategories.map((sub) => sub.id));
  const output = {
    category,
    effects: Object.fromEntries(keyed.filter(([, effect]) => subIds.has(effect.subcategory))),
  };
  const path = join(ROOT, "public/data/relics", `${category.id}.json`);
  writeFileSync(path, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`${path}：${Object.keys(output.effects).length} 個效果`);
}
