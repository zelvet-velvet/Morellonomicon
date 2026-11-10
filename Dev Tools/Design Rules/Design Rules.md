---
title: Design Rules
tags:
  - morellonomicon
  - layout
sticker: lucide//ruler
---
> [!abstract]+ How the whole app looks and behaves
> How the whole app looks and behaves, so every page feels the same. A shared behaviour is built once (mostly in `plugin/src/ui.ts` and `plugin/src/view.ts`) and reused; a page never makes its own version. This note holds the rules for every page; the topic notes beside it hold the rest. Read this one before any UI change, then the topic notes the index lists for what you build; a new shared behaviour is written in the right note first (in this one if it applies to every page). Where the pages are laid out: [[Layouts]] (with the Handbook card frame). Which icon means what: [[Icons]].

---
## 🧭 Index: building X → read

| Building or changing | Read |
| :--- | :--- |
| Any page | this note, then the page's block in [[Layouts]] and its file in `plugin/src/pages/` |
| A new page, a sub page, the title row, how a page arrives, a page shorter than the screen | [[Pages]] |
| Anything with pictures or clips (nearly every page) | [[Pictures]] |
| The champion page, its swipe pages (概覽, 技能, 出裝, 強化, 技巧) or the pages they open (全部概覽, 全部強化 …) | [[Champion Page]], [[Pages]] |
| Filters, tabs, switches, chips, hold bubbles, panels that open, the filter sheet, card swipes | [[Controls]] |
| A search box, the bottom capsule, anything that moves with the keyboard | [[Search]] |
| An animation, a fade, a slide, a chart's change | [[Motion]] |

## 📐 Every page

> [!note]+ Blocks · Balance · A press fades · Words · Colour · Icons · Game art by address
> - **Blocks.** Every page is the blocks drawn in [[Layouts]] (phone px, 390 × 844). Sides keep 16 px margins, gaps and sizes go in 4 px steps, neighbours share edges and widths. A block that sits on the screen edge in the Layouts note does so in the app (Items' role tabs and stat rail).
> - **No big empty space** (Zaviel, 2026-10-30). A screen is not left with a large blank area while its content sits bunched at the top or a side; the content takes the room it has (spread out, sized up) or the room is given to something else (a bigger picture, the next block).
> - **Balance the screen.** Visual weight is spread across the screen: components are not crowded to one side or squeezed together while space is left elsewhere; gaps between neighbours are even.
> - **Few things sit in the middle.** When a page or a block holds only one or a few components, they are centred (across, and down within the block), never left in a corner with empty space beside or below them (an empty state, a short list, a page of the champion swipe block). How: [[Pages]] (`centreBelow`, `empty()`).
> - **A press fades, never a disc** (Zaviel, 2026-10-31). A button, icon button, tile, face or text link shows it is held by fading and/or shrinking a little (`:active`: `opacity: 0.5` and `scale(0.92)` on bare buttons and links, `scale(0.92–0.98)` on tiles and faces, 0.12 s); it never gets a grey disc or box, which on a phone stays after the tap and covered the title next to Back. Obsidian's own hover / press / focus fill is cleared for every button in the app (`styles.css`, "a press fades"); a button with a fill of its own keeps it, and Back on a splash keeps its dark disc, unchanged when pressed. A list row (`row()` with a tap) is the one exception: it lights its own row.
> - **Less text.** Glanceable cards, icons and chips; long text folded away; no paragraphs on cards.
> - **Reader text is zh_TW** with full-width punctuation (，。：（）) so lines break between phrases, and Riot's official names. UI labels in English.
> - **Muted colours,** no high-saturation fills; colour carries meaning (damage kinds, rarity, mastery gold, tiers), taken from the app's variables and maps (`DAMAGE_COLOR`, `STAT_COLOR`, `TIER_COLOR`, `ITEM_CAT_COLOR` in `ui.ts`), never picked in a page.
> - **One idea, one icon,** taken from the maps in [[Icons]] (`DAMAGE_ICON`, `STAT_ICON`, `ROLE_ICON`, `LANES`, `TAB_ICON`, `TAGS`); a new idea gets its icon in the map and in [[Icons]] first.
> - **Game art by address.** Riot, CommunityDragon and wiki pictures are shown from their sites, never stored in the vault; every address is built in `plugin/src/media.ts` ([[Pictures]]).

## 🧩 Shared parts

> [!note]+ Use these; never a page's own version
> | Part | Where | What it is |
> | :--- | :--- | :--- |
> | `h`, `icon`, `svg` | `ui.ts` | elements (text always through textContent), Lucide icons, SVG |
> | `page`, `group`, `row` | `ui.ts` | a big-title page, an inset list, a list row |
> | `centreBelow`, `empty` | `ui.ts` | a short page centred under its title; an empty state ([[Pages]]) |
> | `fixedPage` | `ui.ts` | a page whose top stays and only its list scrolls ([[Pages]]) |
> | `layoutBlock`, `blockLoad`, `blockUntil`, `autoLoading`, `whenLoaded` | `ui.ts` | the loading look ([[Pictures]]) |
> | `goes`, `warmPictures`, route `needs` / `next` | `ui.ts`, `pages/index.ts`, `media.ts` | fetching ahead ([[Pictures]]) |
> | `segmented` + `slideSeg`, `textSwitch`, `styleSwitch`, `chip`, `roleChip`, `laneChip`, `fgrid` | `ui.ts` | choices and filters ([[Controls]]) |
> | `holdTip`, `tip` | `ui.ts` | a word in a bubble when an icon is held / tapped ([[Controls]]) |
> | `SWIPE` | `ui.ts` | how every card swipe is read ([[Controls]]) |
> | `tierHead`, `moreLink`, `augmentTiles(…, { bare: true })` | `ui.ts`, `pages/detail.ts` | the champion page family's parts ([[Champion Page]]) |
> | `augIcon`, `shopIcon`, `shopRoleIcon`, `roleArt`, `scalingParts` | `ui.ts` | game icons and coloured scaling text |
> | `radar` | `ui.ts` | a radar chart of 3+ axes |
> | `haptic` | `ui.ts` | the tick a phone gives, where it can |
> | `.mn-rq-dock` | `styles.css`, `view.ts` | a search capsule that rides on the keyboard ([[Search]]) |

## ✅ After every page change

> [!note]+ The picture check · The balance check · Say what was checked
> A rule from Zaviel (2026-10-30): after a new page, or any change to a page, these are reviewed before the change is committed.
>
> - **Picture check** (the full list in [[Pictures]]): never an empty page; what a tap or swipe brings up is loaded before it is asked for; every picture block has its look (`layoutBlock()`); the page has its route `needs` (the build fails without) and Settings → Picture readout says `cold 0` after opening it, its sub pages and tabs; the first screen loads first; cached pictures show at once; a failure never leaves a hole.
> - **Balance check:** no big empty space, weight spread, few components centred (above).
> - **Motion check:** any movement uses the timings in [[Motion]], not new ones.
> - **Say what was checked.** The report of the change names which pictures the page has, whether the screen is balanced, how each picture loads (cache, preload, the loading look) and what the user sees on a slow connection; what could only be seen on the phone is said so.
