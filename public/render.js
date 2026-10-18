// 依 <body data-load> 列出的資料檔 (例如 "common relics/general") 讀取遊戲數值，填入頁面上的 data-* 佔位元素。
// common 放共用的能力值、圖示、角色、標籤與來源；relics/* 各放一個遺物詞條大類的分類定義與效果。
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

function lookup(table, key, kind) {
  const item = table[key];
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

function characterValue(data, path) {
  const [id, level, stat] = path.split(":");
  const character = lookup(data.characters, id, "角色");
  const value = lookup(character.levels, level, "角色等級")[stat];
  if (value === undefined) throw new Error(`找不到角色數值：${path}`);
  return value === null ? data.labels.unverified : isConflict(value) ? data.labels.conflict : String(value);
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
  return [...details, ...values, ...extras];
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

// 合併 common 與各遺物大類檔：效果鍵、遊戲內 ID 與子分類鍵重複時丟出錯誤，不以後者覆蓋前者。
function mergeData([common, ...relicFiles]) {
  const data = { ...common, effects: {}, subcategories: {} };
  const gameIds = new Set();
  const claim = (id, owner) => {
    if (gameIds.has(id)) throw new Error(`遊戲內 ID 重複：${id}（${owner}）`);
    gameIds.add(id);
  };
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
  return data;
}

// 瀏覽器在資料填入前就跳到網址的錨點，填入後內容變長會讓落點偏移；渲染完成後重新對準。
// 格式錯誤的錨點 (例如 #%) 無法解碼時直接忽略，不當成資料載入失敗。
function scrollToHash() {
  let id;
  try {
    id = decodeURIComponent(location.hash.slice(1));
  } catch {
    return;
  }
  const target = id && document.getElementById(id);
  if (target) target.scrollIntoView({ behavior: "instant" });
}

const files = document.body.dataset.load.split(" ");
Promise.all(files.map(loadJson)).then(mergeData).then(render).then(scrollToHash).catch(showError);
