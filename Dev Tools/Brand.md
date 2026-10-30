---
title: Brand
tags:
  - morellonomicon
  - layout
sticker: lucide//sparkles
---
The project's own look outside the pages: the logo (README, the opening screen) and the opening screen when Obsidian starts. Our own drawings in `Assets/brand/` (no Riot art in them). Colours from the Draft Night theme: blue-black, cream, the amber accent, a little purple.

---
## 🔖 Logo options

Pick one (tell Claude the letter). The chosen one becomes `Assets/brand/logo.svg`, used at the top of the README and on the opening screen; the others are deleted. D and E follow the in-game Morellonomicon item (Zaviel, 2026-10-30): its purple tome with gold corners, the three green claw slashes and the green fire of its anti-heal; redrawn by us, not Riot's picture.

| D · Cursed tome (after the item) | E · Slashed seal (after the item, flat) |
| --- | --- |
| ![[logo-d-cursed-tome.svg\|200]] | ![[logo-e-slashed-seal.svg\|200]] |
| The tome tilted like the item's: gold corners with filigree and rivets, spine bands, a clasp with a green stone, a magenta ribbon, an etched rune seal, three claw slashes torn into the cover, green fire and sparks around it (more detail, 2026-10-30) | The tome face-on with gold edges, three green claw slashes, a thin green ring; simpler, reads best small |

Earlier options:

| A · Grimoire | B · Monogram | C · Open book |
| --- | --- | --- |
| ![[logo-a-grimoire.svg\|160]] | ![[logo-b-monogram.svg\|160]] | ![[logo-c-open-book.svg\|160]] |
| A closed book, a rune ring with an eye on its cover | A serif M in a ring of runes, a star above | A book lying open, an arcane flame rising from it |

---
## 🎬 Opening screen options

Shown once when Obsidian starts, over the whole screen with no tab bar. A short intro plays once, then the screen keeps moving (looping) until you tap; a tap fades it out to Home. All three are light-blue mocks under **Cold open options** in [[Layouts]]. These previews move in Obsidian.

### C · Tome awakens (with logo D)
A vivid start that settles into calm, living motion (Zaviel, 2026-10-30). Made with logo D by `tools/draw_brand.py`, so the app can show this very SVG.

![[splash-c-tome.svg|300]]

- **Intro, about 3 s, once:** green sparks rush to the middle → a flash → the tome slams in (overshoots and settles) → three claw marks rip across the whole screen while it shakes → a shockwave ring → the fire bursts up → MORELLONOMICON lands, letters closing in, then 黑魔禁書 rises.
- **Loop, until a tap:** the tome floats up and down and sways a little, each flame flickers on its own beat, the slashes breathe, embers rise, the rune ring turns slowly, a glint crosses the cover every few seconds, 輕觸進入 pulses.

### A and B (earlier, with logo A)

| A · Rune circle | B · Map and title |
| --- | --- |
| ![[splash-a-rune.svg\|260]] | ![[splash-b-map.svg\|260]] |
| The ring draws itself, the logo rises, the name fades in; then the ring turns, the glow breathes, embers rise | An ARAM loading screen map drifts (here a stand-in), the name writes itself in; then a band of light sweeps over the name |
