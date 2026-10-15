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
  - When adding a topic page, also add a row to the research index table in `public/index.html`.

## Game Data Rules

- Game values (numbers and rule tags), the effect and stat names that the value placeholders render, and their sources live only in [public/data/nightreign.json](public/data/nightreign.json). HTML holds `data-*` placeholders that [public/render.js](public/render.js) fills in; game values, including those in body-text examples, MUST NOT be hard-coded in HTML. Body prose (for example character names) and selection keys in `data-*` attributes (for example tier or level numbers) may stay in HTML.
- Value states:
  - A plain value is what the effect's `sources` report.
  - `null` means unverified; it MUST NOT be treated as 0 or false.
  - `{ "conflict": [{ "value": ..., "sources": [...] }] }` means the sources disagree; keep every candidate and never default to one.
  - These states apply to every field, including rule fields such as `stacking.stacks`; a calculation runs only when every rule it needs is explicitly satisfied, and otherwise shows the blocking state.
  - `sourcesFor` maps a field path (for example `stacking.combine`) to its sources and replaces the effect's `sources` for that field.
- Store percentages as signed numbers (for example `10`, `-5`); code derives multipliers.
- An effect with +1/+2/+3 tiers is one effect with a `tiers` array; each tier keeps its in-game `gameId`.
- Record each effect's resource change as the source states it; do not derive it from a universal per-point conversion.

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
