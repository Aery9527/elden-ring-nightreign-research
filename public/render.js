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
function ruleLabel(data, field, value) {
  return lookup(lookup(data.labels, field, "規則標籤組"), ruleKey(value), `規則標籤 ${field}`);
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

// 效果引用的全部來源：效果層級 sources 加上 sourcesFor 各欄位的來源，去除重複。
function effectSources(effect) {
  return [...new Set([...effect.sources, ...Object.values(effect.sourcesFor ?? {}).flat()])];
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

function ruleText(data, effect) {
  const { labels } = data;
  const { stacking } = effect;
  const parts = [];
  if (effect.equivalent) {
    const { stat, unit, value } = effect.equivalent;
    parts.push(`${labels.equivalent}${statName(data, stat)} ${formatAmount(data, unit, value)}`);
  }
  if ("availability" in effect) parts.push(ruleLabel(data, "availability", effect.availability));
  // 各級取得方式不同時記在 tier 上，依取得方式合併等級，例如「+1、+2：一般遺物」。
  const byAvailability = new Map();
  for (const tier of effect.tiers ?? []) {
    if (!("availability" in tier)) continue;
    const label = ruleLabel(data, "availability", tier.availability);
    byAvailability.set(label, [...(byAvailability.get(label) ?? []), tierLabel(data, tier.tier)]);
  }
  for (const [label, tiers] of byAvailability) parts.push(`${tiers.join("、")}：${label}`);
  parts.push(ruleLabel(data, "stacks", stacking.stacks));
  if ("acrossTiers" in stacking) parts.push(ruleLabel(data, "acrossTiers", stacking.acrossTiers));
  if (stacking.stacks === true) parts.push(ruleLabel(data, "combine", stacking.combine));
  // requiresCurse 為 false 時不顯示；true、null、conflict 都顯示對應狀態。
  if ("requiresCurse" in effect && effect.requiresCurse !== false) {
    parts.push(ruleLabel(data, "requiresCurse", effect.requiresCurse));
  }
  return parts.join("；");
}

// icon 為 null 表示沒有可用的遊戲內圖片，保留同寬空位；缺少 icon 欄位則丟出錯誤。
function itemName(data, kind, id) {
  const item = kind === "effect" ? lookup(data.effects, id, "效果") : lookup(data.stats, id, "能力值");
  if (item.icon === undefined) throw new Error(`缺少圖示欄位：${id}`);
  const en = item.abbr ? `${item.name.en} / ${item.abbr}` : item.name.en;
  const icon =
    item.icon === null
      ? el("span", { class: "icon icon-missing", role: "img", "aria-label": data.labels.iconMissing })
      : (({ src, alt }) => el("img", { class: "icon", src, width: "48", height: "48", alt, loading: "lazy" }))(
          lookup(data.icons, item.icon, "圖示")
        );
  return el("span", { class: "item-name" }, icon, item.name.zh, el("span", { class: "en" }, en));
}

function valueEntries(data, ids) {
  return ids.map((id) => {
    const effect = lookup(data.effects, id, "效果");
    return el("span", { class: "entry" }, effectText(data, effect), el("span", { class: "sub" }, ruleText(data, effect)));
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
function tierEntries(data, effect) {
  const { stat, unit, values } = tierDisplay(effect);
  const line = (picked) =>
    `${statName(data, stat)} ${picked.map((value) => (value === undefined ? "？" : formatAmount(data, unit, value))).join("／")}`;
  const rules = el("span", { class: "sub" }, ruleText(data, effect));
  const sourceSets = new Map();
  for (const value of values.filter(isConflict)) {
    for (const candidate of value.conflict) sourceSets.set(candidate.sources.join(" "), candidate.sources);
  }
  if (sourceSets.size === 0) return [el("span", { class: "entry" }, line(values), rules)];
  const entries = [...sourceSets.entries()].map(([key, sources]) => {
    const picked = values.map((value) =>
      isConflict(value) ? value.conflict.find((candidate) => candidate.sources.join(" ") === key)?.value : value
    );
    return el(
      "span",
      { class: "entry" },
      line(picked),
      el("span", { class: "sub" }, `${data.labels.conflict}：`, ...sourceLinks(data, sources))
    );
  });
  return [...entries, el("span", { class: "entry" }, rules)];
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

// 社群詳細說明 (detail) 依效果或各等級列出；沒有 detail 的效果不輸出。
function detailEntries(data, effect) {
  const entries = effect.detail ? [el("span", { class: "entry" }, effect.detail.zh)] : [];
  for (const tier of effect.tiers ?? []) {
    if (tier.detail) entries.push(el("span", { class: "entry" }, `${tierLabel(data, tier.tier)}：${tier.detail.zh}`));
  }
  return entries;
}

// 詞條表的效果欄：有結構化數值 (modifier) 時列出數值與規則，否則只列規則；社群詳細說明放在最前面。
function effectEntries(data, key, effect) {
  let values;
  if (effect.modifier && effect.tiers) values = tierEntries(data, effect);
  else if (effect.modifier) values = valueEntries(data, [key]);
  else values = [el("span", { class: "entry" }, el("span", { class: "sub" }, ruleText(data, effect)))];
  return [...detailEntries(data, effect), ...values];
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
        el("td", { class: "source" }, ...sourceLinks(data, effectSources(effect)))
      )
    );
  if (rows.length === 0) throw new Error(`子分類沒有效果：${subcategoryId}`);
  return rows;
}

function render(data) {
  for (const node of document.querySelectorAll("[data-subcategory-name]")) {
    node.textContent = lookup(data.subcategories, node.dataset.subcategoryName, "子分類").name.zh;
  }
  for (const node of document.querySelectorAll("[data-relic-table]")) {
    node.replaceChildren(...relicRows(data, node.dataset.relicTable));
  }
  for (const node of document.querySelectorAll("[data-game-version]")) node.textContent = data.gameVersion;
  for (const node of document.querySelectorAll("[data-item]")) {
    const [kind, id] = node.dataset.item.split(":");
    node.replaceChildren(itemName(data, kind, id));
  }
  for (const node of document.querySelectorAll("[data-values]")) {
    node.replaceChildren(...valueEntries(data, node.dataset.values.split(" ")));
  }
  for (const node of document.querySelectorAll("[data-tiers]")) {
    node.replaceChildren(...tierEntries(data, lookup(data.effects, node.dataset.tiers, "效果")));
  }
  for (const node of document.querySelectorAll("[data-effect-text]")) {
    node.textContent = effectText(data, lookup(data.effects, node.dataset.effectText, "效果"));
  }
  for (const node of document.querySelectorAll("[data-tier-text]")) {
    const [id, tier] = node.dataset.tierText.split(":");
    node.textContent = tierText(data, lookup(data.effects, id, "效果"), Number(tier));
  }
  for (const node of document.querySelectorAll("[data-example]")) {
    const effect = lookup(data.effects, node.dataset.effect, "效果");
    node.textContent =
      node.dataset.example === "tier-sum"
        ? tierSumExample(data, effect, node.dataset.tierList.split(",").map(Number))
        : stackExample(data, effect, Number(node.dataset.count));
  }
  for (const node of document.querySelectorAll("[data-sources]")) {
    const ids = node.dataset.sources.split(" ").flatMap((id) => effectSources(lookup(data.effects, id, "效果")));
    node.replaceChildren(...sourceLinks(data, [...new Set(ids)]));
  }
  for (const node of document.querySelectorAll("[data-character]")) {
    node.textContent = characterValue(data, node.dataset.character);
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

const files = document.body.dataset.load.split(" ");
Promise.all(files.map(loadJson)).then(mergeData).then(render).catch(showError);
