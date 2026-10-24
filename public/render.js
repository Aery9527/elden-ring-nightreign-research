// 依 <body data-load> 列出的資料檔 (例如 "common relics/general") 讀取遊戲數值，填入頁面上的 data-* 佔位元素。
// common 放共用的能力值、圖示、角色、標籤 (tags)、介面文字 (labels) 與來源；relics/* 各放一個遺物詞條大類的分類定義與效果；
// armaments/weapons、armaments/spells、armaments/skills 放武器、法術與戰技。
// 資料慣例：一般值依該效果的 sources；null 表示尚未核實；{ conflict: [...] } 表示來源分歧，不預設採用任何候選值；
// sourcesFor 以欄位路徑取代該欄位的 sources。

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

function isConflict(value) {
  return value !== null && typeof value === "object" && Array.isArray(value.conflict);
}

// 只接受表格自身的鍵：繼承屬性 (例如 toString、__proto__) 不算有定義。
function lookup(table, key, kind) {
  const item = Object.hasOwn(table, key) ? table[key] : undefined;
  if (!item) throw new Error(`找不到${kind}：${key}`);
  return item;
}

// null 與來源分歧不能格式化成數字，改顯示狀態文字。
function formatAmount(data, unit, value) {
  if (value === null) return data.labels.unverified;
  if (isConflict(value)) return data.labels.conflict;
  if (typeof value !== "number") throw new Error(`數值缺漏或格式錯誤：${JSON.stringify(value)}`);
  const sign = value < 0 ? "-" : "+";
  return `${sign}${Math.abs(value)}${unit === "percent" ? "%" : ""}`;
}

// 規則欄位的狀態鍵，對應 labels 中的文字：true、false、null、conflict 或其他字串值。
function ruleKey(value) {
  return isConflict(value) ? "conflict" : String(value);
}

// 規則狀態的顯示文字；欄位缺漏 (undefined) 或標籤缺漏時丟出錯誤，不以空白帶過。
// 來源分歧時在標籤後列出每個候選值與其來源名稱，例如「是否可疊加來源分歧（試算表：可疊加／Fextralife：同一效果不重複生效）」。
function ruleLabel(data, field, value) {
  const labels = lookup(data.labels, field, "規則標籤組");
  const label = lookup(labels, ruleKey(value), `規則標籤 ${field}`);
  if (!isConflict(value)) return label;
  const candidates = value.conflict.map((candidate) => {
    const names = candidate.sources.map((id) => lookup(data.sources, id, "來源").title).join("、");
    return `${names}：${ruleLabel(data, field, candidate.value)}`;
  });
  return `${label}（${candidates.join("／")}）`;
}

// 規則狀態節點：尚未核實或來源分歧時以粗體標示 (tone-unverified)，與圖例的「未核實」一致。
function ruleNode(data, field, value) {
  const label = ruleLabel(data, field, value);
  return value === null || isConflict(value) ? el("span", { class: "tone-unverified" }, label) : label;
}

// 是否阻止計算與顯示文字分開判斷：任一規則不符預期即阻止，並回傳該規則的狀態文字。
function blockingRule(data, stacking, required) {
  const failed = required.find(([field, expected]) => stacking[field] !== expected);
  return failed ? { label: ruleLabel(data, failed[0], stacking[failed[0]]) } : null;
}

function formatMultiplier(value) {
  return `×${Number(value.toFixed(4))}`;
}

function sourceLinks(data, ids) {
  const nodes = [];
  ids.forEach((id, index) => {
    const source = lookup(data.sources, id, "來源");
    if (index > 0) nodes.push("、");
    nodes.push(el("a", { href: source.url, target: "_blank", rel: "noopener noreferrer" }, source.title));
  });
  return nodes;
}

// 效果引用的全部來源：效果層級 sources、sourcesFor 各欄位，以及依參數修正的說明 (detail.sources) 的來源，去除重複。
function effectSources(effect) {
  const details = [effect.detail, ...(effect.tiers ?? []).map((tier) => tier.detail)];
  return [
    ...new Set([
      ...effect.sources,
      ...Object.values(effect.sourcesFor ?? {}).flat(),
      ...details.flatMap((detail) => detail?.sources ?? []),
    ]),
  ];
}

function statName(data, statId) {
  return lookup(data.stats, statId, "能力值").name.zh;
}

function effectText(data, effect) {
  const { stat, unit, value } = effect.modifier;
  return `${statName(data, stat)} ${formatAmount(data, unit, value)}`;
}

function tierText(data, effect, tierNumber) {
  const tier = lookup(Object.fromEntries(effect.tiers.map((t) => [t.tier, t])), tierNumber, "等級");
  return `${statName(data, effect.modifier.stat)} ${formatAmount(data, effect.modifier.unit, tier.value)}`;
}

// 增益的可否疊加由文字色調表示 (見圖例)，只有來源分歧時列出各來源的說法；藍色也代表多份數值相加，
// 因此增益的合成方式只在相乘或未核實時列出；不同等級同時生效 (acrossTiers: true) 也不列出，只列例外。
// 負面效果一律為紅色，色調無法表示這些規則，因此 showStacks 為真時一律列出。
function stackingParts(data, stacking, showStacks) {
  if (!stacking) return [];
  const parts = showStacks || isConflict(stacking.stacks) ? [ruleNode(data, "stacks", stacking.stacks)] : [];
  if ("acrossTiers" in stacking && (showStacks || stacking.acrossTiers !== true)) parts.push(ruleNode(data, "acrossTiers", stacking.acrossTiers));
  if (stacking.stacks === true && (showStacks || stacking.combine !== "add")) parts.push(ruleNode(data, "combine", stacking.combine));
  return parts;
}

// requiresCurse 為 false 或未記錄時不顯示；true、null、conflict 都顯示對應狀態，確定必伴隨 (true) 時以紅色標示。
function curseParts(data, holder) {
  if (!("requiresCurse" in holder) || holder.requiresCurse === false) return [];
  if (holder.requiresCurse === true) return [el("span", { class: "tone-debuff" }, ruleLabel(data, "requiresCurse", true))];
  return [ruleNode(data, "requiresCurse", holder.requiresCurse)];
}

// 以分隔字串串接文字或節點，例如 [a, b] → [a, "；", b]。
function joinParts(parts, separator) {
  return parts.flatMap((part, index) => (index > 0 ? [separator, ...part] : part));
}

const textOf = (part) => (typeof part === "string" ? part : part.textContent);

// 規則順序：等同值、各級規則、疊加、負面效果。各級規則記在 tier 上，相同的等級合併列出，例如「+3、+4：必伴隨負面效果」。
// 取得方式改由種類欄呈現。
// 等同值是增益數值，依詞條色調上色；其餘規則維持小字顏色。
function ruleNodes(data, effect) {
  const { labels } = data;
  if (!effect.stacking && !effect.tiers?.every((tier) => tier.stacking)) {
    throw new Error(`效果缺少疊加規則：${effect.name.en}`);
  }
  const showStacks = isDemerit(data, effect);
  const parts = [];
  if (effect.equivalent) {
    const { stat, unit, value } = effect.equivalent;
    const text = `${labels.equivalent}${statName(data, stat)} ${formatAmount(data, unit, value)}`;
    parts.push([toned(data, effect, effectStacks(effect), text)]);
  }
  const byRule = new Map();
  for (const tier of effect.tiers ?? []) {
    const tierParts = [...stackingParts(data, tier.stacking, showStacks), ...curseParts(data, tier)];
    const key = tierParts.map(textOf).join("，");
    if (!key) continue;
    const entry = byRule.get(key) ?? { nodes: joinParts(tierParts.map((part) => [part]), "，"), tiers: [] };
    entry.tiers.push(tierLabel(data, tier.tier));
    byRule.set(key, entry);
  }
  for (const { nodes, tiers } of byRule.values()) parts.push([`${tiers.join("、")}：`, ...nodes]);
  parts.push(...stackingParts(data, effect.stacking, showStacks).map((part) => [part]), ...curseParts(data, effect).map((part) => [part]));
  return joinParts(parts, "；");
}

// 規則小字；沒有任何規則時不輸出，避免留下空行。
function ruleSub(data, effect) {
  const nodes = ruleNodes(data, effect);
  return nodes.length ? [el("span", { class: "sub" }, ...nodes)] : [];
}

function isDemerit(data, effect) {
  return lookup(data.subcategories, effect.subcategory, "子分類").category === "demerit";
}

// 文字色調：負面效果大類的詞條為紅色；增益依自身可否疊加，可疊加為藍色、不可疊加為綠色；未核實或來源分歧為粗體。
function toneClass(data, effect, stacks) {
  if (isDemerit(data, effect)) return "tone-debuff";
  if (stacks === true) return "tone-stack";
  if (stacks === false) return "tone-solo";
  return "tone-unverified";
}

// 詞條整體的可否疊加：規則記在詞條上時直接取用；記在各級時，各級相同才採用，否則視為不一致 (粗體)。
function effectStacks(effect) {
  if (effect.stacking) return effect.stacking.stacks;
  const [first, ...rest] = effect.tiers.map((tier) => tier.stacking.stacks);
  return !isConflict(first) && rest.every((value) => value === first) ? first : null;
}

function tierStacks(effect, tier) {
  return (tier.stacking ?? effect.stacking).stacks;
}

// 依色調包住文字；penalties 為說明中屬於負面代價的原文片段，以紅色標示，其餘文字維持詞條色調。
function toned(data, effect, stacks, text, penalties = []) {
  const tone = toneClass(data, effect, stacks);
  const nodes = [];
  let rest = text;
  while (rest) {
    // 同一位置優先採用較長的片段 (例如「智力 -10」優先於「智力 -1」)。
    let hit = null;
    for (const phrase of penalties) {
      const at = rest.indexOf(phrase);
      if (at >= 0 && (!hit || at < hit.at || (at === hit.at && phrase.length > hit.phrase.length))) hit = { at, phrase };
    }
    const plain = hit ? rest.slice(0, hit.at) : rest;
    if (plain) nodes.push(el("span", { class: tone }, plain));
    if (!hit) break;
    nodes.push(el("span", { class: "tone-debuff" }, hit.phrase));
    rest = rest.slice(hit.at + hit.phrase.length);
  }
  return nodes.length === 1 ? nodes[0] : el("span", {}, ...nodes);
}

// 圖示：null 表示沒有可用的遊戲內圖片，保留同尺寸空位；size 為該編排位置的尺寸 (styles.css 同步設定)。
function iconNode(data, key, size) {
  if (key === undefined) throw new Error("缺少圖示欄位");
  if (key === null) return el("span", { class: "icon icon-missing", role: "img", "aria-label": data.labels.iconMissing });
  const { src, alt } = lookup(data.icons, key, "圖示");
  return el("img", { class: "icon", src, width: size, height: size, alt, loading: "lazy" });
}

