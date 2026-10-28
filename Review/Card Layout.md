---
title: Card Layout
date: 2026-10-28
tags:
  - morellonomicon
  - handbook
  - layout
sticker: lucide//layout-template
---
The one layout every Handbook card (`新手入門/`, one `## ` per card) follows. Chosen by Zaviel on 2026-10-28: frame **F2 with a whole-card stage**. A new card picks one stage template below and keeps to the text limits; `python3 -I tools/check_cards.py` lists the cards that do not.

---
## 🧱 The frame (F2, whole-card stage)

```
┌──────────────────────────┐
│ stage (background layer) │  the clip / picture fills the whole card, its lower part fades under the words
│   template content       │  templates (levels, ability…) sit in the room above the words
│                          │
│ ┌──────── dock ────────┐ │  46 px, centred, right on top of the words: tags, steps, legend
├──────────────────────────┤
│ kicker                   │  <topic> · n / N (made by the app)
│ title                    │  1 line
│ body                     │  ≤ 2 lines (optional)
│ tip                      │  **大混戰裡：** ≤ 1 line, in its box (optional)
└──────────────────────────┘
```

- **Words** grow up from the bottom to the height of their content (no fixed height, no scrolling); the stage takes the rest.
- **Dock** is always the 46 px band right above the words, so tags and steps sit at the same distance from the text on every card.
- **Stage** for media (clip, picture, splash) is the whole card behind the words; its lower edge fades into the words' dark (no line).
- Clips are cut to keep the part three quarters from the left (where Riot's clips have the champion).

## ✏️ Text limits

| Block | Limit | About (phone width) |
| --- | --- | --- |
| title | 1 line | ≤ 12 full-width characters |
| body | ≤ 2 lines | ≤ 36 characters |
| tip | ≤ 1 line | ≤ 18 characters |

Counted with full-width characters as 1 and ASCII as ½. Full-width punctuation (，。：) so lines break between phrases.

## 🧩 Stage templates

| Template | `visual:` | Stage | Dock |
| --- | --- | --- | --- |
| clip | `clip Champ Key [a-b]` | the ability's clip, whole card; key + name at the top left | the ability's tags |
| combo | `combo Champ A *B K1 K2 = word word` | K1's clip then K2's, in turn | ① K1 → ② K2 pictures and the result chips |
| levels | `levels Champ Key [stat amount]` | skill head; per ability rank (Lv 6 / 11 / 16) a base bar and a with-stat bar (M1) | legend |
| ability | `ability Champ Key` | skill head, damage per rank, cooldown / cost / range | the ability's tags |
| gallery | `champs …`, `items …`, `augs …` | icons in 2–3 columns, centred | optional |

Other picture kinds (`img`, `splash`, `map`, `tree`, `counters`, `wards`, `style`, `radar`…) fill the stage the same way and leave the dock empty. A new template is added here first, then in `plugin/src/pages/cardkit.ts`.
