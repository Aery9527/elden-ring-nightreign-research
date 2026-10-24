// 由鎖定版本的遊戲參數與官方簡中選單文字產生 public/data/characters/nightfarers.json。
// 用法：node tools/import-characters.mjs；之後執行 python tools/fetch-icons.py 下載資料引用的圖示。
// 輸入：
//   tools/relics-config.json       來源版本 (與遺物、武器共用同一份遊戲參數)；heroes 為角色鍵 → HeroParam 與 HeroMenuParam 的 ID
//   public/data/common.json        角色 (characters) 與來源 (sources)
//   tools/character-text-zh.json   能力、技藝、絕活的名稱與說明：官方簡中原文 cn 與本站轉寫 zh
//   Eldenpedia API                 圖示檔案頁是否存在與授權標示 (快取在 tools/.cache/eldenpedia/files.json)
// 產生：
//   等級 1–15 的能力值：HeroStatusParam 只有部分等級的列 (錨點)，其他等級取相鄰錨點的線性插值並向下取整。
//   HP、FP、精力上限：依生命力、集中力、耐力代入 CalcCorrectGraph 100、101、104 的分段線性曲線。
//   能力加成：HeroMenuParam 的評級參數 0–4 對應 S、A、B、C、D。
//   能力、技藝、絕活：英文取自官方選單文字的英文版，繁中為本站依官方簡中的轉寫。
//   具體數值：tools/character-effects.json 的條目；依參數撰寫的條目逐項核對參數值 (SpEffectParam、AtkParam_Pc、Bullet)。
//   技藝冷卻時間：HeroParam characterAbilityCooldown。

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { ROOT, TOOLS, byId, config, iconOf, iconPages, parseCsv, readJson, slug, source, wikiRevision } from "./sources.mjs";

const common = readJson(join(ROOT, "public/data/common.json"));
const problems = [];
const fail = (message) => problems.push(message);

// 參數值必須是數字；空白或非數字記錄錯誤，不當成 0。
function numberOf(row, field, owner) {
  const value = row[field];
  const number = Number(value);
  if (typeof value !== "string" || value.trim() === "" || !Number.isFinite(number)) fail(`${owner} 的 ${field} 不是數字：${value}`);
  return number;
}

const heroRows = byId(parseCsv(await source("params", "HeroParam")), "HeroParam");
const menuRows = byId(parseCsv(await source("params", "HeroMenuParam")), "HeroMenuParam");
const statusRows = byId(parseCsv(await source("params", "HeroStatusParam")), "HeroStatusParam");
const graphRows = byId(parseCsv(await source("params", "CalcCorrectGraph")), "CalcCorrectGraph");

// ---------- 能力值 ----------

// 鍵與 common.json 的 stats 相同
const BASE_STATS = {
  vigor: "statVigor",
  mind: "statMind",
  endurance: "statEndurance",
  strength: "statStrength",
  dexterity: "statDexterity",
  intelligence: "statIntelligence",
  faith: "statFaith",
  arcane: "statArcane",
};
const MAX_LEVEL = 15;

// 錨點：從 heroStatusParamId 開始、ID 連續的 HeroStatusParam 列，以 totalLevel 為等級。等級必須遞增，且包含 1 與 15。
function anchorsOf(heroStatusParamId, owner) {
  const anchors = [];
  for (let id = Number(heroStatusParamId); statusRows.has(String(id)); id++) {
    const row = statusRows.get(String(id));
    const level = numberOf(row, "totalLevel", `HeroStatusParam ${id}`);
    const stats = Object.fromEntries(Object.entries(BASE_STATS).map(([key, field]) => [key, numberOf(row, field, `HeroStatusParam ${id}`)]));
    anchors.push({ level, stats });
  }
  const levels = anchors.map((a) => a.level);
  if (!levels.length || levels[0] !== 1 || levels.at(-1) !== MAX_LEVEL || levels.some((level, i) => i > 0 && level <= levels[i - 1])) {
    fail(`${owner} 的 HeroStatusParam 錨點等級必須從 1 遞增到 ${MAX_LEVEL}：${levels.join("、")}`);
    return null;
  }
  return anchors;
}