function itemName(data, kind, id) {
  const item = kind === "effect" ? lookup(data.effects, id, "效果") : lookup(data.stats, id, "能力值");
  const en = item.abbr ? `${item.name.en} / ${item.abbr}` : item.name.en;
  return el("span", { class: "item-name" }, iconNode(data, item.icon, "48"), item.name.zh, el("span", { class: "en" }, en));
}

// 附圖的名稱清單，例如「限定角色：[圖]女爵、[圖]執行者」。
function namedList(data, label, items) {
  const nodes = [`${label}：`];
  items.forEach((item, index) => {
    if (index > 0) nodes.push("、");
    nodes.push(iconNode(data, item.icon, "24"), item.name);
  });
  return el("span", { class: "entry" }, el("span", { class: "sub" }, ...nodes));
}

function valueEntries(data, ids) {
  return ids.map((id) => {
    const effect = lookup(data.effects, id, "效果");
    return el(
      "span",
      { class: "entry" },
      toned(data, effect, effectStacks(effect), effectText(data, effect)),
      ...ruleSub(data, effect)
    );
  });
}

// 每級顯示的數值：有 resourceDelta 時顯示資源增量，否則顯示能力值增量。
function tierDisplay(effect) {
  const delta = effect.tiers[0].resourceDelta;
  return {
    stat: delta ? delta.stat : effect.modifier.stat,
    unit: delta ? delta.unit : effect.modifier.unit,
    values: effect.tiers.map((tier) => (delta ? tier.resourceDelta.value : tier.value)),
  };
}

// 有來源分歧時，依候選值的來源組合各列一行，不預設採用任何一組；某級沒有該組來源的候選值時顯示「？」。
// hasDetail 為真時，沒有分歧就只列規則，數值由說明呈現。
function tierEntries(data, effect, hasDetail) {
  const { stat, unit, values } = tierDisplay(effect);
  const line = (picked) =>
    `${statName(data, stat)} ${picked.map((value) => (value === undefined ? "？" : formatAmount(data, unit, value))).join("／")}`;
  const rules = ruleSub(data, effect);
  const stacks = effectStacks(effect);
  const sourceSets = new Map();
  for (const value of values.filter(isConflict)) {
    for (const candidate of value.conflict) sourceSets.set(candidate.sources.join(" "), candidate.sources);
  }
  if (sourceSets.size === 0) {
    const nodes = [...(hasDetail ? [] : [toned(data, effect, stacks, line(values))]), ...rules];
    return nodes.length ? [el("span", { class: "entry" }, ...nodes)] : [];
  }
  const entries = [...sourceSets.entries()].map(([key, sources]) => {
    const picked = values.map((value) =>
      isConflict(value) ? value.conflict.find((candidate) => candidate.sources.join(" ") === key)?.value : value
    );
    return el(
      "span",
      { class: "entry" },
      toned(data, effect, stacks, line(picked)),
      el("span", { class: "sub" }, el("span", { class: "tone-unverified" }, `${data.labels.conflict}：`), ...sourceLinks(data, sources))
    );
  });
  return rules.length ? [...entries, el("span", { class: "entry" }, ...rules)] : entries;
}

// 例：生命力 +1 與生命力 +3 合計生命力 +4，HP 上限 +80。疊加規則未知或數值未定時，不輸出計算結果。
function tierSumExample(data, effect, tierNumbers) {
  const tiers = tierNumbers.map((n) => effect.tiers.find((tier) => tier.tier === n));
  const name = statName(data, effect.modifier.stat);
  const unit = effect.modifier.unit;
  const head = tiers.map((tier) => `${name} ${formatAmount(data, unit, tier.value)}`).join(" 與");
  const blocked = blockingRule(data, effect.stacking, [["stacks", true], ["acrossTiers", true], ["combine", "add"]]);
  if (blocked) return `${head}：${blocked.label}`;
  // 有任一值未定時回傳該值 (null 或來源分歧)，由 formatAmount 顯示狀態。
  const sum = (values) => {
    const unknown = values.findIndex((value) => typeof value !== "number");
    return unknown >= 0 ? values[unknown] : values.reduce((a, b) => a + b, 0);
  };
  const total = sum(tiers.map((tier) => tier.value));
  let text = `${head} 合計${name} ${formatAmount(data, unit, total)}`;
  if (tiers.every((tier) => tier.resourceDelta)) {
    const delta = tiers[0].resourceDelta;
    const deltaTotal = sum(tiers.map((tier) => tier.resourceDelta.value));
    text += `，${statName(data, delta.stat)} ${formatAmount(data, delta.unit, deltaTotal)}`;
  }
  return text;
}

// 例：2 個 HP 上限 +10% 為 ×1.21。合成方式未知或數值未定時，不輸出計算結果。
function stackExample(data, effect, count) {
  const head = `${count} 個 ${effectText(data, effect)}`;
  const { unit, value } = effect.modifier;
  const { stacks, combine } = effect.stacking;
  if (typeof value !== "number") return head;
  if (stacks !== true) return `${head}：${ruleLabel(data, "stacks", stacks)}`;
  if (combine === "multiply" && unit === "percent") return `${head} 為 ${formatMultiplier((1 + value / 100) ** count)}`;
  if (combine === "add") return `${head} 合計 ${formatAmount(data, unit, value * count)}`;
  return `${head}：${ruleLabel(data, "combine", combine)}`;
}

// <span data-character="<角色>:<等級>:<能力值>">：取自角色資料檔 (characters/nightfarers) 的等級數值。
function characterValue(data, path) {
  const [id, level, stat] = path.split(":");
  const nightfarer = lookup(data.nightfarers, id, "角色資料");
  const value = lookup(nightfarer.levels, level, "角色等級")[stat];
  if (typeof value !== "number") throw new Error(`找不到角色數值：${path}`);
  return String(value);
}

function tierLabel(data, tierNumber) {
  return tierNumber === 0 ? data.labels.tierBase : `+${tierNumber}`;
}

// 說明結尾的括號附註，例如「技藝冷卻時間 ×0.95（不適用於隱士、復仇者、執行者）。」中的括號部分。
const TRAILING_NOTE = /（[^（）]*）(?=。?$)/;

// 每一級都有說明且結尾附註相同時回傳該附註，否則回傳 null。
function sharedTierNote(effect) {
  const tiers = effect.tiers ?? [];
  if (tiers.length < 2 || !tiers.every((tier) => tier.detail)) return null;
  const notes = tiers.map((tier) => tier.detail.zh.match(TRAILING_NOTE)?.[0]);
  return notes[0] && notes.every((note) => note === notes[0]) ? notes[0] : null;
}

// 社群詳細說明 (detail) 依效果或各等級列出；沒有 detail 的效果不輸出。
// 各級相同的結尾附註從每一級移除，改在各級之後列一次，例如「各等級：不適用於隱士、復仇者、執行者。」。
function detailEntries(data, effect) {
  const entries = effect.detail ? [el("span", { class: "entry" }, toned(data, effect, effectStacks(effect), effect.detail.zh, effect.detail.penalties))] : [];
  const note = sharedTierNote(effect);
  for (const tier of effect.tiers ?? []) {
    if (!tier.detail) continue;
    const zh = note ? tier.detail.zh.replace(TRAILING_NOTE, "") : tier.detail.zh;
    const text = `${tierLabel(data, tier.tier)}：${zh}`;
    entries.push(el("span", { class: "entry" }, toned(data, effect, tierStacks(effect, tier), text, tier.detail.penalties)));
  }
  if (note) {
    const inner = note.slice(1, -1);
    const text = `${data.labels.allTiers}：${inner}${inner.endsWith("。") ? "" : "。"}`;
    const penalties = [...new Set(effect.tiers.flatMap((tier) => tier.detail.penalties ?? []))];
    entries.push(el("span", { class: "entry" }, toned(data, effect, effectStacks(effect), text, penalties)));
  }
  return entries;
}

// 詞條表的效果欄：社群詳細說明放在最前面，接著列規則。結構化數值 (modifier) 只在沒有說明時列出，
// 因為說明已含相同數字；來源分歧的候選值仍列出，說明不含這些資訊。
function effectEntries(data, key, effect) {
  const details = detailEntries(data, effect);
  const hasDetail = details.length > 0;
  let values;
  if (effect.modifier && effect.tiers) values = tierEntries(data, effect, hasDetail);
  else if (effect.modifier && !hasDetail) values = valueEntries(data, [key]);
  else {
    // 沒有說明也沒有結構化數值時標示「未載明數值」，並依色調上色，讓可否疊加仍可辨識。
    const placeholder = hasDetail || effect.modifier ? [] : [toned(data, effect, effectStacks(effect), data.labels.noValue)];
    const nodes = [...placeholder, ...ruleSub(data, effect)];
    values = nodes.length ? [el("span", { class: "entry" }, ...nodes)] : [];
  }
  const extras = [];
  // 限定角色與所在子分類的角色相同時 (角色專屬詞條) 不重複列出。
  const subCharacter = data.subcategories[effect.subcategory].character;
  if (effect.characters && !(effect.characters.length === 1 && effect.characters[0] === subCharacter)) {
    const characters = effect.characters.map((id) => lookup(data.characters, id, "角色"));
    extras.push(namedList(data, data.labels.characters, characters.map((c) => ({ icon: c.icon, name: c.name.zh }))));
  }
  return [...details, ...values, ...extras, ...targetLinks(data, key, effect), ...statLinks(data, key, effect)];
}

// 效果欄：相關武器、法術與戰技 (targets)。以 matchTargets 比對武器與法術的標籤，逐一列出結果為符合 (true) 的具名物品，
// 附圖示並連到該項目 (武器 weapons.html#weapon-<id>、法術依類型在魔法或禱告頁的 #spell-<id>、戰技 skills.html#skill-<id>)，
// 例如「相關武器、法術與戰技：[圖]輝劍圓陣、…」。未核實、來源分歧與未具名的物品不列；沒有可列物品時不輸出。
// 頁面需載入 armaments/weapons、armaments/spells 與 armaments/skills。
function targetLinks(data, key, effect) {
  if ((effect.tiers ?? []).some((tier) => "targets" in tier)) throw new Error(`尚未支援各級不同的加成對象：${key}`);
  if (!effect.targets) return [];
  const { targets } = effect;
  if (!Object.values(targets).every(Array.isArray)) throw new Error(`加成對象必須是清單（效果 ${key}）`);
  // mergeData 一律建立空的 weapons、spells、skills，沒有載入時皆為空。
  if (!Object.keys(data.weapons).length || !Object.keys(data.spells).length || !Object.keys(data.skills).length) {
    throw new Error(`頁面需載入 armaments/weapons、armaments/spells 與 armaments/skills（效果 ${key}）`);
  }
  const weapons = Object.entries(data.weapons)
    .filter(([, weapon]) => weapon.name && matchTargets(weapon.tags, targets) === true)
    .sort(([, a], [, b]) => a.sortId - b.sortId)
    .map(([id, item]) => ({ href: `weapons.html#weapon-${id}`, item }));
  // 法術以自身 ID 比對指定法術 (targets.spell)，與魔法、禱告頁的反向比對相同。
  const spells = Object.entries(data.spells)
    .filter(([id, spell]) => spell.name && matchTargets({ ...spell.tags, spell: [id] }, targets) === true)
    .sort(([idA], [idB]) => Number(idA) - Number(idB))
    .map(([id, item]) => ({ href: `${spellPage(id, item)}#spell-${id}`, item }));
  // 戰技同樣以自身 ID 比對指定戰技 (targets.skill)，依 ID 排序
  const skills = Object.entries(data.skills)
    .filter(([id]) => matchTargets({ skill: [id] }, targets) === true)
    .sort(([idA], [idB]) => Number(idA) - Number(idB))
    .map(([id, item]) => ({ href: `skills.html#skill-${id}`, item }));
  const items = [...weapons, ...spells, ...skills];
  if (items.length === 0) return [];
  const nodes = [`${data.labels.armaments.relatedItems}：`];
  items.forEach(({ href, item }, index) => {
    if (index > 0) nodes.push("、");
    nodes.push(el("a", { href }, itemIcon(data, item, "24"), item.name.zh));
  });
  return [el("span", { class: "entry" }, el("span", { class: "sub" }, ...nodes))];
}

