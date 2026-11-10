---
title: Pictures
tags:
  - morellonomicon
  - layout
sticker: lucide//image
---
> [!abstract]+ How pictures and clips load, look and are fetched ahead
> Part of [[Design Rules]] (read that first). Code: the loading look in `plugin/src/ui.ts` (`layoutBlock`, `blockLoad`, `blockUntil`, `autoLoading`, `whenLoaded`), the page veil in `view.ts`, every network address and the fetch-ahead queue in `plugin/src/media.ts`, each page's `needs` / `next` in `plugin/src/pages/index.ts`.

---
## 🌫️ The loading look

> [!note]+ Only a real load · Small and big pictures · Picture blocks · Waiting for more than pictures
> - **Only a real load shows the loading look** (Zaviel, 2026-11-02). Nothing is blurred from the first frame or kept blurred for a fixed time: a block or a card pile is checked first (held out of sight at most 120 ms, `BLOCK_DELAY_MS`) and shows sharp when its pictures are already there (cached, fetched ahead, a clip in memory); only one still loading after that gets the blur and the band, and then keeps it at least 500 ms (`BLOCK_MIN_MS`) so it is no blink, at most 8 s. The Handbook deck follows this too.
> - **The look:** the block is blurred with a band of light sliding over it; when the pictures are in, the blur fades (0.4 s) while the band finishes its pass and goes off the left edge, so the light seems to sweep the sharp block into view (`trackBand` / `endBand`).
> - **Single pictures** (`autoLoading`, by itself for every page): a picture that arrives within 90 ms (from the cache, or quick) just shows, so a redraw never blinks; a slower one fades in (from 0.25 opacity, 0.22 s): a small one (an icon, a face) shows a soft placeholder in its own shape meanwhile, a big one (64 px or more each way) stays clear and its frame gets the block look. A clip stays clear over its card until its first frame, then fades in (0.3 s).
> - **Never `loading="lazy"`** for pictures a page redraws on every tap (a lazy picture blinks even from the cache).
> - **Picture blocks.** Every block from the Layouts note that holds pictures (CSS background pictures too) is marked with `layoutBlock()` and nothing else. The blocks of a page that just opened load together (none shows sharp beside one still loading), unless a block is marked to load on its own (`layoutBlock(el, true)`: Items' role tabs, stat rail and list); once a block has loaded, a redraw (a champion picked, a filter changed) does not veil it again, its new pictures only fade in. The veil covers the part of the block on the screen and stays over it while the page or list scrolls; while it is on, the block takes no taps and does not scroll. A CSS background picture is kept once loaded and retried when its fetch fails, so a block never stays blank without the look.
> - **Waiting for more than pictures** (clips, data): `blockLoad` / `blockUntil`. A part that must not get the look goes under `.mn-noauto`.

## 🖼️ Edges

> [!note]+ No hard edges
> - **No hard edges.** A splash or wallpaper fades out at every side where it meets the page (mask or gradient), the top under the header too.
> - A loading veil inside a faded (masked) frame uses no `backdrop-filter`: on iOS that layer ignores the mask and shows as a hard rectangle.
> - A clip that has to move or be resized is drawn on a canvas: a `<video>` moved around the page came out on iOS as a hard rectangle that ignored the box's fade and size.

## ✅ The picture check (after every page change)

> [!note]+ Never an empty page · Ready before it shows · Every picture block has its look · Fetch what comes next ahead · The first screen first · Cached pictures show at once · A failure never leaves a hole
> - **Never an empty page.** From the first frame the page shows either its pictures or its loading look; never a blank area, an empty frame or a picture that pops in without a placeholder.
> - **Ready before it shows** (Zaviel, 2026-10-31). An icon, picture or clip the user can bring up with a tap or a swipe (the next page of a swipe, a tapped ability, a picked tab) is loaded before it is brought up, so it shows at once: no empty slot, no stand-in picture, no blink. Load it somewhere hidden first and move it in when asked (the champion page's clip shelf: every ability's clip loads in a 4 px holder on the screen, since iOS loads a clip only while it is on the screen, and stays there; the clip box draws the playing one on a canvas; the browser's own download-and-play-from-memory showed no frame on the phone). The loading look is only for what could not be loaded in time (a slow connection), never the usual way something appears.
> - **Every picture block has its look.** Each block from [[Layouts]] that holds pictures is marked with `layoutBlock()` (or `blockUntil` / `blockLoad`); a big single picture outside a block gets the look by itself. A new block is checked for this one by one.
> - **Fetch what comes next ahead.** One place does it, `plugin/src/media.ts`, so no page has to remember: every network picture address is built there (`art.splash`, `art.centered`, `art.loading`, `art.item`…; never write a Data Dragon or CommunityDragon address in a page), and one queue fetches ahead by urgency (now: the tab under the finger; soon: one tap away; idle: after start-up), each address once, keeping fetched pictures decoded. Every route has its `needs` (the big pictures at its top, the art behind it, its first clips; champion, augment and item icons come at start-up) and optionally `next` (the pages one tap away, fetched 600 ms after it shows, like the Handbook's next topic). After start-up every tab's first page is fetched; pressing a tab starts its pictures before the tap ends. A list that shows pictures later uses `warmPictures`. Never a whole gallery ahead.
> - **A page's art is there the moment it opens** (Zaviel, 2026-11-02: a late splash is not acceptable): every element that opens a page with big pictures (a champion, a Handbook topic, 速查's cards) is marked with `goes(el, frame)` beside its click handler; while it is on screen for a quarter second (or within 120 px of it) its page's `needs` are fetched, and a finger touching it puts them first in line.
> - **Check:** Settings → Picture readout shows `cold N`, the pictures that showed still loading without being fetched ahead; open the new page, its sub pages and tabs: it should say `cold 0`, else add what it lists to the page's `needs` (or to `next` on the page before).
> - **The first screen first.** The pictures in view load before those further down or in a hidden tab (`loading="lazy"` only for those); heavy ones (splash, clips) do not hold up the small ones.
> - **Cached pictures show at once.** A redraw or a page you come back to shows its cached pictures without the loading look (the 90 ms grace); nothing blinks.
> - **A failure never leaves a hole.** A picture that fails is retried (CSS backgrounds) or its box is taken away or replaced by a plain tile; a clip that cannot play removes its frame; nothing waits forever (every wait has a time limit).