// 錨點等級直接取值；其他等級取前後錨點的線性插值並向下取整。
function levelStats(anchors, level) {
  const hi = anchors.findIndex((a) => a.level >= level);
  const upper = anchors[hi];
  if (upper.level === level) return { ...upper.stats };
  const lower = anchors[hi - 1];
  const t = (level - lower.level) / (upper.level - lower.level);
  return Object.fromEntries(Object.keys(BASE_STATS).map((key) => [key, Math.floor(lower.stats[key] + (upper.stats[key] - lower.stats[key]) * t)]));
}

// 上限值：CalcCorrectGraph 的 5 個節點 (stageMaxVal → stageMaxGrowVal) 之間線性插值。參數沒有指明遊戲用哪一列計算上限；
// 列號依社群參數定義的列名，並經 Eldenpedia 能力值表核對 (見 LORE)。曲線必須是直線段 (adjPt 全為 1)，結果必須是整數，不做取整。
const CAPS = { maxHp: ["vigor", "100"], maxFp: ["mind", "101"], maxStamina: ["endurance", "104"] };
function capValue(graphId, x, owner) {
  const row = graphRows.get(graphId);
  if (!row) {
    fail(`CalcCorrectGraph ${graphId} 不存在`);
    return null;
  }
  const at = (field) => [0, 1, 2, 3, 4].map((i) => numberOf(row, `${field}${i}`, `CalcCorrectGraph ${graphId}`));
  const [stage, grow, adj] = [at("stageMaxVal"), at("stageMaxGrowVal"), at("adjPt_maxGrowVal")];
  if (adj.some((value) => value !== 1)) fail(`CalcCorrectGraph ${graphId} 不是直線段 (adjPt_maxGrowVal 不全為 1)`);
  const i = stage.findIndex((value, n) => n > 0 && x <= value);
  if (x < stage[0] || i < 0) {
    fail(`${owner} 的能力值 ${x} 超出 CalcCorrectGraph ${graphId} 的範圍`);
    return null;
  }
  const value = grow[i - 1] + ((grow[i] - grow[i - 1]) * (x - stage[i - 1])) / (stage[i] - stage[i - 1]);
  if (!Number.isInteger(value)) fail(`${owner} 以 CalcCorrectGraph ${graphId} 算出的上限 ${value} 不是整數`);
  return value;
}

function levelsOf(hero, owner) {
  const anchors = anchorsOf(hero.heroStatusParamId, owner);
  // 錨點不合法時已記錄錯誤，不再計算 (避免後續例外遮蔽原始錯誤)
  if (!anchors) return { anchorLevels: [], levels: {} };
  const levels = {};
  for (let level = 1; level <= MAX_LEVEL; level++) {
    const stats = levelStats(anchors, level);
    const caps = Object.fromEntries(Object.entries(CAPS).map(([key, [base, graph]]) => [key, capValue(graph, stats[base], `${owner} 等級 ${level}`)]));
    levels[level] = { ...stats, ...caps };
  }
  return { anchorLevels: anchors.map((a) => a.level), levels };
}

// ---------- 能力加成 ----------

// HeroMenuParam 的評級欄位，鍵與 common.json 的 stats 相同 (HP、FP、精力上限與五項攻擊能力值)。
const GRADES = {
  maxHp: "hpGrade",
  maxFp: "fpGrade",
  maxStamina: "staminaGrade",
  strength: "strengthGrade",
  dexterity: "dexterityGrade",
  intelligence: "intelligenceGrade",
  faith: "faithGrade",
  arcane: "arcaneGrade",
};
// 0–4 對 S–D 已逐角色與 Eldenpedia 核對；其他值沒有核對過，停止。
const GRADE_LETTERS = ["S", "A", "B", "C", "D"];
function gradesOf(row) {
  return Object.fromEntries(
    Object.entries(GRADES).map(([key, field]) => {
      const value = numberOf(row, field, `HeroMenuParam ${row.ID}`);
      if (!GRADE_LETTERS[value]) fail(`HeroMenuParam ${row.ID} 的 ${field} 不是 0–4：${value}`);
      return [key, GRADE_LETTERS[value] ?? null];
    }),
  );
}

// ---------- 能力、技藝、絕活的文字 ----------

