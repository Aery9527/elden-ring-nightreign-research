# LORE

## Overview

- Knowledge about the game `ELDEN RING NIGHTREIGN`, and research records of specific values that the game does not state.

## Project Ground Rules

- AI agent documents MUST stay bilingual with equivalent content (the file without a suffix is the English version), for example SKILL.md = SKILL_ch.md, AGENTS.md = AGENTS_ch.md, and so on.
- Links in AI agent documents MUST match the document's language: an English file links to the English target, and a Traditional Chinese file links to the _ch target when one exists.
- The site is published with Netlify. [netlify.toml](netlify.toml) publishes the `public/` directory with no build command:
  - All site files (HTML, CSS, images) go under `public/`; files outside `public/` do not appear on the site.
  - Pages link to each other with relative paths to `.html` files and do not rely on Netlify pretty URLs.
  - Pages load game data with `fetch`, so preview them locally through an HTTP server (for example `python -m http.server -d public`); a page opened directly as a local file (`file://`) cannot load the data.
  - When adding a topic page, also add a row to its topic group's table in the research index of [public/index.html](public/index.html); a new topic gets its own group heading.
  - When a page is renamed or merged into another page, add a 301 redirect from the old path in [netlify.toml](netlify.toml) and keep the old heading ids so old anchors still work.
  - Every page loads [public/nav.js](public/nav.js) and uses the same sticky `<header class="site-header">` markup as the existing pages; the script fills the header breadcrumb with the site home, the page `h1` (omitted on the home page, where the home link already names the page), and the `h2` and `h3` the reader is currently in, each linking to the top of that level. Only `h2` and `h3` headings with an `id` appear in the breadcrumb, so every section heading MUST have an `id`.
  - Every source the site cites is listed once in the "資料來源" group (`#sources`) of the research index in [public/index.html](public/index.html); topic pages MUST NOT have their own sources section, and relic tables MUST NOT have a source column. When a page starts citing a new source, add or update its row in that table. Inline citation links in body text and the source names shown for conflicting candidates stay on the pages.

## Game Data Rules

- The site reads game values (numbers and rule tags), the effect, stat, and category names that the placeholders render, and their sources only from `public/data/`; maintenance inputs that produce part of these files live in `tools/` (see Relic Data Generation):
  - [public/data/common.json](public/data/common.json): game version, stats, icons, characters, labels, and sources shared by all pages.
  - `public/data/relics/<category>.json`: one file per top category of the in-game relic filter (`general`, `character`, `armament`, `demerit`), holding that category, its subcategories, and its effects.
  - Data for another game topic goes in its own file or directory under `public/data/` named after the topic and split by the game's own grouping, as `relics/` follows the in-game relic filter; definitions shared by several topics stay in `common.json`.
  - Each page lists the files it loads in `<body data-load>`, for example `common relics/general`. [public/render.js](public/render.js) stops with an error on a duplicate effect key, effect or tier `gameId`, or subcategory key; it MUST NOT let a later file override an earlier one.
- HTML holds `data-*` placeholders that [public/render.js](public/render.js) fills in; game values, including those in body-text examples, MUST NOT be hard-coded in HTML. Body prose (for example character names) and selection keys in `data-*` attributes (for example tier or level numbers) may stay in HTML.
- Value states:
  - A plain value is what the effect's `sources` report.
  - `null` means unverified; it MUST NOT be treated as 0 or false.
  - `{ "conflict": [{ "value": ..., "sources": [...] }] }` means the sources disagree; keep every candidate and never default to one.
  - These states apply to every field, including rule fields such as `stacking.stacks`; a calculation runs only when every rule it needs is explicitly satisfied, and otherwise shows the blocking state.
  - `sourcesFor` maps a field path (for example `stacking.combine`) to its sources and replaces the effect's `sources` for that field.
- Store percentages as signed numbers (for example `10`, `-5`); code derives multipliers.
- An effect with +1/+2/+3 tiers is one effect with a `tiers` array; each tier keeps its in-game `gameId`. A tier without a `+N` suffix in its name is `tier: 0`. A rule field that differs between tiers is stored on each tier instead of on the effect.
- Record each effect's resource change as the source states it; do not derive it from a universal per-point conversion.
- Relic effects follow the in-game relic filter tree: every effect has a `subcategory`, and each category and subcategory keeps its in-game param `gameId`. A category Chinese name not taken from game text is a site translation, and pages MUST say so.
- Every effect has `name` (`zh` and `en`) and `icon`. `icon: null` means no in-game image that meets the image rules exists; it MUST NOT be replaced with a different image.
- Effect rows of a relic table are rendered from data with `<tbody data-relic-table="<subcategory>">`; effect rows MUST NOT be hand-written in HTML.
- [public/render.js](public/render.js) colors data-generated detail lines, value lines, and body-text examples by tone: effects in the demerit category are red (`tone-debuff`); other effects are blue when they stack with themselves (`stacks: true`, `tone-stack`) and green when they do not (`stacks: false`, `tone-solo`); unverified or conflicting stacking leaves the default color. A rule-line equivalent value (for example "equals Vigor +5") takes the effect's tone. Penalty phrases listed for a detail are red inside its tone. The rule label stating that a curse effect is required (`requiresCurse: true`) is red. Each relic page shows a color legend fixed to the bottom of the viewport: 不可疊加 in green, 可疊加 in blue, and 負面 in red. Tone classes MUST NOT be set by hand in HTML except in that legend.
- `detail` holds the community detail text of an effect or tier: `en` is the source text verbatim and `zh` its translation. A detail whose number, item, or location contradicts the pinned game params is instead rewritten from the params in both languages and carries its own `sources`. An effect the dataset gives no detail gets one written from the params only when an explicit reference chain from its AttachEffectParam row gives the numbers and the detail tells the reader more than the name; otherwise it has no detail.

