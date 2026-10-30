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
| Redrawn 2026-10-30 after the item's picture: the padded tome in perspective (modelled in 3D, so every edge bows), seen from above with a lean; thick gold corner caps with three rivet holes folding over the edges; the page block and dark spine; three claws bursting up out of the cover past its lower edge; a magenta ribbon twisting out; green fire rising in tongues and hugging the book's rim | The tome face-on with gold edges, three green claw slashes, a thin green ring; simpler, reads best small |

Earlier options:

| A · Grimoire | B · Monogram | C · Open book |
| --- | --- | --- |
| ![[logo-a-grimoire.svg\|160]] | ![[logo-b-monogram.svg\|160]] | ![[logo-c-open-book.svg\|160]] |
| A closed book, a rune ring with an eye on its cover | A serif M in a ring of runes, a star above | A book lying open, an arcane flame rising from it |

---
## 🎬 Opening screen options

Shown once when Obsidian starts, over the whole screen with no tab bar. A short intro plays once, then the screen keeps moving (looping) until you tap; a tap fades it out to Home. All three are light-blue mocks under **Cold open options** in [[Layouts]]. These previews move in Obsidian.

### C · Tome awakens (with logo D)
A hard-hitting start that settles into calm, living motion (Zaviel, 2026-10-30; redone after the item's picture the same day). Made with logo D by `tools/draw_brand.py`, so the app can show this very SVG.

![[splash-c-tome.svg|300]]

- **Intro, about 3 s, once:** embers are pulled into a swelling green glow while a rune ring tightens → the tome drops in from above and lands hard (a flash, a flat shockwave on the floor, the screen shakes, sparks thrown out) → the fire bursts up around it, wild at first → the three claws tear out of the cover one by one, each with a streak across the screen, a jolt and a flicker → the ribbon whips out → MORELLONOMICON slams together from wide letters, 黑魔禁書 rises, a line draws out.
- **Loop, until a tap:** the fire keeps churning and flickering (its shape slowly changes), the tome hovers up and down and sways, each claw pulses on its own beat, the ribbon flutters, embers rise and drift, 輕觸進入 pulses.

### A and B (earlier, with logo A)

| A · Rune circle | B · Map and title |
| --- | --- |
| ![[splash-a-rune.svg\|260]] | ![[splash-b-map.svg\|260]] |
| The ring draws itself, the logo rises, the name fades in; then the ring turns, the glow breathes, embers rise | An ARAM loading screen map drifts (here a stand-in), the name writes itself in; then a band of light sweeps over the name |