// BWIKI「三語」頁的原始碼：每種語言一段「|<語言>版对话内容=」，每行一筆文字，行內換行寫成 <br>，行尾也有 <br>。
// 簡中與英文兩段的行數相同、逐行對應。
function wikiSections(text, name) {
  const sections = {};
  for (const m of text.matchAll(/^\|(\S+?)版对话内容=\n([\s\S]*?)(?=^\||^\}\})/gm)) sections[m[1]] = m[2].replace(/\n$/, "").split("\n");
  const { 中文: cn, 英文: en } = sections;
  if (!cn || !en || cn.length !== en.length) fail(`${name} 的簡中與英文段落必須都在且行數相同`);
  return { cn: cn ?? [], en: en ?? [] };
}
const fromWiki = (line) => line.replace(/<br>$/, "").replace(/<br>/g, "\n");
const toWiki = (text) => `${text.replace(/\n/g, "<br>")}<br>`;
const menuTexts = await Promise.all(
  Object.keys(config.sources.bwikiMenu.revisions).map(async (key) => ({ key, ...wikiSections(await wikiRevision("bwikiMenu", key), key) })),
);

// 轉寫輸入檔：必須是 JSON.stringify 2 空格縮排的標準輸出 (避免重複的鍵被 JSON.parse 靜默覆蓋)
const TEXT_ZH = join(TOOLS, "character-text-zh.json");
const textZhRaw = readFileSync(TEXT_ZH, "utf8").replace(/\r\n/g, "\n");
const textZh = JSON.parse(textZhRaw);
if (textZhRaw !== `${JSON.stringify(textZh, null, 2)}\n`) fail(`${TEXT_ZH} 有重複的鍵或不是標準格式 (JSON.stringify 2 空格縮排)`);

const ABILITIES = ["passive", "skill", "art"];
const FIELDS = ["name", "summary", "description"];
const sameKeys = (value, keys) =>
  value !== null && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));

// 每筆 cn 文字必須出現在官方簡中選單文字中，英文取同一行號的英文；出現在多行時 (同一句用在不同畫面)，這些行必須在同一頁且英文相同。
// 回傳 { zh, en, page, lines }。
function abilityField(hero, ability, field) {
  const entry = textZh[hero]?.[ability];
  const owner = `${TEXT_ZH} 的 ${hero}.${ability}`;
  const valid = sameKeys(entry, ["cn", "zh"]) && ["cn", "zh"].every((side) => sameKeys(entry[side], FIELDS) && FIELDS.every((f) => typeof entry[side][f] === "string" && entry[side][f].trim() !== ""));
  if (!valid) {
    fail(`${owner} 必須恰有 cn 與 zh，各有非空的 ${FIELDS.join("、")}`);
    return null;
  }
  const line = toWiki(entry.cn[field]);
  const hits = menuTexts.flatMap((page) => page.cn.flatMap((text, i) => (text === line ? [{ page, i }] : [])));
  const pageKeys = new Set(hits.map((hit) => hit.page.key));
  const ens = new Set(hits.map((hit) => hit.page.en[hit.i]));
  if (!hits.length || pageKeys.size !== 1 || ens.size !== 1) {
    fail(`${owner}.cn.${field} 必須出現在官方簡中選單文字的同一頁，且各處英文相同 (出現 ${hits.length} 次、${pageKeys.size} 頁、英文 ${ens.size} 種)`);
    return null;
  }
  return { zh: entry.zh[field], en: fromWiki([...ens][0]), page: hits[0].page.key, lines: hits.map((hit) => hit.i) };
}

// 選單文字依文字 ID 排列，角色的文字 ID 隨 HeroParam ID 遞增；因此同一欄位中，同一頁的角色行號必須隨 HeroParam ID 遞增
// (一句出現在多行時，依序取大於前一名角色行號的最小行號)。
function checkOrder(texts) {
  for (const ability of ABILITIES) {
    for (const field of FIELDS) {
      const rows = texts.filter((t) => t.text[ability][field]).map((t) => ({ id: Number(t.heroParam), ...t.text[ability][field] }));
      for (const key of new Set(rows.map((r) => r.page))) {
        let previous = -1;
        for (const row of rows.filter((r) => r.page === key).sort((a, b) => a.id - b.id)) {
          const next = row.lines.find((line) => line > previous);
          if (next === undefined) fail(`${ability}.${field} 在 ${key} 的行號沒有隨 HeroParam ID 遞增 (HeroParam ${row.id})`);
          previous = next ?? Infinity;
        }
      }
    }
  }
}

