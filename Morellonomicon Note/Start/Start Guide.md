---
title: Start Guide
tags:
  - morellonomicon
  - guide
sticker: lucide//rocket
---
How to set up Morellonomicon and work on it day to day. It is a solo project.

## 1. Set up (once)

1. Install [Obsidian](https://obsidian.md) (PC and phone).
2. Clone the repo and open the folder **`Morellonomicon Note/`** as a vault (not the repo root):
   ```
   git clone https://github.com/zelvet-velvet/Morellonomicon.git
   python3 tools/install_plugins.py     # plugins are not stored in git
   ```
3. In Obsidian: Settings → Community plugins → turn off Restricted Mode. The theme (Minimal) and the CSS snippets are already enabled in `.obsidian/`.
4. Check the font size: the theme was copied with a large base font (30). Change it in Settings → Appearance if it is too big on your screen.

## 2. Open it on the phone

Pick one way to get the vault folder onto the phone, then open it in the Obsidian mobile app:

| Way | Notes |
| --- | --- |
| Obsidian Sync | paid, easiest, works on iOS and Android |
| iCloud | iPhone only; keep the vault in iCloud Drive |
| Syncthing | free, Android and PC |
| Git | free; use the Obsidian Git plugin on the phone |

Plugins are not in git, so install them on the phone once (Community plugins).

## 3. The daily loop

1. Read [[Dev Status]]: what is today's work and what is ongoing.
2. Work: write or generate notes (Traditional Chinese; see [[LLM Guide]] for the content rules).
3. With Claude Code, say `CMD_SYNC` to update Dev Status, and `CMD_JOURNAL` to write the day note. At the end of the day, `CMD_ROLLOVER`.
4. Commit and push to `main`: `type(scope): summary`, for example `feat(champions): add the first ten champions`.

## 4. Where things are

See [[Home]] for the folder map. Content: `新手入門/`, `英雄/`, `強化/`, `模式/`. Progress: [[Dev Status]] and [[Dev Log]].
