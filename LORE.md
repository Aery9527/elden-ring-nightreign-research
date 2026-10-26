# LORE

## Overview

- Knowledge about the game `ELDEN RING NIGHTREIGN`, and research records of specific values that the game does not state.

## Document Rules

- AI agent documents MUST stay bilingual with equivalent content (the file without a suffix is the English version), for example AGENTS.md = AGENTS_ch.md.
- Links in AI agent documents MUST match the document's language: an English file links to the English target, and a Traditional Chinese file links to the _ch target when one exists.

## Site

- `public/` is the site source and `dist/` is the published build: [netlify.toml](netlify.toml) publishes `dist/` with no build command. All site source files (HTML, CSS, images, data) MUST live under `public/`. Pages link to each other by relative paths to `.html` files and MUST NOT rely on Netlify pretty URLs.
- [tools/build-site.mjs](tools/build-site.mjs) runs render.js in jsdom on every `public/*.html` and writes the rendered pages, with every other `public/` file copied byte for byte, to `dist/`. Install its dependencies with `npm --prefix tools ci`, build with `npm --prefix tools run build`, and verify with `npm --prefix tools run check`.
- `dist/` is generated and MUST NOT be edited by hand. Every commit's `dist/` MUST equal the build output of that commit's `public/`, build script, and locked dependencies, so a change to any of them MUST commit the rebuilt `dist/` with it. A render error or a check difference MUST be fixed, never bypassed.
- Merge into `main` locally and push `main` only after the check passes on the merged tree. MUST NOT publish through a merge made on the hosting site, where no local check runs.
- Preview through an HTTP server, not as `file://`: `python -m http.server -d public` renders the templates in the browser with `fetch`, and `python -m http.server -d dist` serves the published pages.
- render.js has three parts: loading data, static rendering, and browser interactions. The build runs only the first two, so static rendering MUST NOT depend on layout, scrolling, navigation, or events. A published page (`<html data-prerendered>`) runs only the browser interactions and loads data only for them.
- A new topic page gets a row in its topic's table on [public/index.html](public/index.html); a new topic gets its own `h2` chapter there.
- Every published `page#id` MUST keep resolving, including ids on spans, table rows, and elements that render.js generates:
  - A renamed or merged page gets a 301 redirect from its old path in [netlify.toml](netlify.toml).
  - A section moved to another page gets an entry in the old-anchor table (`moved`) of [public/nav.js](public/nav.js).
  - A section removed or merged within a page leaves its old id on the element that takes over its content.
- Every page loads [public/nav.js](public/nav.js) before [public/render.js](public/render.js) and uses the shared `<header class="site-header">` markup. nav.js builds the header from the page's `h2` chapters and `h3` headings that have an `id`, so pages MUST divide their content into `h2` chapters, every section heading MUST have an `id`, and pages MUST NOT keep a hand-written table of contents.
- Every cited source is listed once in the 資料來源 chapter (`#sources`) of [public/index.html](public/index.html); when a page starts citing a new source, add or update its row there. Topic pages MUST NOT have their own sources section, and relic tables MUST NOT have a source column. Inline citation links and the source names of conflicting candidates stay on the pages.

## Data

- The site reads game values, the names that placeholders render, and the sources of those values only from `public/data/`, the authoritative input (`dist/data/` is its published copy):
  - [public/data/common.json](public/data/common.json): definitions shared by all pages (game version, stats, icons, characters, legend, tags, skill groups, labels, sources).
  - `public/data/relics/<category>.json`: one file per top category of the in-game relic filter (`general`, `character`, `armament`, `demerit`).
  - `public/data/armaments/` (`weapons.json`, `spells.json`, `skills.json`) and `public/data/characters/nightfarers.json`.
  - Another game topic gets its own file or directory named after the topic and split by the game's own grouping; definitions shared by several topics stay in common.json.
