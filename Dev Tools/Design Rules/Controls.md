---
title: Controls
tags:
  - morellonomicon
  - layout
sticker: lucide//sliders-horizontal
---
> [!abstract]+ Filters, tabs, switches, bubbles, panels and swipes
> Part of [[Design Rules]] (read that first; the press look is there, since every button has it). Code: `plugin/src/ui.ts` (`segmented`, `slideSeg`, `textSwitch`, `styleSwitch`, `chip`, `roleChip`, `laneChip`, `fgrid`, `holdTip`, `tip`, `SWIPE`).

---
## 🎛️ Choosing

> [!note]+ Icons, not words · The chosen one · Single or several · Segmented bars · Words for a small switch
> - **Icons, not words,** for filters (lanes, roles, damage kinds, shop stats); the word shows in a bubble when held (`holdTip`: a hold of 280 ms; a quick tap keeps the element's own action). `tip(anchor, text)` shows a bubble on a tap (a lane with no data says 還沒有分路資料); a bubble closes on the next touch or scroll. One idea has one icon everywhere ([[Icons]]).
> - **The chosen one is marked by colour or a short line under it,** never a circle or ring around a Lucide icon.
> - **Single or several.** A lane (Picks, Champions) and a role tab on Items is one at a time (tap again to clear); filters that narrow together (Champions' filter sheet, Items' stat rail) can be several, with a clear button. A row of equal filter cells fills the width (`fgrid`).
> - **Segmented bars** (`segmented` + `slideSeg`) are for the app's main tabs and filters: their highlight slides to the new option (0.28 s, `cubic-bezier(0.2, 0.8, 0.2, 1)`) and can be dragged along; the words change colour over 0.2 s. The app's tab bar, rebuilt with the same tabs (a data refresh), only moves its mark (no redrawn icons, no slide again).
> - **Words for a small switch.** A choice between two or three inside a page (a play style) is the words side by side, the chosen one in the accent colour with a short line under it, never a box, even while pressed (`textSwitch`; [[Champion Page]]).

## 📂 Things that open

> [!note]+ Panels that open in place · The filter sheet
> - **A panel that opens in place** (a skill's detail, an item's panel, a patch change, the filter panel) appears with `mn-pop`: a fade while it drops 6 px into place, 0.16 s. It closes at once. A caret beside its heading turns (0.15 s).
> - **The filter sheet** (Champions): the 篩選 button in the bottom capsule opens the filters as a sheet right above the capsule (`.mn-fsheet`, at most 55 % of the screen, scrolling inside); the button is accent while the sheet is open or a filter is on.

## 👆 Swipes

> [!note]+ One way to read a swipe
> - **Swipes** read the same everywhere (the `SWIPE` numbers in `ui.ts`: Handbook cards, the tip stack, 速查 cards): the direction is decided after 6 px (sideways wins unless the move is clearly vertical), a drag past a quarter of the width or a quick flick (0.5 px/ms over 24 px) turns the card; anything less springs back. A card settles over 0.34 s.
> - **The champion page's pager** follows the finger and lands on a page by itself ([[Champion Page]]); the browser's scroll snapping is not used (iOS left it half way).
> - **Near the bottom edge** (28 px) a drag is left to iOS's home-bar swipe.