// 效果欄最後一行：相關能力值 (stats) 依序連到能力值頁的該列 (attributes.html#stat-<key>)，例如「相關能力值：[圖]生命力」。
// 沒有 stats 的效果不輸出；記在各級的 stats 尚未支援，出現時報錯。
function statLinks(data, key, effect) {
  if ((effect.tiers ?? []).some((tier) => "stats" in tier)) throw new Error(`尚未支援各級不同的相關能力值：${key}`);
  if (!effect.stats?.length) return [];
  const items = effect.stats.map((id) => {
    const stat = lookup(data.stats, id, "能力值");
    return { icon: stat.icon, name: el("a", { href: `attributes.html#stat-${id}` }, stat.name.zh) };
  });
  return [namedList(data, data.labels.attributes.relatedStats, items)];
}

// 取得方式對應的種類；一般與深層遺物兩者皆列。
const KINDS = { "standard-relic": ["standard-relic"], "deep-relic": ["deep-relic"], "both-relics": ["standard-relic", "deep-relic"] };

// 種類欄：一般、深層各一行；固定遺物列出遺物圖示與名稱。分級詞條出現在兩種以上的種類時，每一行都列出等級，
// 例如「一般：+1、+2、+3」與「深層：+3」；只出現在一種時只寫種類，例如「一般」。
// 取得方式尚未核實或來源分歧時顯示對應狀態。
function kindEntries(data, effect) {
  if (effect.relics) return effect.relics.map((relic) => el("span", { class: "entry" }, iconNode(data, relic.icon, "24"), relic.zh));
  // 取得方式記在詞條上時，所有等級共用；記在各級時逐級判斷。
  const holders = "availability" in effect || !effect.tiers ? [effect] : effect.tiers;
  const tierLabels = (holder) => (holder === effect ? effect.tiers ?? [] : [holder]).map((tier) => tierLabel(data, tier.tier));
  // 以文字分組 (狀態標籤是節點)，同一種類或狀態的等級合併成一行。
  const lines = new Map();
  for (const holder of holders) {
    const kinds = KINDS[holder.availability];
    const names = kinds ? kinds.map((kind) => lookup(data.labels.kinds, kind, "種類")) : [ruleNode(data, "availability", holder.availability)];
    for (const name of names) {
      const key = textOf(name);
      if (!lines.has(key)) lines.set(key, { name, tiers: [] });
      lines.get(key).tiers.push(...tierLabels(holder));
    }
  }
  return [...lines.values()].map(({ name, tiers }) =>
    el("span", { class: "entry" }, name, ...(tiers.length && lines.size > 1 ? [`：${tiers.join("、")}`] : []))
  );
}

// <tbody data-relic-table="子分類鍵">：依資料檔順序列出該子分類的全部效果。
function relicRows(data, subcategoryId) {
  lookup(data.subcategories, subcategoryId, "子分類");
  const rows = Object.entries(data.effects)
    .filter(([, effect]) => effect.subcategory === subcategoryId)
    .map(([key, effect]) =>
      el(
        "tr",
        { id: `effect-${key}` },
        el("td", { class: "item" }, itemName(data, "effect", key)),
        el("td", { class: "value" }, ...effectEntries(data, key, effect)),
        el("td", { class: "kind" }, ...kindEntries(data, effect))
      )
    );
  if (rows.length === 0) throw new Error(`子分類沒有效果：${subcategoryId}`);
  return rows;
}

// ---------- 武器、魔法、禱告 ----------

// 物品標籤與遺物效果相關對象 (targets) 的比對：targets 列出的每個維度，物品至少要有一個相同的鍵 (維度間 AND、維度內 OR)。
// 任一維度確定不符 → false；否則有來源分歧 → "conflict"、有未核實 → null；全部符合 → true。
function matchTargets(tags, targets) {
  let state = true;
  for (const [dimension, wanted] of Object.entries(targets)) {
    const have = tags[dimension];
    if (have === undefined) return false;
    if (have === null) state = state === true ? null : state;
    else if (isConflict(have)) state = "conflict";
    else if (!have.some((key) => wanted.includes(key))) return false;
  }
  return state;
}

// 相關對象與物品標籤相符 (或未核實、來源分歧) 的遺物效果。
// 目前只顯示記在效果層的 targets；記在各級的 targets 尚無資料，出現時報錯，不以合併結果帶過。
function targetEffects(data, tags) {
  const found = [];
  for (const [key, effect] of Object.entries(data.effects)) {
    if ((effect.tiers ?? []).some((tier) => tier.targets)) throw new Error(`尚未支援各級不同的加成對象：${key}`);
    if (!effect.targets) continue;
    const state = matchTargets(tags, effect.targets);
    if (state !== false) found.push({ key, effect, state });
  }
  return found;
}

// 遺物詞條連結：連到所屬大類詞條頁的詞條列 (#effect-*)。
function effectLink(data, key, effect) {
  const category = lookup(data.subcategories, effect.subcategory, "子分類").category;
  return el("a", { href: `relics-${category}.html#effect-${key}` }, effect.name.zh);
}

// 相符詞條的顯示片段：確定相符者為詞條連結；條件尚未核實或來源分歧者只列數量 (粗體)，避免同一狀態的詞條逐條重複。
// parentTags 為上一層 (類型章節或系別章節) 的標籤：在上一層也相符 (不是 false) 的詞條已在上一層列出，這裡不重複。
function targetParts(data, tags, parentTags) {
  const found = targetEffects(data, tags).filter(({ effect }) => !parentTags || matchTargets(parentTags, effect.targets) === false);
  const count = (state, label) => {
    const total = found.filter((item) => item.state === state).length;
    return total ? [el("span", { class: "tone-unverified" }, `${label} ×${total}`)] : [];
  };
  return [
    ...found.filter(({ state }) => state === true).map(({ key, effect }) => effectLink(data, key, effect)),
    ...count(null, data.labels.armaments.unverifiedTargets),
    ...count("conflict", data.labels.armaments.conflictTargets),
  ];
}

// 表格欄的相關遺物詞條：每條一行；沒有相符者標示本次建模範圍內無符合詞條。
function targetEntries(data, tags) {
  const parts = targetParts(data, tags);
  if (!parts.length) return [el("span", { class: "entry sub" }, data.labels.armaments.noTargets)];
  return parts.map((part) => el("span", { class: "entry" }, part));
}

// 章首與法術名稱下方的相關遺物詞條：一行列出，以「、」分隔，例如「相關遺物詞條（依參數關聯）：提升短劍的攻擊力、…」。
function inlineTargets(data, tags, parentTags) {
  const parts = targetParts(data, tags, parentTags);
  if (!parts.length) return [];
  return [`${data.labels.armaments.relatedEffects}：`, ...parts.flatMap((part, index) => (index > 0 ? ["、", part] : [part]))];
}

// 章首 [data-chapter-effects]：沒有相符詞條時標示本次建模範圍內無符合詞條。
function fillChapterEffects(data, section, tags, parentTags) {
  const nodes = inlineTargets(data, tags, parentTags);
  section.querySelector("[data-chapter-effects]").replaceChildren(...(nodes.length ? nodes : [data.labels.armaments.noTargets]));
}

// ---------- 能力值 ----------

// 相關能力值 (stats) 含該能力值的遺物效果。目前只顯示記在效果層的 stats；記在各級的 stats 尚無資料，出現時報錯。
function statEffects(data, statId) {
  const found = [];
  for (const [key, effect] of Object.entries(data.effects)) {
    if ((effect.tiers ?? []).some((tier) => "stats" in tier)) throw new Error(`尚未支援各級不同的相關能力值：${key}`);
    if (effect.stats?.includes(statId)) found.push({ key, effect });
  }
  return found;
}

// <td data-stat-effects="<stat>">：相關遺物詞條。上限 (有 base) 先列直接改變上限的詞條，再列「經由<基礎能力值>」的詞條。
function statEntries(data, statId) {
  const links = (found) => found.map(({ key, effect }) => el("span", { class: "entry" }, effectLink(data, key, effect)));
  const direct = statEffects(data, statId);
  const base = lookup(data.stats, statId, "能力值").base;
  const nodes = links(direct);
  if (base) {
    const via = statEffects(data, base).filter(({ key }) => !direct.some((item) => item.key === key));
    if (via.length) nodes.push(el("span", { class: "entry sub" }, `${data.labels.attributes.viaBase}${statName(data, base)}`), ...links(via));
  }
  return nodes.length ? nodes : [el("span", { class: "entry sub" }, data.labels.armaments.noTargets)];
}

// 武器、法術、戰技的圖示記在項目資料 ({ src, page })，不在 common.json。
function itemIcon(data, item, size) {
  if (!item.icon) return el("span", { class: "icon icon-missing", role: "img", "aria-label": data.labels.iconMissing });
  return el("img", { class: "icon", src: item.icon.src, width: size, height: size, alt: `${item.name.zh}圖示`, loading: "lazy" });
}

const tagName = (data, dimension, key) => lookup(data.tags[dimension], key, "標籤").name.zh;

// 標籤狀態文字：清單列出名稱 (空清單為 emptyLabel)；null 為未核實、分歧為來源分歧，皆粗體。
function tagEntries(data, dimension, value, emptyLabel) {
  if (value === null) return [el("span", { class: "tone-unverified" }, data.labels.unverified)];
  if (isConflict(value)) return [el("span", { class: "tone-unverified" }, data.labels.conflict)];
  if (value.length === 0) return [emptyLabel];
  return [value.map((key) => tagName(data, dimension, key)).join("、")];
}