- The HTML templates in `public/` hold the chapter skeleton and `data-*` placeholders that render.js fills. Game values (including those in body-text examples), names that render from data, and data-generated rows (relic effects, weapons, spells, skills, characters, stat relations) MUST NOT be hand-written in HTML. Static overview, source, and explanatory tables, body prose, and selection keys in `data-*` attributes (for example level numbers) may stay in HTML.
- Each page lists the files its rendering loads in `<body data-load>` (for example `common relics/general`) and MUST load every file its placeholders depend on: a page that computes reverse relic relations loads all four relic category files, a relic page with `targets` loads `armaments/weapons`, `armaments/spells`, and `armaments/skills`, and `<span data-character>` needs `characters/nightfarers`. A later file MUST NOT override an earlier one.
- Every reference (a source, icon, character, tag, stat, or item ID) MUST resolve to an own key of its definition; an inherited property MUST NOT count.
- Reverse relations (the effects that match a weapon, spell, skill, or stat; the weapons that reference a skill) are computed by render.js when rendering (the results may appear in `dist/` HTML) and MUST NOT be stored in the data.
- Value states of research values and rule fields:
  - A plain value is what its sources report.
  - `null` means unverified; it MUST NOT be treated as 0 or false.
  - `{ "conflict": [{ "value": ..., "sources": [...] }] }` means the sources disagree; keep every candidate, never default to one, and always show the candidates with their sources.
  - A calculation runs only when every rule it needs is explicitly satisfied; otherwise it shows the blocking state.
  - `sourcesFor` maps a field path (for example `stacking.combine`) to its sources and replaces the item's `sources` for that field.
  - A field with its own documented `null` meaning keeps that meaning: `icon` (no image that meets the image rules), `chargeCost` (both charge params are 0), weapon `passive` (the weapon has no fixed effect), and weapon or spell `name` (no source names it).
- Store percentages as signed numbers (for example `10`, `-5`); code derives multipliers.
- Record each effect's resource change as the source states it; do not derive it from a universal per-point conversion.
- An effect with +1/+2/+3 tiers is one effect with a `tiers` array; each tier keeps its in-game `gameId`, and a tier without a `+N` suffix in its name is `tier: 0`. A rule field (`availability`, `requiresCurse`, `stacking`, `targets`, `stats`) is stored on the effect when every tier has the same value and otherwise on each tier, never on both. Differing tier values MUST NOT be silently discarded or merged.
- Relic effects follow the in-game relic filter tree: every effect has a `subcategory`, and each category and subcategory keeps its in-game `gameId`. A category Chinese name not taken from game text is a site translation, and pages MUST say so.
- Every effect has `name` (`zh` and `en`) and `icon`. `icon: null` MUST NOT be replaced with a different image.
- `detail` holds the community detail text of an effect or tier: `en` is the source text after the importer's whitespace trimming, and `zh` is its translation. A detail whose number, item, or location contradicts the pinned game params is instead rewritten from the params in both languages and carries its own `sources`. An effect the dataset gives no detail gets one written from the params only when an explicit reference chain from its AttachEffectParam row gives the numbers and the detail tells the reader more than the name.
- Every weapon row is its own item even when it shares a `sortId` with another row, and an unnamed row MUST NOT be given another row's name. Skills that share a `textId` stay separate items with their own `fp` and `icon`.

### Tags, Targets, and Stats

- Tags classify game items so relic effects can be matched against them. They live in `tags` of common.json, grouped by dimension (`weaponType`, `spellType`, `spellSchool`); each tag's `param` is the game param value it stands for. Weapon type names are the in-game relic filter subcategory names; spell type and school names are excerpts of in-game relic effect names (for example 卡利亞劍 from 強化卡利亞劍的魔法). A spell school is defined only when a relic effect targets it.
- An item stores `tags` as `{ <dimension>: [...] }`: an empty list means checked with no defined tag, `null` means unverified, and a `conflict` keeps every candidate.
- A relic effect's `targets` uses the same dimensions, plus `spell` and `skill`: lists of spell and skill IDs, matched against the item's own ID and never stored in `tags`. Every `targets` value is a list. An item matches when, for every dimension in `targets`, its tags share at least one key (AND across dimensions, OR within one); an unlisted dimension is not checked. A known mismatch in any listed dimension is a mismatch; otherwise an unverified listed dimension makes the match unverified, and a conflicting one shows the conflict. Pages list as matches only items whose result is true; unverified or conflicting matches are never listed as matches (the weapon, spell, and skill pages show them only as a count), and relic related-item lists also leave out unnamed items.
- A relic effect's `stats` lists, in `stats` order, the keys of `stats` in common.json whose value a game param field of the effect changes; each stat's `param` lists the fields that change it, and a change in any one counts. A cap stat (`maxHp`, `maxFp`, `maxStamina`) has `base`, the base stat that also changes it. `stats` comes only from the game params, so it has no unverified or conflicting state.
- `targets` and `stats` record only the item categories, items, and stats that a game param field or a verified reference chain of the effect names. A match means only that the param relation exists, not how or when the effect works or that it applies to every listed item. An effect without `targets` has no modeled item relation, and one without `stats` no modeled stat relation, which is not the same as unrelated. Every page that shows these relations MUST say they are param relations (for example 相關遺物詞條（依參數關聯）).