## Relic Data Generation

- `public/data/relics/*.json` are generated by [tools/import-relics.mjs](tools/import-relics.mjs) (`node tools/import-relics.mjs [category ...]`, run from the repo root); they MUST NOT be edited by hand. Edit the inputs and rerun:
  - [tools/relics-config.json](tools/relics-config.json): the pinned commit of each source, the category tree, the nightfarer columns, the status icon ID → icon key map (`null` = no matching licensed image), and the relic icon ID → icon key map.
  - [tools/relics-curated.json](tools/relics-curated.json): hand-curated effects matched to generated effects by `gameId`; their fields override generated values, and the script prints every overridden difference.
  - [tools/relic-details-zh.json](tools/relic-details-zh.json): the Traditional Chinese translation of each community detail, keyed by `gameId` and stored with its English original.
  - [tools/relic-stacking.json](tools/relic-stacking.json): self-stacking values for tiers the dataset leaves unknown, keyed by `gameId`, taken only from a community source that states them explicitly (the community sheet or Fextralife); each entry stores `stacks` (a boolean, or a `conflict` when the sources disagree), `sources`, and the quoted source rows in `quotes`. The script fills only unknown values and lists the sources in the effect's `sourcesFor["stacking.stacks"]`, together with the source of any tier the dataset already gives.
  - [tools/relic-details-params.json](tools/relic-details-params.json): details written from the game params, keyed by `gameId`; each entry stores the community `source` text (`null` when the dataset has no detail), the rewrite in `en` and `zh`, the param evidence in `params`, and optional `sources` (default `game-params`). A `gameId` MUST NOT appear in both detail files.
  - [tools/relic-penalties.json](tools/relic-penalties.json): penalty phrases inside the Traditional Chinese detail of a buff effect, keyed by the `gameId` that owns the detail; each value is an array of exact substrings (for example `"生命力 -5"`), written to `detail.penalties`. List every penalty in a detail, including each level's number.
- The script stops without writing when a curated effect, translation, effect or relic icon, character, or source reference (`sources`, `sourcesFor`, conflict candidates) has no match; when two curated effects map to the same `gameId`s; when a source field has an unknown enum value; when the English original of a translation or the `source` of a param rewrite differs from the source; when a `gameId` has both a translation and a param rewrite; when a param rewrite lacks `en`, `zh`, or `params`, has an empty `sources`, or has no matching effect; when an effect stores a rule field (`availability`, `requiresCurse`, `stacking`) both on the effect and on a tier; when a stacking entry has no matching effect, targets a tier the dataset already gives, cites a source other than the community sheet or Fextralife, lacks one quote per source, or has an invalid `stacks` (a conflict needs at least two boolean candidates with different values, each citing listed sources); when a penalty entry is not a non-empty array of non-empty strings, has no matching detail, lists a phrase missing from the detail, or lists a phrase ending in a digit that matches only part of a longer number not covered by a longer listed phrase; or when either detail file, the stacking file, or the penalty file repeats a key or differs from its canonical `JSON.stringify` output with 2-space indentation. Fix the input instead of bypassing the check.
- To update a source, change its commit in the config, rerun the script, and review the printed differences and the changed translations before committing. After a game param update, check every param rewrite against the new params.
- Translating a detail:
  - Every number keeps identical digits; never compute, round, or convert units.
  - Use the effect's official Chinese name and game terms; a term with no official Chinese name stays in English.
  - Translate source notes such as `TODO` as `（原文註記：……）`; where the source contradicts the effect name, translate literally and add `（原文如此）`. MUST NOT correct the source in a translation; a contradiction with the game params goes to the param rewrite file instead.

## Game Writing Rules

- When linking to an external resource, open it in a new window; navigating away from the current page is forbidden.
- Follow responsive web design (RWD) principles and support phones, tablets, desktops, and other devices.
- When mentioning an in-game item, agents MUST find the corresponding in-game image. The image source is [Eldenpedia](https://eldenring.wiki.gg/).
  - Use only images whose file page marks the license as a game asset (`{{License|game}}`); community edits (for example, filenames containing `Custom`) do not count as in-game images.
  - Download images to `public/images/`; the home page sources list their wiki file pages. An image larger than 96px may be downscaled to 96px; no other edits are allowed.
  - Each icon in [public/data/common.json](public/data/common.json) records its wiki file page in `page`; the home page lists the file pages of every icon on the site with `<span data-icon-sources>`.
  - Images in the same layout position MUST keep the same size. Every image uses the `.icon` class, and its size is set only in `public/styles.css` by position, never adjusted on an individual image:
    - Inside a table: 48px (`td .icon`).
    - In a name list inside a table entry, including the fixed-relic column: 24px (`td .entry .icon`).
    - In body text: 24px (`.icon`).
    - When a new layout appears, first add a size rule for that position in `public/styles.css`.
    - The `width`/`height` attributes of `<img>` match the size for its position.