// 搭載法器：具名法器列出圖示、名稱與槽位 (R1、R2)；未具名的法器變體依槽位分組，只列數量 (依不同武器 ID 計數)。
function carrierEntries(data, spellId) {
  const slotsOf = (weapon) => Object.entries(weapon.spells ?? {}).filter(([, id]) => id === spellId).map(([slot]) => slot).join("、");
  const carriers = Object.values(data.weapons).filter((weapon) => slotsOf(weapon));
  const named = carriers.filter((weapon) => weapon.name).sort((a, b) => a.sortId - b.sortId);
  const unnamed = new Map();
  for (const weapon of carriers.filter((w) => !w.name)) unnamed.set(slotsOf(weapon), (unnamed.get(slotsOf(weapon)) ?? 0) + 1);
  return [
    ...named.map((weapon) => el("span", { class: "entry" }, itemIcon(data, weapon, "24"), `${weapon.name.zh}（${slotsOf(weapon)}）`)),
    ...[...unnamed].sort().map(([slots, count]) => el("span", { class: "entry sub" }, `${data.labels.armaments.unnamedVariants}（${slots}）×${count}`)),
  ];
}

// 法術所在頁：類型為魔法或禱告者在該頁；類型未核實或來源分歧者在武器頁的查證限制表。
const SPELL_PAGES = { sorcery: "sorceries.html", incantation: "incantations.html" };
function spellPage(id, spell) {
  const type = spell.tags.spellType;
  if (!Array.isArray(type)) return "weapons.html";
  if (type.length !== 1) throw new Error(`法術必須恰有一種類型：${id}`);
  return lookup(SPELL_PAGES, type[0], "法術類型頁");
}

// 表格的武器、法術、戰技名稱：圖示、中文與英文名稱；沒有名稱者以 ID 顯示。
function itemNameNode(data, id, item) {
  if (!item.name) return el("span", {}, `${data.labels.armaments.unnamed}（ID ${id}）`);
  return el("span", { class: "item-name" }, itemIcon(data, item, "48"), item.name.zh, el("span", { class: "en" }, item.name.en));
}

// ---------- 戰技 ----------

// 名稱清單的一項：圖示與名稱，連到該項目的列，例如戰技連到 skills.html#skill-<id>。
const linkEntry = (data, href, item) => el("span", { class: "entry" }, el("a", { href }, itemIcon(data, item, "24"), item.name.zh));
const skillEntry = (data, id) => linkEntry(data, `skills.html#skill-${id}`, lookup(data.skills, id, "戰技"));
const weaponEntry = (data, id) => linkEntry(data, `weapons.html#weapon-${id}`, lookup(data.weapons, id, "武器"));

// 有標題的名稱清單：只有一項時直接列出，例如「參數預設：黑刀」；兩項以上時改為可展開的清單，標題附數量，
// 例如「生成池候選 44 種」，收合時只顯示標題，避免長清單撐高表格。
function labeledList(label, unit, entries) {
  if (entries.length === 1) {
    entries[0].prepend(`${label}：`);
    return entries[0];
  }
  return el("details", { class: "fold" }, el("summary", {}, `${label} ${entries.length} ${unit}`), ...entries);
}

// 武器的戰技欄：生成池只有參數預設戰技一種時只列該戰技；否則列「參數預設：<戰技>」，有生成池時另列「生成池候選」。
// 預設戰技可能不在生成池中，因此候選數只計生成池。這些是參數關係，不表示撿到的武器帶哪個戰技。
function weaponSkillCell(data, id, weapon) {
  const labels = data.labels.skills;
  const { skill } = weapon;
  if (!Object.keys(data.skills).length) throw new Error(`頁面需載入 armaments/skills（武器 ${id}）`);
  if (typeof skill?.default !== "string" || !Array.isArray(skill.pool)) throw new Error(`武器戰技必須有 default 與 pool（武器 ${id}）`);
  if (skill.pool.length === 1 && skill.pool[0] === skill.default) return el("td", { class: "skills" }, skillEntry(data, skill.default));
  const pool = skill.pool.length ? [labeledList(labels.poolCandidates, labels.skillUnit, skill.pool.map((skillId) => skillEntry(data, skillId)))] : [];
  return el("td", { class: "skills" }, labeledList(labels.paramDefault, labels.skillUnit, [skillEntry(data, skill.default)]), ...pool);
}

// 戰技 FP 消耗 (遊戲參數原始值，尚未套用減少消耗的效果)：依參數欄位 L1、L2、R1、R2 各一行，-1 不列；全部為 -1 時顯示「—」，
// 不表示不消耗 FP。數值只來自遊戲參數：缺鍵、多鍵或不是數字時報錯。
const SKILL_FP = ["L1", "L2", "R1", "R2"];
function skillFpCell(data, id, skill) {
  const { fp } = skill;
  if (!fp || Object.keys(fp).length !== SKILL_FP.length || !SKILL_FP.every((key) => Number.isFinite(fp[key]))) {
    throw new Error(`戰技 FP 消耗必須是 ${SKILL_FP.join("、")} 的數字（戰技 ${id}）`);
  }
  const lines = SKILL_FP.filter((key) => fp[key] !== -1).map((key) => el("span", { class: "entry" }, `${key} ${fp[key]}`));
  return el("td", { class: "stats" }, ...(lines.length ? lines : [data.labels.armaments.none]));
}

// 相關武器欄：「參數預設」列出預設戰技為此戰技的具名武器，「生成池候選」列出生成池含此戰技的具名武器，皆依 sortId。
// 由頁面計算，資料不另存反向清單；每個戰技至少被一把武器引用，否則報錯。
function skillWeaponEntries(data, id) {
  const labels = data.labels.skills;
  const named = Object.entries(data.weapons)
    .filter(([, weapon]) => weapon.name)
    .sort(([, a], [, b]) => a.sortId - b.sortId);
  const byDefault = named.filter(([, weapon]) => weapon.skill.default === id);
  const byPool = named.filter(([, weapon]) => weapon.skill.pool.includes(id));
  if (!byDefault.length && !byPool.length) throw new Error(`戰技沒有被任何武器引用：${id}`);
  const list = (label, weapons) => (weapons.length ? [labeledList(label, labels.weaponUnit, weapons.map(([weaponId]) => weaponEntry(data, weaponId)))] : []);
  return [...list(labels.paramDefault, byDefault), ...list(labels.poolCandidates, byPool)];
}

// 戰技列：列 id 為 skill-<id>，是武器頁戰技欄與遺物頁相關戰技連結的目標。
// 名稱下方列出指定此戰技的遺物詞條 (targets.skill，以戰技自身 ID 比對)，沒有時不輸出。
// 說明是本站依《艾爾登法環》本篇官方簡體中文轉寫的繁體中文，保留原文換行。
function skillRow(data, id, skill) {
  if (typeof skill.caption?.zh !== "string") throw new Error(`戰技說明必須是文字（戰技 ${id}）`);
  const own = inlineTargets(data, { skill: [id] });
  return el(
    "tr",
    { id: `skill-${id}` },
    el("td", { class: "item" }, itemNameNode(data, id, skill), ...(own.length ? [el("span", { class: "item-targets" }, ...own)] : [])),
    skillFpCell(data, id, skill),
    el("td", { class: "caption" }, el("span", { class: "caption-text" }, skill.caption.zh)),
    el("td", { class: "names skill-weapons" }, ...skillWeaponEntries(data, id))
  );
}

// 戰技的參數預設武器種類：預設戰技為此戰技的具名武器必須恰好屬於一種武器種類，否則報錯。
function skillWeaponType(data, id) {
  const lists = Object.values(data.weapons)
    .filter((weapon) => weapon.name && weapon.skill.default === id)
    .map((weapon) => weapon.tags.weaponType);
  const types = new Set(lists.flatMap((list) => (Array.isArray(list) ? list : [undefined])));
  if (!lists.length || !lists.every((list) => Array.isArray(list) && list.length === 1) || types.size !== 1) {
    throw new Error(`戰技的參數預設武器必須恰好屬於一種武器種類（戰技 ${id}）`);
  }
  return [...types][0];
}

// <section data-skill-group="<group>">：戰技分組章節 (common.json 的 skillGroups)。h2 填分組名稱，[data-skill-rows] 依 ID 列出該組戰技。
// 章內有 <section data-skill-weapon-type="<type>"> 小節時，依參數預設武器的種類分節：h3 填武器種類名稱，各節列出該種類的戰技。
// 每個分組恰有一章、小節恰好涵蓋該組戰技的武器種類、每個戰技恰好列出一次，否則報錯。
function skillChapters(data) {
  if ([...document.querySelectorAll("[data-skill-rows]")].some((rows) => !rows.closest("[data-skill-group]"))) {
    throw new Error("戰技列必須位於戰技分組章節 (data-skill-group) 內");
  }
  const sections = [...document.querySelectorAll("[data-skill-group]")];
  if (!sections.length) return;
  if (!Object.keys(data.skills).length || !Object.keys(data.weapons).length) throw new Error("頁面需載入 armaments/weapons 與 armaments/skills");
  if (!Object.keys(data.effects).length) throw new Error("頁面需載入遺物大類檔");
  const groups = sections.map((section) => section.dataset.skillGroup);
  const missing = Object.keys(data.skillGroups).filter((key) => !groups.includes(key));
  if (missing.length || new Set(groups).size !== groups.length) throw new Error(`戰技分組章節必須與分組一一對應：${missing.join("、")}`);
  const listed = [];
  const fill = (container, entries) => {
    if (entries.length === 0) throw new Error(`戰技章節沒有項目：${container.dataset.skillGroup ?? container.dataset.skillWeaponType}`);
    container.querySelector("[data-skill-rows]").replaceChildren(...entries.map(([id, skill]) => skillRow(data, id, skill)));
    listed.push(...entries.map(([id]) => id));
  };
  const skills = Object.entries(data.skills).sort(([a], [b]) => Number(a) - Number(b));
  for (const section of sections) {
    const key = section.dataset.skillGroup;
    section.querySelector("h2").textContent = lookup(data.skillGroups, key, "戰技分組").name.zh;
    const members = skills.filter(([, skill]) => skill.group === key);
    const subs = [...section.querySelectorAll("[data-skill-weapon-type]")];
    if (!subs.length) {
      fill(section, members);
      continue;
    }
    const types = subs.map((sub) => sub.dataset.skillWeaponType);
    const needed = new Set(members.map(([id]) => skillWeaponType(data, id)));
    if (types.length !== needed.size || !types.every((type) => needed.has(type))) {
      throw new Error(`戰技小節必須與該組戰技的武器種類一一對應：${key}`);
    }
    for (const sub of subs) {
      const type = sub.dataset.skillWeaponType;
      sub.querySelector("h3").textContent = tagName(data, "weaponType", type);
      fill(sub, members.filter(([id]) => skillWeaponType(data, id) === type));
    }
  }
  if (listed.length !== skills.length || new Set(listed).size !== listed.length) throw new Error("戰技沒有在各章恰好出現一次");
}