## Generation

- These files are generated and MUST NOT be edited by hand:
  - `public/data/relics/*.json` by [tools/import-relics.mjs](tools/import-relics.mjs) (`node tools/import-relics.mjs [category ...]`).
  - `public/data/armaments/*.json` by [tools/import-armaments.mjs](tools/import-armaments.mjs) (`node tools/import-armaments.mjs`).
  - `public/data/characters/nightfarers.json` by [tools/import-characters.mjs](tools/import-characters.mjs) (`node tools/import-characters.mjs`).
  - `dist/` by [tools/build-site.mjs](tools/build-site.mjs) (see Site); rebuild it after running any importer.
- Edit the relevant inputs in `tools/` and `public/data/common.json`, rerun the script from the repo root, and review its printed diagnostics and the generated-file diff. Run import-armaments before import-relics, because relic `targets.skill` must name skills in `armaments/skills.json`. On a validation failure the scripts stop before writing generated data files; MUST fix the reported input and MUST NOT bypass or weaken a check. render.js validates the loaded data in the same way.
- All three scripts read the sources pinned in [tools/relics-config.json](tools/relics-config.json) through [tools/sources.mjs](tools/sources.mjs), so relics, armaments, and characters come from the same game params. To update a source, change its commit or revision in the config, rerun the scripts, and review the differences and the affected translations before committing. After a game param update, check every param rewrite against the new params.
- After import-armaments or import-characters, run `python tools/fetch-icons.py` to download the armament and character ability icons missing from `public/images/`.

### Relic Inputs

- [tools/relics-config.json](tools/relics-config.json): pinned sources, the category tree, nightfarer columns, the status icon ID → icon key map and the relic icon ID → icon key map (`null` = no matching licensed image), and `heroes`.
- [tools/relics-curated.json](tools/relics-curated.json): hand-curated effects matched to generated effects by `gameId`; their fields override generated values.
- [tools/relic-details-zh.json](tools/relic-details-zh.json): the Traditional Chinese translation of each community detail, keyed by `gameId`, stored with its English original.
- [tools/relic-details-params.json](tools/relic-details-params.json): details rewritten from the game params, keyed by `gameId`, stored with the community source text and the param evidence. A `gameId` MUST NOT appear in both detail files.
- [tools/relic-stacking.json](tools/relic-stacking.json): self-stacking for tiers the dataset leaves unknown, taken only from a community source that states it explicitly (the community sheet or Fextralife), with the quoted source rows.
- [tools/relic-penalties.json](tools/relic-penalties.json): penalty phrases inside the Traditional Chinese detail of a buff effect, as exact substrings. List every penalty in a detail, including each level's number.
- The script derives `targets` and `stats` from the SpEffectParam rows the effect references; only param values defined in `tags` produce a tag.
- Translating a detail:
  - Every number keeps identical digits; never compute, round, or convert units.
  - Use the effect's official Chinese name and game terms; a term with no official Chinese name stays in English.
  - Translate source notes such as `TODO` as `（原文註記：……）`; where the source contradicts the effect name, translate literally and add `（原文如此）`. MUST NOT correct the source in a translation; a contradiction with the game params goes to the param rewrite file instead.

### Armament Research