// 文字來源：BWIKI 兩個頁面各對應 common.json 的一個來源；同一項能力的名稱與說明必須來自同一頁。
const PAGE_SOURCES = { menu: "bwiki-menu-text", menuDlc: "bwiki-menu-text-dlc" };
function textSources(fields, owner) {
  const keys = new Set(Object.values(fields).filter(Boolean).map((field) => field.page));
  if (keys.size !== 1) fail(`${owner} 的名稱與說明不在同一頁選單文字`);
  return [...keys].map((key) => PAGE_SOURCES[key]);
}

// ---------- 圖示 ----------

const ICON_TITLES = { passive: "ERN Passive Ability Icon", skill: "ERN Character Skill Icon", art: "ERN Ultimate Art Icon" };
const ICON_FILES = { passive: "passive", skill: "character-skill", art: "ultimate-art" };
const iconTitle = (ability, en) => `File:${ICON_TITLES[ability]} ${en}.png`;

// ---------- 具體數值 ----------

// tools/character-effects.json：每名角色的 passive、skill、art 各一組條目，skill 可另有 cooldownNote (冷卻時間與社群記載不同時的註記)。
// 條目二選一：
//   依參數撰寫：{ zh, checks, note? }，sources 固定為 game-params。checks 每項核對一個參數值，有 display 時 zh 必須含該文字。
//   社群記載的機制摘要：{ zh, sources }，不可含參數核對。
// note 為 { zh, sources }：參數值與社群記載不同時的註記。
const EFFECTS = join(TOOLS, "character-effects.json");
const effectsConfig = readJson(EFFECTS);
const paramRows = {
  SpEffectParam: byId(parseCsv(await source("params", "SpEffectParam")), "SpEffectParam"),
  AtkParam_Pc: byId(parseCsv(await source("params", "AtkParam_Pc")), "AtkParam_Pc"),
  Bullet: byId(parseCsv(await source("params", "Bullet")), "Bullet"),
};
// 欄位群組：同一類的所有欄位必須數值相同，才代表「所有傷害」等說法
const FIELD_GROUPS = {
  "DamageCutRate*": ["slash", "blow", "thrust", "neutral", "magic", "fire", "thunder", "dark"].map((t) => `${t}DamageCutRate`),
  "AttackRate*": ["physics", "magic", "fire", "thunder", "dark"].map((t) => `${t}AttackRate`),
  "AttackPowerRate*": ["physics", "magic", "fire", "thunder", "dark"].map((t) => `${t}AttackPowerRate`),
  "AtkCorrection*": ["Phys", "Mag", "Fire", "Thun", "Dark"].map((t) => `atk${t}Correction`),
  "AilmentDefRate*": ["poison", "disease", "blood", "curse", "freeze", "sleep", "madness"].map((t) => `${t}DefDamageRate`),
};

// 讀一個參數值：[參數表, ID, 欄位或欄位群組]；群組內數值不同時記錄錯誤。
function paramValue(ref, owner) {
  const [table, id, field] = Array.isArray(ref) ? ref : [];
  const row = paramRows[table]?.get(String(id));
  if (!row) {
    fail(`${owner}：${table} ${id} 不存在`);
    return null;
  }
  const fields = FIELD_GROUPS[field] ?? [field];
  const missing = fields.filter((f) => !Object.hasOwn(row, f));
  if (missing.length) {
    fail(`${owner}：${table} 沒有欄位 ${missing.join("、")}`);
    return null;
  }
  const values = fields.map((f) => numberOf(row, f, `${table} ${id}`));
  if (new Set(values).size !== 1) {
    fail(`${owner}：${table} ${id} 的 ${field} 數值不一致 (${values.join("、")})`);
    return null;
  }
  return values[0];
}

// 檢查項：{ ref } 直接取值；{ op: "ratio", a, b } 為 a ÷ b 四捨五入到小數 2 位；{ op: "sum", terms } 為總和；
// { op: "scale", a, factor } 為 a × factor。round 指定比對前四捨五入的小數位數。
// 各運算允許的欄位 (另加共同的 value、display、round)
const CHECK_KEYS = { ref: ["ref"], ratio: ["op", "a", "b"], sum: ["op", "terms"], scale: ["op", "a", "factor"] };
const isRef = (ref) => Array.isArray(ref) && ref.length === 3 && typeof ref[0] === "string" && Number.isInteger(ref[1]) && typeof ref[2] === "string";

