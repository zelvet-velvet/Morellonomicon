---
title: Pages
tags:
  - morellonomicon
  - layout
sticker: lucide//layout-template
---
> [!abstract]+ How a page is built, arrives and sits on the screen
> Part of [[Design Rules]] (read that first). Code: `plugin/src/view.ts` (the app screen: top bar, page area, tab bar), `plugin/src/pages/index.ts` (`ROUTES`), `centreBelow` / `empty` / `fixedPage` in `ui.ts`.

---
## 🗂️ Page kinds

> [!note]+ Routes · Title row · Banner pages · Fixed pages with one scrolling list · One screen, own pages
> - **Every page is a route** in `plugin/src/pages/index.ts` (`ROUTES`) with its `needs` and optional `next` ([[Pictures]]); a new page or sub page cannot be added without a `needs` entry: the build fails.
> - **Title row.** A tab's first page has the big serif title with the palette and mode buttons (`page()`); deeper pages have the top bar with Back and the page's title, which shows once the page scrolls. Back on a sub page sits on the title's line.
> - **Banner pages** (a champion, an augment, an item: `OVERLAY_PAGES` in `view.ts`) put their picture under the top bar, Back floating on it in a dark disc; the bar is clear until the page has scrolled 220 px, then gets its background back. The banner ends close to what follows (no blank band). A full-screen page with no top bar at all (速查's swipe) is `IMMERSIVE_PAGES`, or a page that returns `immersive`.
> - **Fixed pages with one scrolling list.** A page with a search or a filter bar on top does not scroll as a whole: the top stays and only its list scrolls (`fixedPage` and `.mn-rq-list`: Picks, Champions; Items does the same with its grid). With nothing to scroll, iOS cannot jump the page when the keyboard opens.
> - **One screen, own pages.** A page with several parts does not scroll down (the champion page, v3); its parts are pages that swipe sideways. The details are in [[Champion Page]].
> - **Page art.** A sub page that sits on a darkened picture gives it as `art`; the app draws it on its own layer under the scrolling area (`.mn-page-art`, fading in over 0.25 s), so scrolling or a page sliding in never moves it (a picture inside the page glitched).

## ➡️ Moving between pages

> [!note]+ How a page arrives · Where it is scrolled · When it waits
> - **How a page arrives** (`arrive()` in `view.ts`): it fades in while sliding 28 px from the side it comes from (push: from the right, back: from the left) or rising 10 px (another tab), 240 ms, `cubic-bezier(0.2, 0.8, 0.2, 1)`. A redraw of the same page (a filter changed, `redraw()`) does not move. Nothing moves with *reduce motion* on.
> - **No fades while the page flips.** While the new page goes in, the top bar's lines and title switch at once (`.is-switching`), so a line fading out on the new page never reads as a blink.
> - **Where it is scrolled.** A page opened on top of another, and a banner page, start at the top; a tab or a page you come back to is where you left it (Back returns to where the page was scrolled). Never a sideways offset left from the page before.
> - **When it waits.** A page shows at once; its blocks load on their own ([[Pictures]]). Only a page that returns `ready` is waited for: the old page stays up to 250 ms; if the pictures are in by then the new page shows complete, else it shows under the page veil, kept at least 500 ms. At start-up the first page shows under the veil until the data has settled and its first pictures are in (at most 7 s).
> - **Clips are let go** when a page is replaced (`releaseVideos`): a phone has only a few video decoders.

## ⚖️ Short pages and empty states

> [!note]+ Centre what is short · Empty states
> - **A page shorter than the screen** keeps its title row or banner at the top and centres the rest down the room under it with `centreBelow(el, n)` (`ui.ts`: Home, 最近對戰, the augment page; the item page and 全部概覽 do the same with `.is-centred`). A longer page still starts at the top.
> - **An empty state** is `empty(parent, { icon, title, text })`, centred in the room it has; a page that fails to draw shows one too (`This page could not be drawn`).
