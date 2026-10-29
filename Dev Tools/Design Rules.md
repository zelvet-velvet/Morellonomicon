---
title: Design Rules
tags:
  - morellonomicon
  - layout
sticker: lucide//ruler
---
How the whole app looks and behaves, so every page feels the same. A shared behaviour is built once (mostly in `plugin/src/ui.ts` and `plugin/src/view.ts`) and reused; a page never makes its own version. Read this before any UI change; a new shared behaviour is written here first. Where the pages are laid out: [[Layouts]] (with the Handbook card frame). Which icon means what: [[Icons]].

---
## 📐 Layout

- **Blocks.** Every page is the blocks drawn in [[Layouts]] (phone px, 390 × 844). Sides keep 16 px margins, gaps and sizes go in 4 px steps, neighbours share edges and widths. A block that sits on the screen edge in the Layouts note does so in the app (Items' role tabs and stat rail).
- **Fixed pages with one scrolling list.** A page with a search or a filter bar on top does not scroll as a whole: the top stays and only its list scrolls (`fixedPage` and `.mn-rq-list`: Picks, Champions; Items does the same with its grid).
- **Title row.** A tab's first page has the big serif title with the palette and mode buttons; deeper pages have the top bar with Back. Over a splash the top bar is clear until the page scrolls.
- **Moving between pages.** A page slides in from the side it comes from (push, back) or rises a little (tab); Back returns to where the page was scrolled.

## 🖼️ Pictures

- **Loading look.** A picture still loading is hidden and fades in (`autoLoading`, by itself). Every block from the Layouts note that holds pictures (CSS background pictures too) is blurred with the band of light sliding over it until they are in, like the Handbook's tiles: the page marks the block's element with `layoutBlock()` and nothing else. The blocks of a page that just opened load together (none shows sharp beside one still loading); a block redrawn alone loads alone. Big single pictures (64 px or more each way) outside a block get the same look on their own frame. Something that waits for more than pictures (clips, data) uses `blockLoad` / `blockUntil`; a part that must not get the look goes under `.mn-noauto`.
- **No hard edges.** A splash or wallpaper fades out at every side where it meets the page (mask or gradient), the top under the header too.
- **Game art by address.** Riot, CommunityDragon and wiki pictures are shown from their sites, never stored in the vault.

## 🔍 Search capsule and keyboard

- **One floating capsule** at the bottom where the thumb is (Picks, Champions): search box, the mic (opens the keyboard, whose own mic key listens) and the page's main action (配對, 篩選). It floats over the list; the list's last row clears it.
- **It rides on the keyboard.** A tap starts lifting it at once to just above where the keyboard will end (the keyboard height is remembered from the last time); when the keyboard closes it starts down at once at the keyboard's pace. It never jumps when Obsidian resizes the page late, and it never restarts its move halfway (`view.ts`, Settings → Keyboard readout shows the numbers). Any new search box at the bottom is a `.mn-rq-dock` and gets this for free.
- **Typing shows results in place** of the list (rows with face, name, a short line); names are also found by sound and by aliases.

## 🎛️ Controls

- **Icons, not words,** for filters (lanes, roles, damage kinds, shop stats); the word shows in a bubble when held (`holdTip`). One idea has one icon everywhere, taken from the maps in [[Icons]].
- **The chosen one is marked by colour or a short line under it,** never a circle or ring around a Lucide icon.
- **Single or several.** A lane on Picks and a role tab on Items is one at a time (tap again to clear); filters that narrow together (Champions' lanes and filter sheet, Items' stat rail) can be several, with a clear button.
- **Segmented bars** slide their highlight to the new option and can be dragged along (`slideSeg`).
- **Swipes** read the same everywhere (the `SWIPE` numbers in `ui.ts`): Handbook cards, the tip stack, 速查 cards.

## ✍️ Words and colour

- **Less text.** Glanceable cards, icons and chips; long text folded away; no paragraphs on cards.
- **Reader text is zh_TW** with full-width punctuation (，。：（）) so lines break between phrases, and Riot's official names. UI labels in English.
- **Muted colours,** no high-saturation fills; colour carries meaning (damage kinds, rarity, mastery gold), taken from the app's variables, never picked in a page.