// ---------- 角色頁 ----------
// <section data-nightfarer="<角色鍵>">：h2 填角色圖示與名稱，其後依角色資料產生能力、技藝與絕活表，
// 與該角色專屬遺物詞條章節的連結。每名角色恰好一個章節。
// <div data-nightfarer-grades>：能力加成表，全部角色各一列。
// <div data-nightfarer-levels>：各等級能力表，可切換單一角色或全部角色比較一項能力值。
// 名稱與說明是本站依官方簡體中文轉寫的繁體中文；錨點以外的等級與三項上限是匯入程式的計算值 (見 LORE)。
const ABILITY_KINDS = ["passive", "skill", "art"];
const GRADE_STATS = ["maxHp", "maxFp", "maxStamina", "strength", "dexterity", "intelligence", "faith", "arcane"];
const LEVEL_STATS = ["vigor", "mind", "endurance", "strength", "dexterity", "intelligence", "faith", "arcane", "maxHp", "maxFp", "maxStamina"];
const GRADES = ["S", "A", "B", "C", "D"];
// 三項上限在每個等級都是本站計算值，比較模式不以粗體標示
const CAP_STATS = ["maxHp", "maxFp", "maxStamina"];
const LEVELS = Array.from({ length: 15 }, (_, index) => String(index + 1));

function dataTable(heads, rows, tableClass) {
  const head = el("thead", {}, el("tr", {}, ...heads.map((text) => el("th", {}, text))));
  return el("div", { class: "table-wrap" }, el("table", tableClass ? { class: tableClass } : {}, head, el("tbody", {}, ...rows)));
}

// 具體數值欄：技藝先列冷卻時間 (0 為無冷卻)，再逐條列出 effects。依參數撰寫的條目只有 game-params 來源，不另列來源；
// 社群記載的機制摘要在句末附來源連結。note 是參數與社群記載不同時的註記，以次要文字接在該條之後。
// 格式錯誤時丟出錯誤 (頁面顯示載入失敗)，不靜默顯示空白或 undefined。
const nonBlank = (value) => typeof value === "string" && value.trim() !== "";
const sourceList = (value) => Array.isArray(value) && value.length > 0 && value.every(nonBlank);
function effectLine(data, text, sources, note) {
  const labels = data.labels.nightfarers;
  if (!nonBlank(text) || !sourceList(sources)) throw new Error("具體數值條目必須有非空的 zh 與 sources");
  if (note !== undefined && (!nonBlank(note?.zh) || !sourceList(note?.sources))) throw new Error("具體數值的註記必須有非空的 zh 與 sources");
  const own = sources.some((id) => id !== "game-params") ? ["（", ...sourceLinks(data, sources), "）"] : [];
  const extra = note ? [el("span", { class: "sub" }, `${labels.note}：${note.zh}（`, ...sourceLinks(data, note.sources), "）")] : [];
  return el("p", {}, text, ...own, ...extra);
}

function effectsCell(data, kind, ability) {
  const labels = data.labels.nightfarers;
  const lines = [];
  if (!Array.isArray(ability.effects) || !ability.effects.length) throw new Error(`${ability.name.zh} 的具體數值必須是非空的陣列`);
  if (kind === "skill") {
    if (!Number.isFinite(ability.cooldown) || ability.cooldown < 0) throw new Error(`${ability.name.zh} 的冷卻時間必須是不小於 0 的數字`);
    const text = ability.cooldown === 0 ? labels.noCooldown : `${labels.cooldown} ${ability.cooldown} ${labels.seconds}`;
    lines.push(effectLine(data, text, ["game-params"], ability.cooldownNote));
  }
  for (const effect of ability.effects) lines.push(effectLine(data, effect.zh, effect.sources, effect.note));
  return el("td", { class: "effects" }, ...lines);
}

function abilityRow(data, kind, ability) {
  return el(
    "tr",
    {},
    el("td", { class: "item" }, itemIcon(data, ability, "48"), ability.name.zh),
    el("td", {}, data.labels.nightfarers[kind]),
    el("td", { class: "caption" }, el("p", { class: "caption-text" }, ability.summary.zh), el("p", { class: "caption-text" }, ability.description.zh)),
    effectsCell(data, kind, ability)
  );
}

// 等級資料：頁面載入時先檢查全部角色，切換時不會遇到格式錯誤。
function checkLevels(key, nightfarer) {
  const { levels, anchorLevels } = nightfarer;
  const keys = Object.keys(levels ?? {});
  if (keys.length !== LEVELS.length || !LEVELS.every((level) => keys.includes(level))) throw new Error(`角色 ${key} 的等級必須恰為 1–15`);
  for (const level of LEVELS) {
    const values = levels[level];
    if (Object.keys(values ?? {}).length !== LEVEL_STATS.length || !LEVEL_STATS.every((stat) => Number.isFinite(values[stat]))) {
      throw new Error(`角色 ${key} 等級 ${level} 必須恰有 ${LEVEL_STATS.join("、")}，且皆為數字`);
    }
  }
  const valid = (level) => Number.isInteger(level) && level >= 1 && level <= LEVELS.length;
  if (!Array.isArray(anchorLevels) || !anchorLevels.length || new Set(anchorLevels).size !== anchorLevels.length || !anchorLevels.every(valid)) {
    throw new Error(`角色 ${key} 的參數等級必須是不重複的 1–15 整數清單`);
  }
}

// 各等級能力表，兩種模式的列都是等級 1–15：
// 單一角色：欄為 11 個數值，參數等級的等級數字以粗體標示。
// 全部角色比較：欄為各角色的同一項數值；基本能力值在該角色參數等級的格子以粗體標示，三項上限不加粗。
function levelTable(data, keys, mode, pick) {
  const labels = data.labels.nightfarers;
  const isAnchor = (nightfarer, level) => nightfarer.anchorLevels.includes(Number(level));
  if (mode === "character") {
    const nightfarer = data.nightfarers[pick];
    const rows = LEVELS.map((level) => {
      const label = isAnchor(nightfarer, level) ? el("strong", {}, level) : level;
      return el("tr", {}, el("td", {}, label), ...LEVEL_STATS.map((stat) => el("td", {}, String(nightfarer.levels[level][stat]))));
    });
    return dataTable([labels.level, ...LEVEL_STATS.map((stat) => statName(data, stat))], rows);
  }
  const bold = !CAP_STATS.includes(pick);
  const cell = (key, level) => {
    const nightfarer = data.nightfarers[key];
    const value = String(nightfarer.levels[level][pick]);
    return el("td", {}, bold && isAnchor(nightfarer, level) ? el("strong", {}, value) : value);
  };
  const rows = LEVELS.map((level) => el("tr", {}, el("td", {}, level), ...keys.map((key) => cell(key, level))));
  return dataTable([labels.level, ...keys.map((key) => lookup(data.characters, key, "角色").name.zh)], rows);
}

// 各等級能力表的圖表。單一角色：三張折線圖，第三張的 HP 上限用右側縱軸、FP 與精力上限用左側縱軸。
// 全部角色比較：選定等級的排序橫條圖。刻度由全部角色、全部等級的資料推算，切換角色或等級時不變，才能比較高低。
const LEVEL_CHARTS = [
  { left: ["vigor", "mind", "endurance"], right: [] },
  { left: ["strength", "dexterity", "intelligence", "faith", "arcane"], right: [] },
  { left: ["maxFp", "maxStamina"], right: ["maxHp"] },
];
// 線型是顏色以外的第二種區分方式，依系列順序對應色票 --series-1 起
const DASHES = ["", "6 4", "2 3", "8 3 2 3", "12 4"];
const SVG_NS = "http://www.w3.org/2000/svg";

function svgEl(tag, attrs = {}, ...children) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  node.append(...children);
  return node;
}

// 刻度：約 4 格，每格是 1、2、5 乘以 10 的次方，上限取能容納最大值的格數
function axisScale(max) {
  const raw = Math.max(max, 1) / 4;
  const power = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((factor) => factor * power).find((value) => value >= raw);
  return { step, top: Math.ceil(Math.max(max, 1) / step) * step };
}

function statMax(data, keys, stats) {
  return Math.max(...keys.flatMap((key) => LEVELS.flatMap((level) => stats.map((stat) => data.nightfarers[key].levels[level][stat]))));
}

// 圖例兼讀值：線型樣本、名稱 (右軸系列加註)、所選等級的數值
function chartLegend(data, chart, values) {
  const series = [...chart.right, ...chart.left];
  return el(
    "ul",
    { class: "chart-legend" },
    ...series.map((stat, index) => {
      const key = svgEl("svg", { width: "24", height: "10", "aria-hidden": "true" });
      key.append(svgEl("line", { x1: "0", y1: "5", x2: "24", y2: "5", class: `series series-${index + 1}`, "stroke-dasharray": DASHES[index] }));
      const name = chart.right.includes(stat) ? `${statName(data, stat)}${data.labels.nightfarers.rightAxis}` : statName(data, stat);
      return el("li", {}, key, name, " ", el("strong", {}, String(values[stat])));
    })
  );
}

// 折線圖：15 個等級的已存數值以直線相連；基本能力值在參數等級畫實心點，三項上限不畫；直線標示所選等級。
// 在圖上移動或點按會選最近的等級 (onLevel)。
function lineChart(data, nightfarer, chart, scales, level, width, onLevel) {
  const series = [...chart.right, ...chart.left];
  // 三張圖的左右邊距相同 (右側都保留右軸刻度的寬度)，上下對齊時同一等級在同一位置
  const margin = { top: 10, right: 40, bottom: 26, left: 34 };
  const plotH = 170;
  const plotW = Math.max(width - margin.left - margin.right, 120);
  const svgW = plotW + margin.left + margin.right;
  const svgH = plotH + margin.top + margin.bottom;
  const x = (lvl) => margin.left + ((Number(lvl) - 1) / (LEVELS.length - 1)) * plotW;
  const y = (scale, value) => margin.top + plotH * (1 - value / scale.top);
  const names = series.map((stat) => statName(data, stat)).join("、");
  const svg = svgEl("svg", { class: "level-chart", width: String(svgW), height: String(svgH), viewBox: `0 0 ${svgW} ${svgH}`, role: "img", "aria-label": names });
  const ticks = (scale) => Array.from({ length: scale.top / scale.step + 1 }, (_, index) => index * scale.step);
  for (const value of ticks(scales.left)) {
    const at = y(scales.left, value);
    svg.append(svgEl("line", { class: "grid", x1: String(margin.left), x2: String(margin.left + plotW), y1: String(at), y2: String(at) }));
    svg.append(svgEl("text", { class: "tick", x: String(margin.left - 6), y: String(at), "text-anchor": "end", "dominant-baseline": "middle" }, String(value)));
  }
  if (chart.right.length) {
    for (const value of ticks(scales.right)) {
      const at = y(scales.right, value);
      svg.append(svgEl("text", { class: "tick", x: String(margin.left + plotW + 6), y: String(at), "dominant-baseline": "middle" }, String(value)));
    }
  }
  // 等級刻度：空間不足時只標 1、5、10、15
  const dense = plotW / (LEVELS.length - 1) >= 20;
  for (const lvl of LEVELS.filter((value) => dense || ["1", "5", "10", "15"].includes(value))) {
    svg.append(svgEl("text", { class: "tick", x: String(x(lvl)), y: String(margin.top + plotH + 18), "text-anchor": "middle" }, lvl));
  }
  svg.append(svgEl("line", { class: "level-marker", x1: String(x(level)), x2: String(x(level)), y1: String(margin.top), y2: String(margin.top + plotH) }));
  series.forEach((stat, index) => {
    const scale = chart.right.includes(stat) ? scales.right : scales.left;
    const points = LEVELS.map((lvl) => `${x(lvl)},${y(scale, nightfarer.levels[lvl][stat])}`).join(" ");
    svg.append(svgEl("polyline", { class: `series series-${index + 1}`, points, "stroke-dasharray": DASHES[index] }));
    if (CAP_STATS.includes(stat)) return;
    for (const lvl of nightfarer.anchorLevels) {
      svg.append(svgEl("circle", { class: `dot series-${index + 1}`, cx: String(x(lvl)), cy: String(y(scale, nightfarer.levels[lvl][stat])), r: "4" }));
    }
  });
  const hit = svgEl("rect", { class: "hit", x: String(margin.left - 10), y: "0", width: String(plotW + 20), height: String(svgH) });
  const pick = (event) => {
    const bounds = svg.getBoundingClientRect();
    const at = ((event.clientX - bounds.left) * svgW) / bounds.width;
    const nearest = Math.round(((at - margin.left) / plotW) * (LEVELS.length - 1)) + 1;
    onLevel(String(Math.min(Math.max(nearest, 1), LEVELS.length)));
  };
  hit.addEventListener("pointermove", pick);
  hit.addEventListener("pointerdown", pick);
  svg.append(hit);
  const values = Object.fromEntries(series.map((stat) => [stat, nightfarer.levels[level][stat]]));
  return el("div", { class: "level-figure" }, chartLegend(data, chart, values), svg);
}

