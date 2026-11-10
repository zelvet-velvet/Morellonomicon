---
title: Search
tags:
  - morellonomicon
  - layout
sticker: lucide//search
---
> [!abstract]+ The search capsule and the keyboard
> Part of [[Design Rules]] (read that first). Code: the capsule's moves in `plugin/src/view.ts`, its look in `styles.css` (`.mn-rq-dock`), the pages in `pages/champions.ts` and `pages/roster.ts`.

---
## 🔍 Search capsule and keyboard

> [!note]+ One floating capsule · It rides on the keyboard · Typing shows results in place
> - **One floating capsule** at the bottom where the thumb is (Picks, Champions): search box, the mic (opens the keyboard, whose own mic key listens) and the page's main action (配對, 篩選). It floats over the list; the list's last row clears it. Its page is a fixed page ([[Pages]]).
> - **It rides on the keyboard.** A tap starts lifting it at once to 8 px above where the keyboard will end (the keyboard height is remembered from the last time); when the keyboard closes it starts down at once at the keyboard's pace (each frame a share of the way left, most of it in about 260 ms). It never jumps when Obsidian resizes the page late (it keeps its spot on screen), and it never restarts its move halfway: several reports of one keyboard move only change the goal (`view.ts`, Settings → Keyboard readout shows the numbers). Any new search box at the bottom is a `.mn-rq-dock` and gets this for free.
> - **Typing shows results in place** of the list (rows with face, name, a short line); names are also found by sound and by aliases.