function checkValue(check, owner) {
  const op = check?.op ?? "ref";
  const allowed = CHECK_KEYS[op];
  if (!allowed) {
    fail(`${owner}：未知的檢查運算 ${op}`);
    return null;
  }
  const extra = Object.keys(check).filter((key) => ![...allowed, "value", "display", "round"].includes(key));
  if (extra.length) fail(`${owner}：檢查項有不認得的欄位 ${extra.join("、")}`);
  const refs = { ref: [check.ref], ratio: [check.a, check.b], sum: check.terms, scale: [check.a] }[op];
  if (!Array.isArray(refs) || !refs.length || !refs.every(isRef)) {
    fail(`${owner}：參數引用必須是 [參數表, 整數 ID, 欄位]，且至少一個`);
    return null;
  }
  if (op === "scale" && !Number.isFinite(check.factor)) {
    fail(`${owner}：scale 的 factor 必須是數字`);
    return null;
  }
  const values = refs.map((ref) => paramValue(ref, owner));
  // 任一參數值讀不到時已記錄錯誤，不再計算
  if (values.some((v) => v === null)) return null;
  const [a, b] = values;
  if (op === "ratio" && b === 0) {
    fail(`${owner}：ratio 的分母為 0`);
    return null;
  }
  const result = { ref: a, ratio: Math.round((a / b) * 100) / 100, sum: values.reduce((total, v) => total + v, 0), scale: a * check.factor }[op];
  if (!Number.isFinite(result)) {
    fail(`${owner}：計算結果不是有限數字`);
    return null;
  }
  return result;
}
// 來源必須是 common.json sources 的自有鍵 (排除 toString 等原型屬性)
const hasSource = (id) => typeof id === "string" && Object.hasOwn(common.sources, id);
const rounded = (value, digits) => (digits === undefined ? Number(value.toPrecision(12)) : Number(value.toFixed(digits)));

function noteOf(note, owner) {
  if (note === undefined) return undefined;
  if (!sameKeys(note, ["zh", "sources"]) || typeof note.zh !== "string" || !Array.isArray(note.sources) || !note.sources.length) {
    fail(`${owner} 的 note 必須恰有 zh 與非空的 sources`);
    return undefined;
  }
  for (const id of note.sources) if (!hasSource(id)) fail(`${owner} 的 note 來源 ${id} 不在 common.json`);
  return { zh: note.zh, sources: note.sources };
}

function effectOf(entry, owner) {
  if (typeof entry?.zh !== "string" || entry.zh.trim() === "") {
    fail(`${owner} 必須有非空的 zh`);
    return null;
  }
  if (entry.checks === undefined) {
    if (!sameKeys(entry, ["zh", "sources"]) || !Array.isArray(entry.sources) || !entry.sources.length) fail(`${owner} 必須恰有 zh 與非空的 sources，或改為依參數撰寫的條目`);
    for (const id of entry.sources ?? []) if (!hasSource(id)) fail(`${owner} 的來源 ${id} 不在 common.json`);
    return { zh: entry.zh, sources: entry.sources };
  }
  const extra = Object.keys(entry).filter((key) => !["zh", "checks", "note"].includes(key));
  if (extra.length) fail(`${owner} 有不認得的欄位：${extra.join("、")}`);
  if (!Array.isArray(entry.checks) || !entry.checks.some((check) => typeof check.display === "string")) fail(`${owner} 至少要有一個含 display 的檢查項`);
  for (const [i, check] of (entry.checks ?? []).entries()) {
    const at = `${owner} 的檢查項 ${i + 1}`;
    if (check.display !== undefined && (typeof check.display !== "string" || !entry.zh.includes(check.display))) fail(`${at}：zh 不含「${check.display}」`);
    if (typeof check.value !== "number") fail(`${at}：value 必須是數字`);
    if (check.round !== undefined && !(Number.isInteger(check.round) && check.round >= 0 && check.round <= 10)) {
      fail(`${at}：round 必須是 0–10 的整數`);
      continue;
    }
    const actual = checkValue(check, at);
    // null 表示已記錄錯誤
    if (actual !== null && rounded(actual, check.round) !== check.value) fail(`${at}：參數值 ${actual} 不等於 ${check.value}`);
  }
  const note = noteOf(entry.note, owner);
  return { zh: entry.zh, ...(note && { note }), sources: ["game-params"] };
}