// 排序橫條圖：所選等級的數值由高到低，同值依角色章節順序；橫條長度以該能力值的共同刻度計算。
function barChart(data, keys, stat, level, scale) {
  const rows = keys
    .map((key, index) => ({ key, index, value: data.nightfarers[key].levels[level][stat] }))
    .sort((a, b) => b.value - a.value || a.index - b.index);
  return el(
    "ol",
    { class: "bar-chart" },
    ...rows.map(({ key, value }) => {
      const bar = el("span", { class: "bar" });
      bar.style.width = `${(value / scale.top) * 100}%`;
      const name = lookup(data.characters, key, "角色").name.zh;
      return el("li", {}, el("span", { class: "bar-name" }, name), el("span", { class: "bar-value" }, String(value)), el("span", { class: "bar-track" }, bar));
    })
  );
}

// 各等級能力表的控制項：「單一角色／全部角色比較」單選鈕，下方的選單依模式選角色或能力值；兩個選單各自保留選擇。
// 等級控制條兩種模式共用，預設 15 級：單一角色時決定圖例顯示的數值與標示線，比較時決定橫條圖的等級。
// 圖表下方是收合的數值表 (15 級精確數值)，切換時保留展開狀態。
// 原本各角色小節的 id character-<角色>-levels 留在容器開頭的空元素上：網址是這些錨點時 (載入或 hashchange，
// 含上一頁／下一頁)，切到該角色的單一角色模式。手動切換後，網址若仍是這類錨點，改為 #levels，避免指向其他角色。
// 切換時出錯：移除控制項與圖表並顯示載入失敗，不留下與選單不符的內容。
function levelChapter(data, keys, container) {
  const labels = data.labels.nightfarers;
  const characterName = (key) => lookup(data.characters, key, "角色").name.zh;
  const radio = (value, text) => el("label", {}, el("input", { type: "radio", name: "level-mode", value }), text);
  const modes = el("fieldset", { class: "level-controls" }, el("legend", {}, labels.levelMode), radio("character", labels.levelSingle), radio("stat", labels.levelCompare));
  const select = (values, name) => el("select", {}, ...values.map((value) => el("option", { value }, name(value))));
  const characterSelect = select(keys, characterName);
  const statSelect = select(LEVEL_STATS, (stat) => statName(data, stat));
  const characterPick = el("label", { class: "level-pick" }, labels.character, characterSelect);
  const statPick = el("label", { class: "level-pick" }, labels.stat, statSelect);
  const levelInput = el("input", { type: "range", min: "1", max: String(LEVELS.length), step: "1", value: String(LEVELS.length) });
  const levelOutput = el("output", {}, String(LEVELS.length));
  const levelPick = el("label", { class: "level-pick" }, labels.level, levelInput, levelOutput);
  const status = el("p", { class: "level-view", role: "status" });
  const charts = el("div", { class: "level-charts" });
  const tableSlot = el("div");
  const table = el("details", { class: "level-table" }, el("summary", {}, labels.valueTable), tableSlot);
  const anchors = keys.map((key) => el("div", { id: `character-${key}-levels` }));
  container.replaceChildren(...anchors, modes, characterPick, statPick, levelPick, status, charts, table);
  const scales = new Map(LEVEL_CHARTS.map((chart) => [chart, { left: axisScale(statMax(data, keys, chart.left)), right: chart.right.length ? axisScale(statMax(data, keys, chart.right)) : null }]));
  const statScales = new Map(LEVEL_STATS.map((stat) => [stat, axisScale(statMax(data, keys, [stat]))]));
  const setMode = (mode) => (modes.querySelector(`input[value="${mode}"]`).checked = true);
  const compare = () => modes.querySelector("input:checked").value === "stat";
  const oldAnchor = /^#character-(.+)-levels$/;
  let drawnWidth = 0;
  function draw() {
    const level = levelInput.value;
    levelOutput.textContent = level;
    drawnWidth = charts.clientWidth;
    if (compare()) {
      charts.replaceChildren(barChart(data, keys, statSelect.value, level, statScales.get(statSelect.value)));
      return;
    }
    const nightfarer = data.nightfarers[characterSelect.value];
    const onLevel = guarded((value) => {
      if (value === levelInput.value) return;
      levelInput.value = value;
      draw();
    });
    charts.replaceChildren(...LEVEL_CHARTS.map((chart) => lineChart(data, nightfarer, chart, scales.get(chart), level, drawnWidth, onLevel)));
  }
  function show() {
    const stat = compare();
    const pick = stat ? statSelect.value : characterSelect.value;
    characterPick.hidden = stat;
    statPick.hidden = !stat;
    status.textContent = stat ? `${statName(data, pick)}：${labels.levelCompare}` : `${characterName(pick)}：${labels.levels}`;
    tableSlot.replaceChildren(levelTable(data, keys, stat ? "stat" : "character", pick));
    labelTableCells();
    draw();
  }
  function fromHash() {
    const key = oldAnchor.exec(location.hash)?.[1];
    if (!keys.includes(key)) return;
    setMode("character");
    characterSelect.value = key;
    show();
  }
  function onChange() {
    if (oldAnchor.test(location.hash)) history.replaceState(null, "", "#levels");
    show();
  }
  // 出錯一次後停止本章所有處理 (hashchange、寬度改變等仍會觸發)，不重複顯示錯誤
  let stopped = false;
  function guarded(handler) {
    return (...args) => {
      if (stopped) return;
      try {
        handler(...args);
      } catch (error) {
        stopped = true;
        container.replaceChildren();
        showError(error);
      }
    };
  }
  for (const control of [modes, characterSelect, statSelect]) control.addEventListener("change", guarded(onChange));
  levelInput.addEventListener("input", guarded(draw));
  addEventListener("hashchange", guarded(fromHash));
  // 寬度改變時重畫圖表 (文字大小不變，不把整張圖縮放)
  new ResizeObserver(guarded(() => charts.isConnected && charts.clientWidth !== drawnWidth && draw())).observe(charts);
  setMode("character");
  // 首次繪製也走同一錯誤處理：出錯時同樣移除控制項、圖表與表格
  guarded(() => {
    show();
    fromHash();
  })();
}

// 能力加成表：每名角色一列，依角色章節順序；列 id 沿用原本各角色小節的 character-<角色>-grades，舊連結仍可使用。
function gradeRow(data, key, nightfarer) {
  const grades = nightfarer.grades;
  const keys = Object.keys(grades ?? {});
  if (keys.length !== GRADE_STATS.length || !GRADE_STATS.every((stat) => GRADES.includes(grades[stat]))) {
    throw new Error(`角色 ${key} 的能力加成必須恰有 ${GRADE_STATS.join("、")}，且評級為 ${GRADES.join("、")}`);
  }
  const character = lookup(data.characters, key, "角色");
  const name = el("a", { href: `#character-${key}` }, character.name.zh);
  const cells = GRADE_STATS.map((stat) => el("td", {}, grades[stat]));
  return el("tr", { id: `character-${key}-grades` }, el("td", { class: "item" }, iconNode(data, character.icon, "48"), name), ...cells);
}

// 角色章節放在 <div data-nightfarer-list> 內 (角色頁)；其他頁面沒有此容器，也不可有角色章節、能力加成表或各等級能力表。
// 角色頁恰有一個能力加成表容器與一個各等級能力表容器。
function nightfarerChapters(data) {
  const list = document.querySelector("[data-nightfarer-list]");
  const sections = [...document.querySelectorAll("[data-nightfarer]")];
  const gradeTables = document.querySelectorAll("[data-nightfarer-grades]");
  const levelTables = document.querySelectorAll("[data-nightfarer-levels]");
  if (!list) {
    if (sections.length) throw new Error("角色章節必須放在 data-nightfarer-list 內");
    if (gradeTables.length || levelTables.length) throw new Error("能力加成表與各等級能力表只能放在角色頁");
    return;
  }
  if (gradeTables.length !== 1) throw new Error("角色頁必須恰有一個能力加成表");
  if (levelTables.length !== 1) throw new Error("角色頁必須恰有一個各等級能力表");
  if (sections.some((section) => !list.contains(section))) throw new Error("角色章節必須放在 data-nightfarer-list 內");
  const keys = sections.map((section) => section.dataset.nightfarer);
  for (const key of Object.keys(data.characters)) {
    if (keys.filter((k) => k === key).length !== 1) throw new Error(`角色 ${key} 必須恰有一個章節`);
  }
  const labels = data.labels.nightfarers;
  for (const section of sections) {
    const key = section.dataset.nightfarer;
    const character = lookup(data.characters, key, "角色");
    const nightfarer = lookup(data.nightfarers, key, "角色資料");
    const heading = section.querySelector("h2");
    heading.replaceChildren(iconNode(data, character.icon, "24"), character.name.zh);
    // 小節標題：id 為「章節 id-小節」，頁首依此顯示目前所在小節
    const sub = (suffix, text) => el("h3", { id: `${heading.id}-${suffix}` }, text);
    const relics = el("a", { href: `relics-character.html#character-${key}` }, character.name.zh);
    section.append(
      sub("abilities", labels.abilities),
      dataTable([labels.name, labels.kind, labels.description, labels.effects], ABILITY_KINDS.map((kind) => abilityRow(data, kind, nightfarer[kind])), "abilities"),
      el("p", {}, `${labels.relics}：`, relics)
    );
  }
  const gradeRows = keys.map((key) => gradeRow(data, key, data.nightfarers[key]));
  gradeTables[0].replaceChildren(dataTable([labels.character, ...GRADE_STATS.map((stat) => statName(data, stat))], gradeRows));
  for (const key of keys) checkLevels(key, data.nightfarers[key]);
  levelChapter(data, keys, levelTables[0]);
}

