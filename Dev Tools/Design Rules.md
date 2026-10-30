---
title: Design Rules
tags:
  - morellonomicon
  - layout
sticker: lucide//ruler
---
> [!abstract]+ How the whole app looks and behaves
> How the whole app looks and behaves, so every page feels the same. A shared behaviour is built once (mostly in `plugin/src/ui.ts` and `plugin/src/view.ts`) and reused; a page never makes its own version. Read this before any UI change; a new shared behaviour is written here first. Where the pages are laid out: [[Layouts]] (with the Handbook card frame). Which icon means what: [[Icons]].

---
## 📐 Layout

> [!note]+ Blocks · Fixed pages with one scrolling list · Title row · One screen, top picks · Moving between pages
> - **Blocks.** Every page is the blocks drawn in [[Layouts]] (phone px, 390 × 844). Sides keep 16 px margins, gaps and sizes go in 4 px steps, neighbours share edges and widths. A block that sits on the screen edge in the Layouts note does so in the app (Items' role tabs and stat rail).
> - **Fixed pages with one scrolling list.** A page with a search or a filter bar on top does not scroll as a whole: the top stays and only its list scrolls (`fixedPage` and `.mn-rq-list`: Picks, Champions; Items does the same with its grid).
> - **Title row.** A tab's first page has the big serif title with the palette and mode buttons; deeper pages have the top bar with Back. A page that opens with a banner picture (an item, an augment) puts it under the top bar, Back floating on it; the bar is clear until the page scrolls, and the banner ends close to what follows (no blank band).
> - **One screen, top picks.** A page with several parts does not scroll down (the champion page): it is one card like the 速查 card (`quickCard`), its pages turned by tapping a half of the card or swiping sideways; each page shows only its top picks and a **全部 ›** that opens the full list as a page of its own.
> - **Moving between pages.** A page slides in from the side it comes from (push, back) or rises a little (tab); Back returns to where the page was scrolled.

## 🖼️ Pictures

> [!note]+ Loading look · No hard edges · Game art by address
> - **Loading look.** A picture that arrives within a short grace time (90 ms: from the cache, or quick) just shows, so a redraw never blinks; a slower one fades in (`autoLoading`, by itself): a small one (an icon, a face) shows a soft placeholder in its own shape meanwhile, a big one stays clear and its frame gets the block look. A clip stays clear over its card until its first frame, then fades in. Pictures that a page redraws on every tap are never `loading="lazy"` (a lazy picture blinks even from the cache). Every block from the Layouts note that holds pictures (CSS background pictures too) is blurred with the band of light sliding over it until they are in, like the Handbook's tiles: the page marks the block's element with `layoutBlock()` and nothing else. The blocks of a page that just opened load together (none shows sharp beside one still loading), unless a block is marked to load on its own (`layoutBlock(el, true)`: Items' role tabs, stat rail and list); once a block has loaded, a redraw (a champion picked, a filter changed) does not veil it again, its new pictures only fade in. The veil covers the part of the block on the screen and stays over it while the page or list scrolls; while it is on, the block takes no taps and does not scroll. A CSS background picture is kept once loaded and retried when its fetch fails, so a block never stays blank without the look. Big single pictures (64 px or more each way) outside a block get the same look on their own frame. Something that waits for more than pictures (clips, data) uses `blockLoad` / `blockUntil`; a part that must not get the look goes under `.mn-noauto`.
> - **No hard edges.** A splash or wallpaper fades out at every side where it meets the page (mask or gradient), the top under the header too.
> - **Game art by address.** Riot, CommunityDragon and wiki pictures are shown from their sites, never stored in the vault.

## ✅ Picture check after every page change

> [!note]+ Never an empty page · Every picture block has its look · Fetch what comes next ahead · The first screen first · Cached pictures show at once · A failure never leaves a hole · Say what was checked
> A rule from Zaviel (2026-10-30): after a new page, or any change to a page, its picture loading is reviewed before the change is committed, so whoever opens the page never sees an empty screen or empty frames.
>
> - **Never an empty page.** From the first frame the page shows either its pictures or its loading look (the blur with the band of light); never a blank area, an empty frame or a picture that pops in without a placeholder.
> - **Every picture block has its look.** Each block from [[Layouts]] that holds pictures (CSS backgrounds too) is marked with `layoutBlock()` (or `blockUntil` / `blockLoad` when it waits for more than pictures: clips, data); a big single picture outside a block gets the look by itself (`autoLoading`). A new block is checked for this one by one.
> - **Fetch what comes next ahead.** What the user is likely to open next is fetched before the tap, at a quiet moment: the icons after start-up (`warmPictures`), the next topic's clips on the Handbook home (`preloadClip`), the next Picks card's skins, the clip of an ability before its card shows. A new page says what leads to it and starts its pictures there when it is cheap (a few icons, one splash), never a whole gallery.
> - **The first screen first.** The pictures in view load before those further down or in a hidden tab (`loading="lazy"` only for those, and never for pictures a page redraws on every tap); heavy ones (splash, clips) do not hold up the small ones.
> - **Cached pictures show at once.** A redraw or a page you come back to shows its cached pictures without the loading look (the 90 ms grace); nothing blinks.
> - **A failure never leaves a hole.** A picture that fails is retried (CSS backgrounds) or its box is taken away or replaced by a plain tile; a clip that cannot play removes its frame; nothing waits forever (every wait has a time limit).
> - **Say what was checked.** The report of the change names which pictures the page has, how each one loads (cache, preload, the loading look) and what the user sees on a slow connection; what could only be seen on the phone is said so.

## 🔍 Search capsule and keyboard

> [!note]+ One floating capsule · It rides on the keyboard · Typing shows results in place
> - **One floating capsule** at the bottom where the thumb is (Picks, Champions): search box, the mic (opens the keyboard, whose own mic key listens) and the page's main action (配對, 篩選). It floats over the list; the list's last row clears it.
> - **It rides on the keyboard.** A tap starts lifting it at once to just above where the keyboard will end (the keyboard height is remembered from the last time); when the keyboard closes it starts down at once at the keyboard's pace. It never jumps when Obsidian resizes the page late, and it never restarts its move halfway (`view.ts`, Settings → Keyboard readout shows the numbers). Any new search box at the bottom is a `.mn-rq-dock` and gets this for free.
> - **Typing shows results in place** of the list (rows with face, name, a short line); names are also found by sound and by aliases.

## 🎛️ Controls

> [!note]+ Icons, not words · The chosen one is marked by colour or a short line under it · Single or several · Segmented bars · Swipes
> - **Icons, not words,** for filters (lanes, roles, damage kinds, shop stats); the word shows in a bubble when held (`holdTip`). One idea has one icon everywhere, taken from the maps in [[Icons]].
> - **The chosen one is marked by colour or a short line under it,** never a circle or ring around a Lucide icon.
> - **Single or several.** A lane (Picks, Champions) and a role tab on Items is one at a time (tap again to clear); filters that narrow together (Champions' filter sheet, Items' stat rail) can be several, with a clear button.
> - **Segmented bars** slide their highlight to the new option and can be dragged along (`slideSeg`).
> - **Swipes** read the same everywhere (the `SWIPE` numbers in `ui.ts`): Handbook cards, the tip stack, 速查 cards.

## ✍️ Words and colour

> [!note]+ Less text · Reader text is zh_TW · Muted colours
> - **Less text.** Glanceable cards, icons and chips; long text folded away; no paragraphs on cards.
> - **Reader text is zh_TW** with full-width punctuation (，。：（）) so lines break between phrases, and Riot's official names. UI labels in English.
> - **Muted colours,** no high-saturation fills; colour carries meaning (damage kinds, rarity, mastery gold), taken from the app's variables, never picked in a page.
