---
title: Start Guide
tags:
  - morellonomicon
  - guide
sticker: lucide//rocket
---
How to set up Morellonomicon and work on it day to day. It is a solo project.

## 1. Set up on the PC (once)

1. Install [Obsidian](https://obsidian.md).
2. Clone the repo and open **the repo folder itself** as a vault (the repo root is the vault; `plugin/` and `tools/` are hidden through Excluded files):
   ```
   git clone https://github.com/zelvet-velvet/Morellonomicon.git
   python3 tools/install_plugins.py     # community plugins are not stored in git
   ```
3. In Obsidian: Settings → Community plugins → turn off Restricted Mode. The theme (Minimal), the CSS snippets and the Morellonomicon plugin are already in `.obsidian/`.
4. Check the font size: the theme was copied with a large base font (30). Change it in Settings → Appearance if it is too big on your screen.
5. Only if you change the plugin: `cd plugin && npm install && npm run build && npm run install-vault`, then commit the rebuilt files in `.obsidian/plugins/morellonomicon/`.

## 2. Get it on the phone (git, free)

The repo is public, so the phone only needs to pull.

1. In Obsidian mobile, create a **new empty vault** (any name, local storage, not synced).
2. Settings → Community plugins → turn off Restricted Mode → Browse → install and enable **Obsidian Git**.
3. Command palette → **Obsidian Git: Clone an existing remote repo** → `https://github.com/zelvet-velvet/Morellonomicon.git` → choose to clone into the vault folder. Wait until it finishes (a few hundred notes, a few MB).
4. Close and reopen the vault so the theme and the plugin load. On the phone you only need **Morellonomicon** (the app) and **Obsidian Git** (to pull updates); the other plugins in the list (Dataview, Templater, Style Settings…) are for editing on the PC and are not installed by the clone. Obsidian ignores the missing ones.
5. Tap the book icon (ribbon, or the command palette: **Open Morellonomicon**).
6. Later: command palette → **Obsidian Git: Pull** to get new notes and plugin builds.

Other ways to get the folder onto a phone (Obsidian Sync, iCloud, Syncthing) also work: sync the repo folder as the vault.

## 3. The daily loop

1. Read [[Dev Status]]: what is today's work and what is ongoing.
2. Work: write or generate notes (Traditional Chinese; see [[LLM Guide]] for the content rules).
3. With Claude Code, say `CMD_SYNC` to update Dev Status, and `CMD_JOURNAL` to write the day note. At the end of the day, `CMD_ROLLOVER`.
4. Commit and push to `main`: `type(scope): summary`, for example `feat(champions): add the first ten champions`.

## 4. Where things are

See [[Home]] for the folder map. Content: `新手入門/`, `英雄/`, `強化/`, `模式/`. Progress: [[Dev Status]] and [[Dev Log]].