// 武器數值欄 (皆為遊戲參數原始值，不是遊戲內顯示值)：基礎攻擊與能力補正每項一行、只列非 0 項；
// 特殊效果列出不是 1 的致命補正 (多數武器為 1)、固定效果名稱與命中時的異常狀態累積。沒有可列內容的欄顯示「—」。
// 數值只來自遊戲參數，沒有未核實或來源分歧的狀態：缺鍵、多鍵或不是數字時報錯，不顯示成 0 或「—」。
const SCALING_STATS = ["strength", "dexterity", "intelligence", "faith", "arcane"];
function weaponCells(data, id, weapon) {
  const labels = data.labels.armaments;
  const check = (values, keys, what) => {
    const ok = values && typeof values === "object" && Object.keys(values).length === keys.length && keys.every((key) => Number.isFinite(values[key]));
    if (!ok) throw new Error(`武器${what}必須是 ${keys.join("、")} 的數字（武器 ${id}）`);
  };
  check(weapon.attack, Object.keys(labels.attack), "基礎攻擊");
  check(weapon.scaling, SCALING_STATS, "能力補正");
  check({ critical: weapon.critical }, ["critical"], "致命補正");
  check(weapon.buildup, Object.keys(weapon.buildup ?? {}), "命中累積");
  for (const key of Object.keys(weapon.buildup)) lookup(labels.ailments, key, "異常狀態");
  if (weapon.passive !== null && typeof weapon.passive?.zh !== "string") throw new Error(`武器固定效果必須是名稱或 null（武器 ${id}）`);
  const lines = (parts) => (parts.length ? parts.map((part) => el("span", { class: "entry" }, part)) : [labels.none]);
  const nonZero = (values, nameOf) => Object.entries(values).filter(([, value]) => value !== 0).map(([key, value]) => `${nameOf(key)} ${value}`);
  const special = [
    ...(weapon.critical !== 1 ? [`${labels.critical} ${weapon.critical}`] : []),
    ...(weapon.passive ? [weapon.passive.zh] : []),
    ...Object.entries(weapon.buildup).map(([key, value]) => `${labels.buildup}${lookup(labels.ailments, key, "異常狀態")} ${value}`),
  ];
  return [
    el("td", { class: "stats" }, ...lines(nonZero(weapon.attack, (key) => lookup(labels.attack, key, "攻擊屬性")))),
    el("td", { class: "stats" }, ...lines(nonZero(weapon.scaling, (key) => statName(data, key)))),
    el("td", { class: "stats" }, ...lines(special)),
    weaponSkillCell(data, id, weapon),
  ];
}

// <section data-weapon-type="<type>">：武器種類章節。h2 填種類名稱，章首列出相關遺物詞條，
// [data-chapter-rows] 依 sortId 列出該種類的具名武器與數值；列 id 為 weapon-<id>，是遺物頁「相關武器、法術與戰技」連結的目標。
function weaponChapter(data, section) {
  const type = section.dataset.weaponType;
  section.querySelector("h2").textContent = lookup(data.tags.weaponType, type, "武器種類").name.zh;
  fillChapterEffects(data, section, { weaponType: [type] });
  const weapons = Object.entries(data.weapons)
    .filter(([, weapon]) => weapon.name && weapon.tags.weaponType?.includes(type))
    .sort(([, a], [, b]) => a.sortId - b.sortId);
  if (weapons.length === 0) throw new Error(`武器種類沒有具名武器：${type}`);
  section
    .querySelector("[data-chapter-rows]")
    .replaceChildren(
      ...weapons.map(([id, weapon]) =>
        el("tr", { id: `weapon-${id}` }, el("td", { class: "item" }, itemNameNode(data, id, weapon)), ...weaponCells(data, id, weapon))
      )
    );
}

// 法術消耗欄 (遊戲參數原始值，尚未套用減少消耗的效果)：FP、耐力各一欄，第一行為通常施放，有蓄力消耗參數時第二行為「蓄力參數 <值>」。
// 蓄力參數只照原值列出：不判定法術是否支援蓄力，0 不代表實際不消耗。
// 數值只來自遊戲參數：cost 缺少或不是數字、chargeCost 不是 null 也不是數字時報錯。
function spellCostCells(data, id, spell) {
  const valid = (value) => value && Object.keys(value).length === 2 && Number.isFinite(value.fp) && Number.isFinite(value.stamina);
  if (!valid(spell.cost) || !(spell.chargeCost === null || valid(spell.chargeCost))) throw new Error(`法術消耗必須是 FP 與耐力的數字（法術 ${id}）`);
  const cell = (key) =>
    el(
      "td",
      { class: "stats" },
      el("span", { class: "entry" }, String(spell.cost[key])),
      ...(spell.chargeCost ? [el("span", { class: "entry sub" }, `${data.labels.armaments.charge} ${spell.chargeCost[key]}`)] : [])
    );
  return [cell("fp"), cell("stamina")];
}

// <section data-spell-type="<type>">：類型章節，只列以該類型為條件的詞條。
// 再加 data-spell-school="<school>" (空字串為無已定義系別)：系別章節。章首列出類型章節未列的詞條，[data-chapter-rows] 依 ID 列出
// 系別恰為該系別的法術 (列 id 為 spell-<id>)；只針對個別法術的詞條 (targets.spell) 列在法術名稱下方。回傳本章列出的法術 ID。
function spellChapter(data, section) {
  const type = section.dataset.spellType;
  lookup(data.tags.spellType, type, "法術類型");
  const typeTags = { spellType: [type] };
  const school = section.dataset.spellSchool;
  if (school === undefined) {
    fillChapterEffects(data, section, typeTags);
    return [];
  }
  const tags = { spellType: [type], spellSchool: school ? [school] : [] };
  section.querySelector("h2").textContent = school ? tagName(data, "spellSchool", school) : data.labels.armaments.noSchool;
  fillChapterEffects(data, section, tags, typeTags);
  const sameList = (value, wanted) => Array.isArray(value) && value.length === wanted.length && value.every((key) => wanted.includes(key));
  const spells = Object.entries(data.spells)
    .filter(([id, spell]) => spellPage(id, spell) === SPELL_PAGES[type] && sameList(spell.tags.spellSchool, tags.spellSchool))
    .sort(([idA], [idB]) => Number(idA) - Number(idB));
  if (spells.length === 0) throw new Error(`法術章節沒有項目：${type} ${school}`);
  const rows = spells.map(([id, spell]) => {
    const own = inlineTargets(data, { ...spell.tags, spell: [id] }, tags);
    const name = el("td", { class: "item" }, itemNameNode(data, id, spell), ...(own.length ? [el("span", { class: "item-targets" }, ...own)] : []));
    return el("tr", { id: `spell-${id}` }, name, ...spellCostCells(data, id, spell), el("td", { class: "names" }, ...carrierEntries(data, id)));
  });
  section.querySelector("[data-chapter-rows]").replaceChildren(...rows);
  return spells.map(([id]) => id);
}

// 章節必須涵蓋全部項目：武器頁每個武器種類標籤恰有一章；魔法、禱告頁該類型的每個法術恰在一章出現一次。
function renderChapters(data) {
  const weaponTypes = [...document.querySelectorAll("[data-weapon-type]")].map((section) => {
    weaponChapter(data, section);
    return section.dataset.weaponType;
  });
  if (weaponTypes.length) {
    const missing = Object.keys(data.tags.weaponType).filter((type) => !weaponTypes.includes(type));
    if (missing.length || new Set(weaponTypes).size !== weaponTypes.length) throw new Error(`武器種類章節必須與標籤一一對應：${missing.join("、")}`);
  }
  const listed = new Map();
  for (const section of document.querySelectorAll("[data-spell-type]")) {
    const type = section.dataset.spellType;
    listed.set(type, [...(listed.get(type) ?? []), ...spellChapter(data, section)]);
  }
  for (const [type, ids] of listed) {
    const expected = Object.entries(data.spells).filter(([id, spell]) => spellPage(id, spell) === SPELL_PAGES[type]).map(([id]) => id);
    if (ids.length !== expected.length || !expected.every((id) => ids.includes(id))) throw new Error(`法術沒有在各章恰好出現一次：${type}`);
  }
}

// <tbody data-unlisted-spells>：類型無法核實的法術引用 (武器頁的查證限制)，列出類型、系別、搭載法器與全部相關遺物詞條。
function unlistedSpellRows(data) {
  const rows = Object.entries(data.spells)
    .filter(([id, spell]) => spellPage(id, spell) === "weapons.html")
    .sort(([idA], [idB]) => Number(idA) - Number(idB));
  if (rows.length === 0) throw new Error("沒有類型未核實的法術");
  return rows.map(([id, spell]) =>
    el(
      "tr",
      { id: `spell-${id}` },
      el("td", { class: "item" }, itemNameNode(data, id, spell)),
      el("td", { class: "school" }, ...tagEntries(data, "spellType", spell.tags.spellType, "")),
      el("td", { class: "school" }, ...tagEntries(data, "spellSchool", spell.tags.spellSchool, data.labels.armaments.noSchool)),
      el("td", { class: "names" }, ...carrierEntries(data, id)),
      // 法術以自身 ID 比對指定法術的詞條 (targets.spell)
      el("td", { class: "targets" }, ...targetEntries(data, { ...spell.tags, spell: [id] }))
    )
  );
}