function effectsOf(key) {
  const owner = `${EFFECTS} 的 ${key}`;
  const entry = effectsConfig[key];
  const keys = entry?.cooldownNote === undefined ? ABILITIES : [...ABILITIES, "cooldownNote"];
  if (!sameKeys(entry, keys)) {
    fail(`${owner} 必須恰有 ${keys.join("、")}`);
    return null;
  }
  const effects = Object.fromEntries(
    ABILITIES.map((ability) => {
      const list = entry[ability];
      if (!Array.isArray(list) || !list.length) fail(`${owner}.${ability} 必須是非空的陣列`);
      return [ability, (list ?? []).map((item, i) => effectOf(item, `${owner}.${ability}[${i}]`))];
    }),
  );
  return { effects, cooldownNote: noteOf(entry.cooldownNote, `${owner}.cooldownNote`) };
}

// ---------- 主程式 ----------

const heroKeys = Object.keys(config.heroes);
for (const key of heroKeys) if (!common.characters[key]) fail(`config.heroes 的 ${key} 不在 common.json 的 characters`);
for (const key of Object.keys(common.characters)) if (!config.heroes[key]) fail(`common.json 的角色 ${key} 不在 config.heroes`);
for (const key of Object.keys(textZh)) if (!config.heroes[key]) fail(`${TEXT_ZH} 的 ${key} 不是 config.heroes 的角色`);
for (const key of Object.keys(effectsConfig)) if (!config.heroes[key]) fail(`${EFFECTS} 的 ${key} 不是 config.heroes 的角色`);

const pages = await iconPages(heroKeys.flatMap((key) => ABILITIES.map((ability) => iconTitle(ability, common.characters[key].name.en))));

const texts = heroKeys.map((key) => ({
  key,
  heroParam: config.heroes[key].heroParam,
  text: Object.fromEntries(ABILITIES.map((ability) => [ability, Object.fromEntries(FIELDS.map((field) => [field, abilityField(key, ability, field)]))])),
}));
checkOrder(texts);

const nightfarers = Object.fromEntries(
  texts.map(({ key, heroParam, text }) => {
    const owner = `角色 ${key}`;
    const hero = heroRows.get(heroParam);
    const menu = menuRows.get(config.heroes[key].heroMenuParam);
    if (!hero) fail(`${owner} 的 HeroParam ${heroParam} 不存在`);
    if (!menu) fail(`${owner} 的 HeroMenuParam ${config.heroes[key].heroMenuParam} 不存在`);
    if (!hero || !menu) return [key, null];
    const { effects, cooldownNote } = effectsOf(key) ?? { effects: {} };
    // 技藝冷卻時間 (秒)：HeroParam characterAbilityCooldown，0 表示沒有冷卻
    const cooldown = numberOf(hero, "characterAbilityCooldown", `HeroParam ${heroParam}`);
    const abilities = Object.fromEntries(
      ABILITIES.map((ability) => {
        const fields = Object.fromEntries(FIELDS.map((field) => [field, text[ability][field] && { zh: text[ability][field].zh, en: text[ability][field].en }]));
        const title = iconTitle(ability, common.characters[key].name.en);
        const extra = ability === "skill" ? { cooldown, ...(cooldownNote && { cooldownNote }) } : {};
        return [ability, { ...fields, icon: iconOf(pages, title, `images/${ICON_FILES[ability]}-${slug(common.characters[key].name.en)}.png`), ...extra, effects: effects[ability] ?? [] }];
      }),
    );
    return [
      key,
      {
        heroId: Number(heroParam),
        grades: gradesOf(menu),
        ...levelsOf(hero, owner),
        ...abilities,
        sources: ["game-params"],
        sourcesFor: Object.fromEntries(ABILITIES.map((ability) => [ability, textSources(text[ability], `${owner} 的 ${ability}`)])),
      },
    ];
  }),
);

for (const id of ["game-params", ...Object.values(PAGE_SOURCES)]) if (!hasSource(id)) fail(`來源 ${id} 不在 common.json`);

if (problems.length) {
  console.error(`無法產生：\n  ${problems.join("\n  ")}`);
  process.exit(1);
}

mkdirSync(join(ROOT, "public/data/characters"), { recursive: true });
const path = join(ROOT, "public/data/characters/nightfarers.json");
writeFileSync(path, `${JSON.stringify({ nightfarers }, null, 2)}\n`);
const items = Object.values(nightfarers);
console.log(`${path}：${items.length} 名角色，圖示 ${items.flatMap((c) => ABILITIES.map((a) => c[a].icon)).filter(Boolean).length} 個`);
