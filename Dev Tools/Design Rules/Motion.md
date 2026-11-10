---
title: Motion
tags:
  - morellonomicon
  - layout
sticker: lucide//move
---
> [!abstract]+ The app's movements and their timings
> Part of [[Design Rules]] (read that first). A new movement reuses one of these; a new kind is written here first. The app's ease for anything that travels is `cubic-bezier(0.2, 0.8, 0.2, 1)` (fast start, soft landing); fades are `ease-out`. With *reduce motion* on, pages do not slide and stamps do not pop.

---
## ⏱️ Timings

> [!note]+ Pages · Presses · Choices · Pictures · Charts · Panels · Swipes
> | What moves | How | Where |
> | :--- | :--- | :--- |
> | A page arriving | fade + 28 px from the side (push / back) or 10 px up (tab), 240 ms | `arrive()`, `view.ts` ([[Pages]]) |
> | The top bar's line and title | fade 0.15 s while scrolling; none while a page flips | `.mn-top`, `.is-switching` |
> | A press | fade to 0.5 and / or shrink to 0.92–0.98, 0.12 s | `:active` rules ([[Design Rules]]) |
> | A segmented bar's highlight | slides 0.28 s; the words' colour 0.2 s | `slideSeg` ([[Controls]]) |
> | A panel opening in place | fade + 6 px drop, 0.16 s (`mn-pop`); closes at once | [[Controls]] |
> | A hold bubble | fade 0.12 s | `holdTip`, `tip` |
> | A picture arriving late | from 0.25 opacity, 0.22 s (`is-arrived`); a clip 0.3 s | `autoLoading` ([[Pictures]]) |
> | The loading look leaving | the blur fades 0.4 s while the band finishes its pass; shown at least 500 ms | `endBand`, `blockUntil` |
> | Page art behind a sub page | fade 0.25 s | `.mn-page-art` |
> | The champion pager landing | 0.32 s; the art darkens 0.35 s; a page's skin fades 0.3 s; the hint dot widens 0.25 s | [[Champion Page]] |
> | A card swipe settling | 0.34 s (opacity 0.3 s) | `.mn-slide.is-settle` ([[Controls]]) |
> | A change inside a chart | the parts not in play fade (to 0.14–0.3), 0.2 s; nothing jumps | 速查's who-counters-whom ring (`.mn-ctr`) |
> | Swiping past the last card of a pile | a short shake and a tick, 0.28 s | `.mn-sl-card.is-shiver` (`pile.ts`) |
> | A progress bar | width 0.3 s | `.mn-hb-fill` |
> | The search capsule | follows the keyboard, most of the way in about 260 ms | [[Search]] |
>
> 速查's like / pass end screen has its own celebration (hearts, sparks, the wash and flood, liked cards rising one after another 55 ms apart); it is that page's only, not a pattern for others.