function render(data) {
  // 角色專屬子分類以渡夜者命名，名稱前附角色圖示。
  // <aside data-legend>：遺物頁底部的顏色圖例，依 common.json 的 legend 產生；說明在滑鼠移上或聚焦時顯示。
  for (const node of document.querySelectorAll("[data-legend]")) {
    node.replaceChildren(
      ...data.legend.map(({ tone, label, tip }) => el("span", { class: `tone-${tone}`, tabindex: "0", "data-tip": tip }, label))
    );
  }
  for (const node of document.querySelectorAll("[data-subcategory-name]")) {
    const sub = lookup(data.subcategories, node.dataset.subcategoryName, "子分類");
    const icon = sub.character ? [iconNode(data, lookup(data.characters, sub.character, "角色").icon, "24")] : [];
    node.replaceChildren(...icon, sub.name.zh);
  }
  for (const node of document.querySelectorAll("[data-relic-table]")) {
    node.replaceChildren(...relicRows(data, node.dataset.relicTable));
  }
  renderChapters(data);
  for (const node of document.querySelectorAll("[data-unlisted-spells]")) node.replaceChildren(...unlistedSpellRows(data));
  skillChapters(data);
  nightfarerChapters(data);
  for (const node of document.querySelectorAll("[data-stat-effects]")) node.replaceChildren(...statEntries(data, node.dataset.statEffects));
  for (const node of document.querySelectorAll("[data-game-version]")) node.textContent = data.gameVersion;
  for (const node of document.querySelectorAll("[data-item]")) {
    const [kind, id] = node.dataset.item.split(":");
    node.replaceChildren(itemName(data, kind, id));
  }
  for (const node of document.querySelectorAll("[data-tier-text]")) {
    const [id, tier] = node.dataset.tierText.split(":");
    const effect = lookup(data.effects, id, "效果");
    node.textContent = tierText(data, effect, Number(tier));
    node.classList.add(toneClass(data, effect, tierStacks(effect, effect.tiers.find((t) => t.tier === Number(tier)))));
  }
  for (const node of document.querySelectorAll("[data-example]")) {
    const effect = lookup(data.effects, node.dataset.effect, "效果");
    node.textContent =
      node.dataset.example === "tier-sum"
        ? tierSumExample(data, effect, node.dataset.tierList.split(",").map(Number))
        : stackExample(data, effect, Number(node.dataset.count));
    node.classList.add(toneClass(data, effect, effectStacks(effect)));
  }
  for (const node of document.querySelectorAll("[data-sources]")) {
    const ids = node.dataset.sources.split(" ").flatMap((id) => effectSources(lookup(data.effects, id, "效果")));
    node.replaceChildren(...sourceLinks(data, [...new Set(ids)]));
  }
  for (const node of document.querySelectorAll("[data-character]")) {
    node.textContent = characterValue(data, node.dataset.character);
  }
  // 圖片來源：列出全站圖示的 wiki 檔案頁，同一檔案頁只列一次。
  for (const node of document.querySelectorAll("[data-icon-sources]")) {
    const pages = new Set();
    const icons = Object.values(data.icons).filter((icon) => icon.page && !pages.has(icon.page) && pages.add(icon.page));
    const links = icons.map((icon) => el("a", { href: icon.page, target: "_blank", rel: "noopener noreferrer" }, icon.alt));
    node.replaceChildren(...links.flatMap((link, index) => (index > 0 ? ["、", link] : [link])));
  }
  // 最後一步：表格內容都已填入
  labelTableCells();
}

// 窄螢幕的表格逐列直排 (styles.css)，每格前面以小字顯示欄名：把表頭文字寫到同欄各格的 data-label，
// 第一欄是名稱，不加。直排把表格元素改為 block，部分瀏覽器因此失去表格語意，所以明確補上 role。
function labelTableCells() {
  for (const table of document.querySelectorAll("main table")) {
    if (table.tHead?.rows.length !== 1) throw new Error("表格必須有一列表頭");
    const heads = [...table.tHead.rows[0].cells].map((cell) => cell.textContent.trim());
    table.setAttribute("role", "table");
    for (const group of [table.tHead, ...table.tBodies]) group.setAttribute("role", "rowgroup");
    for (const row of table.rows) {
      if (row.cells.length !== heads.length) throw new Error(`表格列的格數與表頭不符：${heads.join("｜")}`);
      row.setAttribute("role", "row");
      [...row.cells].forEach((cell, index) => {
        cell.setAttribute("role", cell.tagName === "TH" ? "columnheader" : "cell");
        if (cell.tagName === "TD" && index > 0) cell.dataset.label = heads[index];
      });
    }
  }
}

function showError(error) {
  console.error(error);
  const notice = el("p", { class: "load-error", role: "alert" }, "遊戲數值載入失敗，頁面中的數值無法顯示。請重新整理頁面。");
  document.querySelector("main").prepend(notice);
}

function loadJson(name) {
  const url = `data/${name}.json`;
  return fetch(url).then((response) => {
    if (!response.ok) throw new Error(`${url}：HTTP ${response.status}`);
    return response.json();
  });
}

// 合併 common 與其他資料檔：遺物大類檔 (有 category)、武器檔 (weapons)、法術檔 (spells)、戰技檔 (skills)、角色檔 (nightfarers)。
// 效果鍵、遊戲內 ID、子分類鍵、武器、法術、戰技 ID 或角色鍵重複時丟出錯誤，不以後者覆蓋前者；ID 唯一性依實體種類各自檢查。
// 有載入角色檔時，其角色鍵必須與 common.json 的 characters 相同。
function mergeData([common, ...files]) {
  const data = { ...common, effects: {}, subcategories: {}, weapons: {}, spells: {}, skills: {}, nightfarers: {} };
  const gameIds = new Set();
  const claim = (id, owner) => {
    if (gameIds.has(id)) throw new Error(`遊戲內 ID 重複：${id}（${owner}）`);
    gameIds.add(id);
  };
  const relicFiles = [];
  const loaded = new Set();
  for (const file of files) {
    if (file.category) {
      relicFiles.push(file);
      continue;
    }
    const kinds = Object.keys(file);
    if (kinds.length !== 1 || !["weapons", "spells", "skills", "nightfarers"].includes(kinds[0])) throw new Error(`無法辨識的資料檔：${kinds.join("、")}`);
    for (const [id, item] of Object.entries(file[kinds[0]])) {
      if (data[kinds[0]][id]) throw new Error(`${kinds[0]} ID 重複：${id}`);
      data[kinds[0]][id] = item;
    }
    loaded.add(kinds[0]);
  }
  const spellsLoaded = loaded.has("spells");
  for (const file of relicFiles) {
    for (const sub of file.category.subcategories) {
      if (data.subcategories[sub.id]) throw new Error(`子分類重複：${sub.id}`);
      data.subcategories[sub.id] = { ...sub, category: file.category.id };
    }
    for (const [key, effect] of Object.entries(file.effects)) {
      if (data.effects[key]) throw new Error(`效果重複：${key}`);
      lookup(data.subcategories, effect.subcategory, `子分類（效果 ${key}）`);
      if (effect.gameId) claim(effect.gameId, key);
      for (const tier of effect.tiers ?? []) claim(tier.gameId, key);
      data.effects[key] = effect;
    }
  }
  checkTags(data, spellsLoaded, loaded.has("skills"));
  if (loaded.has("skills")) checkSkills(data);
  if (loaded.has("nightfarers")) {
    const [own, defined] = [Object.keys(data.nightfarers), Object.keys(data.characters)];
    if (own.length !== defined.length || !defined.every((key) => data.nightfarers[key])) throw new Error("角色資料的角色與 common.json 的 characters 不同");
  }
  return data;
}

// 有載入戰技檔時：每把具名武器都有 skill，其 default 與 pool 的每個戰技都要存在；每個戰技的 group 都要在 skillGroups 定義。
function checkSkills(data) {
  for (const [id, weapon] of Object.entries(data.weapons)) {
    if (!weapon.name) continue;
    const { skill } = weapon;
    if (typeof skill?.default !== "string" || !Array.isArray(skill.pool)) throw new Error(`武器戰技必須有 default 與 pool（武器 ${id}）`);
    for (const skillId of [skill.default, ...skill.pool]) lookup(data.skills, skillId, `戰技（武器 ${id}）`);
  }
  for (const [id, skill] of Object.entries(data.skills)) lookup(data.skillGroups, skill.group, `戰技分組（戰技 ${id}）`);
}

// 標籤與引用檢查：物品標籤、遺物相關對象的鍵都要有定義；targets.spell 是法術 ID、targets.skill 是戰技 ID，有載入法術檔、
// 戰技檔時分別檢查其存在，武器搭載的法術亦同。遺物的相關能力值 (stats) 與上限的基礎能力值 (base) 都要在 stats 定義。
function checkTags(data, spellsLoaded, skillsLoaded) {
  // isTargets：只有遺物的 targets 可用 spell (法術 ID) 與 skill (戰技 ID)；物品標籤的維度一律要在 tags 定義。
  const check = (tags, owner, isTargets) => {
    for (const [dimension, value] of Object.entries(tags)) {
      if (isTargets && dimension === "spell") {
        if (spellsLoaded) for (const id of value) lookup(data.spells, id, `法術（${owner}）`);
        continue;
      }
      if (isTargets && dimension === "skill") {
        if (skillsLoaded) for (const id of value) lookup(data.skills, id, `戰技（${owner}）`);
        continue;
      }
      const defined = lookup(data.tags, dimension, `標籤維度（${owner}）`);
      const keys = Array.isArray(value) ? value : isConflict(value) ? value.conflict.flatMap((c) => c.value) : [];
      for (const key of keys) lookup(defined, key, `標籤（${owner}）`);
    }
  };
  for (const [key, effect] of Object.entries(data.effects)) {
    for (const holder of [effect, ...(effect.tiers ?? [])]) {
      if (holder.targets) check(holder.targets, `效果 ${key}`, true);
      if (!("stats" in holder)) continue;
      // stats 只由遊戲參數產生，沒有未核實或來源分歧的狀態；出現時報錯，不當成沒有關聯。
      if (!Array.isArray(holder.stats)) throw new Error(`相關能力值必須是清單（效果 ${key}）`);
      for (const stat of holder.stats) lookup(data.stats, stat, `能力值（效果 ${key}）`);
    }
  }
  for (const [id, stat] of Object.entries(data.stats)) if (stat.base) lookup(data.stats, stat.base, `基礎能力值（${id}）`);
  for (const kind of ["weapons", "spells"]) for (const [id, item] of Object.entries(data[kind])) check(item.tags, `${kind} ${id}`, false);
  if (!spellsLoaded) return;
  for (const [id, weapon] of Object.entries(data.weapons)) {
    for (const spell of Object.values(weapon.spells ?? {})) lookup(data.spells, spell, `法術（武器 ${id} 搭載）`);
  }
}

// 瀏覽器在資料填入前就跳到網址的錨點，填入後內容變長會讓落點偏移；渲染完成後重新對準。
// 格式錯誤的錨點 (例如 #%) 無法解碼時直接忽略，不當成資料載入失敗。
// 舊的武器與法術頁 (armaments.html) 轉到武器頁；本頁沒有的法術列 (#spell-<id>) 依法術類型轉到魔法或禱告頁。
function scrollToHash(data) {
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = id && document.getElementById(id);
  if (target) {
    target.scrollIntoView({ behavior: "instant" });
    return;
  }
  const spellId = /^spell-(\d+)$/.exec(id)?.[1];
  const spell = spellId && data.spells[spellId];
  if (spell) location.replace(`${spellPage(spellId, spell)}#${id}`);
}

const files = document.body.dataset.load.split(" ");
Promise.all(files.map(loadJson))
  .then(mergeData)
  .then((data) => {
    render(data);
    return data;
  })
  // 分開一步：nav.js 先依填入的章節名稱更新頁首高度，再對準錨點
  .then(scrollToHash)
  .catch(showError);
