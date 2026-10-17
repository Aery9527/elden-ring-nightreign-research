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

## Game Data Rules

- Game values (numbers and rule tags), the effect, stat, and category names that the placeholders render, and their sources live only in `public/data/`:
  - [public/data/common.json](public/data/common.json): game version, stats, icons, characters, labels, and sources shared by all pages.
  - `public/data/relics/<category>.json`: one file per top category of the in-game relic filter (`general`, `character`, `armament`, `demerit`), holding that category, its subcategories, and its effects.
  - Each page lists the files it loads in `<body data-load>`, for example `common relics/general`. [public/render.js](public/render.js) stops with an error on a duplicate effect key, effect or tier `gameId`, or subcategory key; it MUST NOT let a later file override an earlier one.
- HTML holds `data-*` placeholders that [public/render.js](public/render.js) fills in; game values, including those in body-text examples, MUST NOT be hard-coded in HTML. Body prose (for example character names) and selection keys in `data-*` attributes (for example tier or level numbers) may stay in HTML.
- Value states:
  - A plain value is what the effect's `sources` report.
  - `null` means unverified; it MUST NOT be treated as 0 or false.
  - `{ "conflict": [{ "value": ..., "sources": [...] }] }` means the sources disagree; keep every candidate and never default to one.
  - These states apply to every field, including rule fields such as `stacking.stacks`; a calculation runs only when every rule it needs is explicitly satisfied, and otherwise shows the blocking state.
  - `sourcesFor` maps a field path (for example `stacking.combine`) to its sources and replaces the effect's `sources` for that field.
- Store percentages as signed numbers (for example `10`, `-5`); code derives multipliers.
- An effect with +1/+2/+3 tiers is one effect with a `tiers` array; each tier keeps its in-game `gameId`.
- Record each effect's resource change as the source states it; do not derive it from a universal per-point conversion.
- Relic effects follow the in-game relic filter tree: every effect has a `subcategory`, and each category and subcategory keeps its in-game param `gameId`. Category Chinese names are site translations until an official Traditional Chinese source is found, and pages MUST say so.
- Every effect has `name` (`zh` and `en`) and `icon`. `icon: null` means no in-game image that meets the image rules exists; it MUST NOT be replaced with a different image.
- Effect rows of a relic table are rendered from data with `<tbody data-relic-table="<subcategory>">`; effect rows MUST NOT be hand-written in HTML.

## Game Writing Rules

- When linking to an external resource, open it in a new window; navigating away from the current page is forbidden.
- Follow responsive web design (RWD) principles and support phones, tablets, desktops, and other devices.
- When mentioning an in-game item, agents MUST find the corresponding in-game image. The image source is [Eldenpedia](https://eldenring.wiki.gg/).
  - Use only images whose file page marks the license as a game asset (`{{License|game}}`); community edits (for example, filenames containing `Custom`) do not count as in-game images.
  - Download images to `public/images/`, and list the wiki file pages in the page's sources.
  - Images in the same layout position MUST keep the same size. Every image uses the `.icon` class, and its size is set only in `public/styles.css` by position, never adjusted on an individual image:
    - Inside a table: 48px (`td .icon`).
    - In body text: 24px (`.icon`).
    - When a new layout appears, first add a size rule for that position in `public/styles.css`.
    - The `width`/`height` attributes of `<img>` match the size for its position.