- Weapons: every `EquipParamWeapon` row whose ID is a multiple of 10000, whose `wepType` has a `weaponType` tag, that has a name in both languages, whose `sortId` is not 9999999, and that an `EquipParamCustomWeapon` row (Nightreign's weapon generation param) targets; plus every row that carries a spell, named or not. A name and a type alone do not show that a weapon is in Nightreign: base-game weapons absent from it keep `EquipParamWeapon` rows without a generation row.
- Spells: every ID a weapon spell slot references. `spellType` comes from `Magic.ezStateBehaviorType` and `spellSchool` from `Magic.subCategory1`/`subCategory2`. A referenced ID with no `Magic` row has both `null`, and a spell MUST NOT be classified from its name, its carrier, or the base-game list it appears in. A spell whose `spellType` holds exactly one known type appears on the sorceries or incantations page; a spell whose type is unverified or conflicting appears in the limitations chapter of the weapons page.
- Names: weapon and spell names come from the Elden Ring base-game text (`erText`): weapons from `WeaponName` by weapon ID, and spells only from the base-game sorcery and incantation lists by ID, MUST NOT from `GoodsName`, whose IDs collide with key items. Blank, `%null%`, and `[ERROR]` entries are not names. Pages MUST say these are base-game reference names not confirmed for Nightreign.
- Weapon values (`attack`, `scaling`, `critical` from `criticalAtkRate`, ailment `buildup`) are raw params. Nightreign attack power also changes with level and rarity, so they MUST NOT be presented as in-game attack power or scaling grades, and pages MUST say they are raw params. `passive` stores only the name of the `AttachEffectParam` row that `attachEffectId` references, looked up by its `attachTextId` in the Nightreign effect text (`game-text`). An empty cell only means the stored fields are empty, not that the weapon has no other effect.
- Weapon skills: `skill.default` is `swordArtsParamId`; `skill.pool` is the union of the skills with a `chanceWeight` above 0 in the `SwordArtsTableParam` pools that the weapon's generation rows reference. A generation row with `swordArtsTableId` -1 has no pool, and the default skill MUST NOT be assumed for it or added to `pool`. These are param relations, not proof of what a picked-up weapon has or how likely each skill is, so pages call them 參數預設 and 生成池候選, MUST say they are param relations, and MUST NOT present the default as the weapon's fixed skill.
- Skills: every `SwordArtsParam` row a named weapon references. `fp` keeps the raw `useMagicPoint_*` values; -1 MUST NOT be read as no cost. `group` is the one `skillGroups` entry matching the skill's `sortGroupId` (and `defaultWepAttr` when the entry lists it). Group names come from official affinity and weapon type wording and the 專用戰技 caption heading, except 無屬性, a site name. Pages that show the groups MUST say that they show how the params sort skills, not a skill's damage type or usable weapons, and that 無屬性 is a site name.
- Spell costs: `cost` and `chargeCost` are raw params before any cost reduction. `chargeCost` MUST NOT be presented as whether a spell can be charged: a non-zero value does not show how charged casting works, 0 does not mean no cost, and the two lines MUST NOT be added.
- Icons: weapon, spell, and skill icons come from Eldenpedia under the image rules. When the name cannot tell which `SwordArtsParam` row an icon belongs to (several rows share a `textId`, or one English name belongs to several `textId`s), the skill has `icon: null`.

### Character Research

- `heroes` in the config maps each `characters` key of common.json to its `HeroParam` and `HeroMenuParam` IDs. `HeroMenuParam` has no character field and is mapped in ID order, so the mapping MUST be checked against the Eldenpedia grades.
- Grades: `HeroMenuParam` `*Grade` values 0 to 4 are S to D.
- Levels: the anchors are the consecutive `HeroStatusParam` rows from the character's `heroStatusParamId`, each at its `totalLevel`. A level between anchors is the linear interpolation of the nearest anchors, rounded down. The params do not state this rule, so it is a site calculation.
- Caps: `maxHp`, `maxFp`, and `maxStamina` come from `vigor`, `mind`, and `endurance` through the `CalcCorrectGraph` rows 100, 101, and 104, with no rounding. The params do not say which row the game uses, so the caps are site calculations.
- When the level or cap calculation or the params change, MUST compare the results with the level tables of the Eldenpedia Nightreign:Attributes page; where a cell differs, keep the value from the params.
- Cooldown: `HeroParam` `characterAbilityCooldown`, 0 meaning none; where Eldenpedia differs, `cooldownNote` cites its value. The use-count field is not shown.
- Text: [tools/character-text-zh.json](tools/character-text-zh.json) keeps in `cn` the official Simplified Chinese menu text exactly as on the BWIKI trilingual menu-text pages pinned by revision (a community copy without text IDs), and `en` is the line with the same line number in the English section.
- Effects: [tools/character-effects.json](tools/character-effects.json) lists, per ability, entries that are either written from the params (`{ zh, checks, note? }`, sources `game-params`) or community mechanic summaries (`{ zh, sources }`) citing the Eldenpedia character page pinned by revision.
  - Every number a param entry shows MUST be tied to the params by a check with `display`.
  - A summary is used only where the params give no number for that mechanic, and MUST NOT repeat the official description.
  - A community number MUST NOT appear in a param entry; it appears only in a summary or a `note`. Where the community differs, keep the param value and cite the community value in a `note`.
  - The characters page MUST identify community summaries with source links and show differing community records as sourced notes after the retained param values.
- Rows: the params have no row names, so the Smithbox row names (`smithbox-row-names`) decide which row belongs to which ability. A row is used only when its name names the ability and one of these holds: a value in it or its reference chain matches Eldenpedia; a used row, or the ability's behavior (`BehaviorParam_PC` 6000000xx for skills and 7000000xx for arts, 50 IDs per character in `HeroParam` order), reaches it through param references; or, with no number to compare, the kind and direction of its effect match the official description or the Eldenpedia text. Rows only next to a named row in ID, or whose name marks itself as uncertain, are not used, and row ownership MUST NOT be guessed.
- Wording: field meanings follow the official Japanese descriptions in the base-game paramdef (`smithbox-er-paramdef`), in the wording of [tools/relic-details-params.json](tools/relic-details-params.json):
  - `*AttackRate` is 傷害 ×, all five being 所有來源的傷害; `*AttackPowerRate` is 攻擊力 ×; `*DamageCutRate` is 受到的…傷害 ×, all eight being 受到的所有傷害; `toughnessDamageCutRate` is 受到的削韌; `*DefDamageRate` is 受到的異常累積; a negative `changeHpRate`, `changeMpPoint`, or `changeStaminaRate` is 恢復; `hitRadius` and `hitRadiusMax` are 半徑 and 最大半徑 in metres; `itemDropRate` × 100 is 觀察力.
  - The `AtkParam_Pc` corrections are multipliers on a base value, so they are shown only as ratios within one move and named 攻擊力補正 (`atk…Correction`), 削韌補正 (`atkSuperArmorCorrection`), and 精力削減補正 (`atkStamCorrection`), never as damage ratios. Damage values (`atkMag` and the like) are not shown.
  - Nightreign-only fields without an official description are not shown.
  - A table by level or Deep of Night depth is shown only by its first and last or its highest step.

### Skill and Character Text Conversion

- Skill `name.en` and `caption.en` come from the base-game `ArtsName` and `ArtsCaption` (`erArts`). `name.zh` is the Traditional Chinese name, with the `戰灰：` prefix removed, of the base-game Ash of War (`erText` `ashesofwar`) whose English name without the `Ash of War: ` prefix equals the skill's English name; Ash of War IDs MUST NOT be used to match them. Skill names and captions are base-game text not confirmed for Nightreign, and pages MUST say so. A skill with no such Ash of War, and every `caption.zh`, takes the site conversion; a Traditional Chinese name MUST NOT be translated from English or invented.
- Site conversions live in [tools/skill-text-zh.json](tools/skill-text-zh.json) (keyed by `textId`, `cn` from the community copy `erArtsCn`) and [tools/character-text-zh.json](tools/character-text-zh.json): `cn` keeps the official Simplified Chinese text verbatim and `zh` holds the conversion. Conversion rules:
  - Phrases are first replaced by the official Nightreign Traditional Chinese wording (for example 血量 → ＨＰ, 专注值 → ＦＰ, 通过 → 透過, and for characters 绝招 → 絕活).
  - Every other character takes its Traditional form chosen by context (for example 回旋 → 迴旋, 精通 stays 精通, 红发 → 紅髮).
  - Punctuation follows the official Traditional Chinese text (“” → 「」, · → ‧).
  - Nothing is added or removed; digits and line breaks stay.
  - When an Ash of War name exists, `zh.name` MUST equal it.
- The official Nightreign texts are only a reference for these choices, not proof that the official Traditional Chinese equals the conversion, so pages MUST call the result a site conversion, not official Traditional Chinese.

## Pages

- Weapons page (`weapons.html`, `h1` id `weapons`): one `<section data-weapon-type="<type>">` per `weaponType` tag, with the `h2` id `weapon-type-<type>`; each row has the id `weapon-<id>`. The `#limitations` chapter holds `<tbody data-unlisted-spells>` for the spells whose type is unverified or conflicting.
- Sorceries and incantations pages: `<section data-spell-type="<type>">` is the type chapter (`h2` id `sorceries` or `incantations`); each `<section data-spell-type="<type>" data-spell-school="<school>">` is a school chapter (`h2` id `spell-school-<school>`, or `<type>-no-school` for the empty school). Each row has the id `spell-<id>`. A related effect appears only at the highest layer it matches: the type chapter, then the school chapter, then the spell row.
- Skills page (`skills.html`, `h1` id `skills`): one `<section data-skill-group="<group>">` per `skillGroups` key, in that order, with the `h2` id `skill-group-<group>`, all inside `<div id="skill-list">`; a group may hold `<section data-skill-weapon-type="<type>">` subsections (`h3` id `skill-unique-<type>`). Each row has the id `skill-<id>`. Besides the disclosures that Armament Research and Skill and Character Text Conversion require, the page MUST state that its range is the skills that named weapons reference, not every skill in the game; how its groups compare with the Eldenpedia Nightreign skill list; and which Traditional Chinese names are official (from Ash of War names) and which names, along with every caption, are site conversions. The weapons page and the relic pages with `targets` say once that some skill names are site conversions and link to the skills page.
- Characters page (`characters.html`, `h1` id `characters`): one `<section data-nightfarer="<character>">` per `characters` key, with the `h2` id `character-<character>`, inside `#character-list[data-nightfarer-list]`; the `#grades` chapter holds `[data-nightfarer-grades]` and the `#levels` chapter holds `[data-nightfarer-levels]`. Static rendering fills `[data-nightfarer-levels]` with one level table per character, captioned with the character name and wrapped in an element with the id `character-<character>-levels`; in the browser the interactive charts replace them, and the tables stay when the chart data fails to load.
  - The page MUST state that the names and text are site conversions of the official Simplified Chinese menu text, not official Traditional Chinese; that the grades are param values; that the levels between anchors and the three caps are site calculations (see Character Research), with direct param values visibly marked and the caps never marked as direct; and that the values exclude relics and other effects that change stats.
  - Its `#limitations` chapter MUST state the limits of the text source, the cooldown source, the row-attribution and field-wording methods, and what is left out.
- Attributes page: each stat row has the id `stat-<stat>`, and its `<td data-stat-effects="<stat>">` lists the relic effects whose `stats` hold that stat; a cap row also lists, under 經由<base stat name>, the effects whose `stats` hold its `base` but not the cap.
- Relic pages: effect rows render from `<tbody data-relic-table="<subcategory>">`. An effect with `targets` links its matching named weapons, spells, and skills to their rows (`weapons.html#weapon-<id>`, `#spell-<id>` on the page of the spell's type, `skills.html#skill-<id>`), and an effect with `stats` links its stats to `attributes.html#stat-<stat>`.
- Tones: render.js derives tone classes from data. Demerit effects are red (`tone-debuff`); other effects are blue for self-stacking (`tone-stack`), green for non-stacking (`tone-solo`), and bold (`tone-unverified`) for unverified, conflicting, or tier-differing stacking. Self-stacking effects show a non-additive, unverified, or conflicting combine rule separately; demerits keep their stacking rules. Penalty phrases and the confirmed curse requirement (`requiresCurse: true`) are red. Each relic page shows the color legend from `legend` in common.json. Tone classes MUST NOT be set by hand in HTML.

## Writing Rules

- A link to an external resource opens in a new window; navigating away from the current page is forbidden.
- Follow responsive web design: no page, including its header, needs horizontal scrolling at any screen width of 280px or more.
  - Tables: every table sits in `.table-wrap`, has one header row in `thead`, and every row has as many cells as that header row.
  - Diagrams: build them from HTML boxes and text that wrap with the screen, not from fixed-width images.
  - Data charts: draw line charts as SVG at the width of their container and redraw them when it changes, and bar charts from HTML elements whose bar widths are percentages of their row; every chart has a table with the same values. Category colors are the `--series-*` variables of [public/styles.css](public/styles.css); after changing them, MUST validate their light and dark values against `--surface` with the palette validator of the dataviz skill.
- When mentioning an in-game item, agents MUST find its in-game image on [Eldenpedia](https://eldenring.wiki.gg/):
  - Use only images whose file page marks the license as a game asset (`{{License|game}}`); community edits (for example, filenames containing `Custom`) do not count.
  - Download images to `public/images/`. An image larger than 96px may be downscaled to 96px; no other edits are allowed.
  - Provenance: each icon in common.json records its file page in `page`, and the home page lists them with `<span data-icon-sources>`. Weapon, spell, skill, and character ability icons keep their file pages in their item or character data, and the home page names their Eldenpedia series once.
- Images in the same layout position MUST keep the same size. Every image uses the `.icon` class, sized only in `public/styles.css` by position, never on an individual image: 48px inside a table (`td .icon`), 24px in a name list inside a table entry (`td .entry .icon`), and 24px in body text (`.icon`). A new layout first gets a size rule in `public/styles.css`. The `width`/`height` attributes of `<img>` match the size for its position.
