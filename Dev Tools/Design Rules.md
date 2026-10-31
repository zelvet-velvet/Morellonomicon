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
> - **One screen, own pages.** A page with several parts does not scroll down (the champion page, v3): Riot's centered splash fills the whole page behind it, fading out under the status bar and at its foot; the name, title and roles (and the tags under them) sit at the foot of the first page, inside it, so they slide away with it when the pages swipe, clear of the tab bar; above it the pages swipe sideways (they follow the finger and land on a page: `championCard`'s pager, not the browser's snapping, which iOS left half way) with their parts floating on the art, no frames, no page titles and no 全部 button; the first page keeps the art bright with its parts just above the name, and tapping its chart, tiles or tags opens its full page; the others darken the art and show their whole detail in the page (scrolling inside when long); a small page hint (a dot per page, the current one lit) floats at the top middle.
> - **Moving between pages.** A page slides in from the side it comes from (push, back) or rises a little (tab); Back returns to where the page was scrolled.

## 🦸 Champion page family

> [!note]+ One look for the champion page, its swipe pages and their sub pages · No panels · Words for switches · Tier order
> A rule from Zaviel (2026-10-31): the champion page's swipe pages (概覽, 技能, 出裝, 強化, 技巧) and the pages they open (全部概覽, 全部強化 …) share one style, so a sub page reads as the same page opened further, not another app.
>
> - **The same few parts, the same art.** Both are built from the same parts and helpers; a sub page sits on the same darkened splash as the swipe pages past 概覽: the page gives it as `art` and the app draws it on its own layer under the scrolling area (`.mn-page-art`), so scrolling or a page sliding in never moves it (a picture inside the page glitched); it comes from the cache.
> - **Tap a side to switch the play style.** On a page with play style words (強化, 全部強化), a tap on the left or right fifth of the page (not on an augment) switches to the style before or after, like turning a story; the pages themselves only swipe.
> - **A glance page fits one screen.** A swipe page that has a 全部 page does not scroll: it shows as many whole rows as fit, centred in the room it has, with its 全部 › link always in view at the foot; everything else is the 全部 page's job.
> - **Icons and names only on a glance.** An icon grid shows the icon and its name, nothing more; numbers, reasons and marks (輸出 +23%, 前期強) are on the detail page it opens (an augment opened from a champion says how it fits that champion).
> - **No panels.** Parts float with no tile, card or pill background: an icon with its name under it and one small muted line (the bare tiles: `augmentTiles(…, { bare: true })`, `.mn-aug-tiles.is-bare`). A reason or tag is coloured text, not a filled pill.
> - **Headings, not boxes.** A section is a short heading over its row: a tier letter in its colour with a thin line after it (S / A / B / C, `tierHead`) or a word; never a boxed header.
> - **Switches are words, at the top.** A choice between two or three (a play style) is the words side by side at the top of the content, just under the page hint; the chosen one is the accent colour with a short line under it, never a box, even while pressed (`textSwitch`); segmented bars stay for the app's main tabs and filters.
> - **Links are accent text** with a chevron (全部強化 ›), never a list row in a panel.
> - **One order: what matters most.** A list is ranked once (augments by tier, then score); no grouping the player does not choose by (rarity shows in the icon's frame colour).

## ⚖️ Balance

> [!note]+ No big empty space · Balance the screen · Few things sit in the middle
> A rule from Zaviel (2026-10-30), checked with every new page or page change, like the picture check.
>
> - **No big empty space.** A screen is not left with a large blank area while its content sits bunched at the top or a side; the content takes the room it has (spread out, sized up) or the room is given to something else (a bigger picture, the next block).
> - **Balance the screen.** Visual weight is spread across the screen: components are not crowded to one side or squeezed together while space is left elsewhere; gaps between neighbours are even.
> - **Few things sit in the middle.** When a page or a block holds only one or a few components, they are centred (across, and down within the block), never left in a corner with empty space beside or below them (an empty state, a short list, a page of the champion swipe block).
> - **How:** a page shorter than the screen keeps its title row or banner at the top and centres the rest down the room under it with `centreBelow(el, n)` (`ui.ts`: Home, 最近對戰, the augment page; the item page and 全部概覽 do the same); an empty state (`empty()`) is centred in the room it has.

## 🖼️ Pictures

> [!note]+ Loading look · No hard edges · Game art by address
> - **Loading look.** A picture that arrives within a short grace time (90 ms: from the cache, or quick) just shows, so a redraw never blinks; a slower one fades in (`autoLoading`, by itself): a small one (an icon, a face) shows a soft placeholder in its own shape meanwhile, a big one stays clear and its frame gets the block look. A clip stays clear over its card until its first frame, then fades in. Pictures that a page redraws on every tap are never `loading="lazy"` (a lazy picture blinks even from the cache). Every block from the Layouts note that holds pictures (CSS background pictures too) is blurred with the band of light sliding over it until they are in, like the Handbook's tiles: the page marks the block's element with `layoutBlock()` and nothing else. The blocks of a page that just opened load together (none shows sharp beside one still loading), unless a block is marked to load on its own (`layoutBlock(el, true)`: Items' role tabs, stat rail and list); once a block has loaded, a redraw (a champion picked, a filter changed) does not veil it again, its new pictures only fade in. The veil covers the part of the block on the screen and stays over it while the page or list scrolls; while it is on, the block takes no taps and does not scroll. A CSS background picture is kept once loaded and retried when its fetch fails, so a block never stays blank without the look. Big single pictures (64 px or more each way) outside a block get the same look on their own frame. Something that waits for more than pictures (clips, data) uses `blockLoad` / `blockUntil`; a part that must not get the look goes under `.mn-noauto`.
> - **No hard edges.** A splash or wallpaper fades out at every side where it meets the page (mask or gradient), the top under the header too. A loading veil inside a faded (masked) frame uses no `backdrop-filter`: on iOS that layer ignores the mask and shows as a hard rectangle.
> - **Game art by address.** Riot, CommunityDragon and wiki pictures are shown from their sites, never stored in the vault.

## ✅ Picture check after every page change

> [!note]+ Never an empty page · Ready before it shows · Every picture block has its look · Fetch what comes next ahead · The first screen first · Cached pictures show at once · A failure never leaves a hole · Say what was checked
> A rule from Zaviel (2026-10-30): after a new page, or any change to a page, its picture loading is reviewed before the change is committed, so whoever opens the page never sees an empty screen or empty frames.
>
> - **Never an empty page.** From the first frame the page shows either its pictures or its loading look (the blur with the band of light); never a blank area, an empty frame or a picture that pops in without a placeholder.
> - **Ready before it shows** (Zaviel, 2026-10-31). An icon, picture or clip the user can bring up with a tap or a swipe (the next page of a swipe, a tapped ability, a picked tab) is loaded before it is brought up, so it shows at once: no empty slot, no stand-in picture, no blink. Load it somewhere hidden first and move it in when asked (the champion page's clip shelf: every ability's clip loads in a 4 px holder on the screen, since iOS loads a clip only while it is on the screen; the browser's own download-and-play-from-memory showed no frame on the phone). The loading look is only for what could not be loaded in time (a slow connection), never the usual way something appears. Checked with every change, like the rest of this list.
> - **Every picture block has its look.** Each block from [[Layouts]] that holds pictures (CSS backgrounds too) is marked with `layoutBlock()` (or `blockUntil` / `blockLoad` when it waits for more than pictures: clips, data); a big single picture outside a block gets the look by itself (`autoLoading`). A new block is checked for this one by one.
> - **Fetch what comes next ahead.** What the user is likely to open next is fetched before the tap, at a quiet moment: the icons after start-up (`warmPictures`), the next topic's clips on the Handbook home (`preloadClip`), the next Picks card's skins, the clip of an ability before its card shows. A new page says what leads to it and starts its pictures there when it is cheap (a few icons, one splash), never a whole gallery.
> - **The first screen first.** The pictures in view load before those further down or in a hidden tab (`loading="lazy"` only for those, and never for pictures a page redraws on every tap); heavy ones (splash, clips) do not hold up the small ones.
> - **Cached pictures show at once.** A redraw or a page you come back to shows its cached pictures without the loading look (the 90 ms grace); nothing blinks.
> - **A failure never leaves a hole.** A picture that fails is retried (CSS backgrounds) or its box is taken away or replaced by a plain tile; a clip that cannot play removes its frame; nothing waits forever (every wait has a time limit).
> - **Say what was checked.** The report of the change names which pictures the page has, whether the screen is balanced (see Balance), how each one loads (cache, preload, the loading look) and what the user sees on a slow connection; what could only be seen on the phone is said so.

## 🔍 Search capsule and keyboard

> [!note]+ One floating capsule · It rides on the keyboard · Typing shows results in place
> - **One floating capsule** at the bottom where the thumb is (Picks, Champions): search box, the mic (opens the keyboard, whose own mic key listens) and the page's main action (配對, 篩選). It floats over the list; the list's last row clears it.
> - **It rides on the keyboard.** A tap starts lifting it at once to just above where the keyboard will end (the keyboard height is remembered from the last time); when the keyboard closes it starts down at once at the keyboard's pace. It never jumps when Obsidian resizes the page late, and it never restarts its move halfway (`view.ts`, Settings → Keyboard readout shows the numbers). Any new search box at the bottom is a `.mn-rq-dock` and gets this for free.
> - **Typing shows results in place** of the list (rows with face, name, a short line); names are also found by sound and by aliases.

## 🎛️ Controls

> [!note]+ Icons, not words · The chosen one is marked by colour or a short line under it · Single or several · Segmented bars · Swipes
> - **Icons, not words,** for filters (lanes, roles, damage kinds, shop stats); the word shows in a bubble when held (`holdTip`). One idea has one icon everywhere, taken from the maps in [[Icons]].
> - **The chosen one is marked by colour or a short line under it,** never a circle or ring around a Lucide icon.
> - **A press fades, never a disc** (Zaviel, 2026-10-31). An icon button or text link (Back, the palette and mode buttons, 全部 ›, an augment, a face) shows it is held by fading and shrinking a little; it never gets a grey disc or box, which on a phone stays after the tap and covered the title next to Back. Obsidian's own hover / press / focus fill is cleared for every button in the app; a button with a fill of its own keeps it, and Back on a splash keeps its dark disc, unchanged when pressed.
> - **Single or several.** A lane (Picks, Champions) and a role tab on Items is one at a time (tap again to clear); filters that narrow together (Champions' filter sheet, Items' stat rail) can be several, with a clear button.
> - **Segmented bars** slide their highlight to the new option and can be dragged along (`slideSeg`).
> - **Swipes** read the same everywhere (the `SWIPE` numbers in `ui.ts`): Handbook cards, the tip stack, 速查 cards.

## ✍️ Words and colour

> [!note]+ Less text · Reader text is zh_TW · Muted colours
> - **Less text.** Glanceable cards, icons and chips; long text folded away; no paragraphs on cards.
> - **Reader text is zh_TW** with full-width punctuation (，。：（）) so lines break between phrases, and Riot's official names. UI labels in English.
> - **Muted colours,** no high-saturation fills; colour carries meaning (damage kinds, rarity, mastery gold), taken from the app's variables, never picked in a page.
