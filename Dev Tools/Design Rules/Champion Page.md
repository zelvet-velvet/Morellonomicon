---
title: Champion Page
tags:
  - morellonomicon
  - layout
sticker: lucide//swords
---
> [!abstract]+ One look for the champion page, its swipe pages and their sub pages
> Part of [[Design Rules]] (read that first, and [[Pages]]). A rule from Zaviel (2026-10-31): the champion page's swipe pages (概覽, 技能, 出裝, 強化, 技巧) and the pages they open (全部概覽, 全部強化 …) share one style, so a sub page reads as the same page opened further, not another app. Code: `plugin/src/pages/champions.ts` (`championCard`), `build.ts`, `skills.ts`, `detail.ts`; the parts in `ui.ts`.

---
## 📱 The champion page (v3)

> [!note]+ One screen · The splash · Swipe pages · Page hint
> - **One screen, own pages.** The page does not scroll down. Riot's centered splash fills the whole page behind it, fading out under the status bar and at its foot.
> - **The name block.** The name, title and roles (and the tags under them) sit at the foot of the first page, inside it, so they slide away with it when the pages swipe, clear of the tab bar.
> - **Swipe pages.** Above it the pages swipe sideways: they follow the finger and land on a page (`championCard`'s pager, settling over 0.32 s; not the browser's snapping, which iOS left half way), with their parts floating on the art: no frames, no page titles and no 全部 button. A swipe page with its own skin fades that skin in over the base splash (0.3 s).
> - **The first page** keeps the art bright with its parts just above the name; tapping its chart, tiles or tags opens its full page. The others darken the art (0.35 s) and show their whole detail in the page (scrolling inside when long).
> - **Page hint.** A small hint floats at the top middle: a dot per page, the current one lit and wider (0.25 s).

## 🎨 The family look

> [!note]+ Same parts, same art · Glance pages fit one screen · No panels · Headings · Switches · Links · One order
> - **The same few parts, the same art.** A sub page sits on the same darkened splash as the swipe pages past 概覽: the page gives it as `art` ([[Pages]], `.mn-page-art`); it comes from the cache.
> - **Tap a side to switch the play style.** On a page with play style words (強化, 全部強化, 出裝), a tap on the left or right 22 % of the page (not on an augment or item) switches to the style before or after, like turning a story (`styleSwitch`); the pages themselves only swipe.
> - **A glance page fits one screen.** A swipe page that has a 全部 page does not scroll: it shows as many whole rows as fit, centred in the room it has, with its 全部 › link always in view at the foot; everything else is the 全部 page's job.
> - **Icons and names only on a glance.** An icon grid shows the icon and its name, nothing more; numbers, reasons and marks (輸出 +23%, 前期強) are on the detail page it opens (an augment opened from a champion says how it fits that champion).
> - **No panels.** Parts float with no tile, card or pill background: an icon with its name under it and one small muted line (the bare tiles: `augmentTiles(…, { bare: true })`, `.mn-aug-tiles.is-bare`; the ability card, builds, tips and the patch changes under `.mn-part`). A reason or tag is coloured text, not a filled pill.
> - **Headings, not boxes.** A section is a short heading over its row: a tier letter in its colour with a thin line after it (S / A / B / C, `tierHead`, `TIER_COLOR`) or a word; never a boxed header.
> - **Switches are words, at the top.** A choice between two or three (a play style) is the words side by side at the top of the content, just under the page hint (`textSwitch`, [[Controls]]).
> - **Links are accent text** with a chevron (全部強化 ›, `moreLink`), never a list row in a panel.
> - **One order: what matters most.** A list is ranked once (augments by tier, then score); no grouping the player does not choose by (rarity shows in the icon's frame colour).
