# LORE

## Overview

- Knowledge about the game `ELDEN RING NIGHTREIGN`, and research records of specific values that the game does not state.

## Project Ground Rules

- AI agent documents MUST stay bilingual with equivalent content (the file without a suffix is the English version), for example SKILL.md = SKILL_ch.md, AGENTS.md = AGENTS_ch.md, and so on.
- Links in AI agent documents MUST match the document's language: an English file links to the English target, and a Traditional Chinese file links to the _ch target when one exists.

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
