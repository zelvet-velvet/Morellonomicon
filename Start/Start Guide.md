---
title: Start Guide
tags:
  - morellonomicon
  - guide
sticker: lucide//rocket
---
How to set up Morellonomicon and work on it day to day. It is a solo project.

## 1. Use it: phone or PC, with the Obsidian Git plugin (no commands)

The notes, the data and the built app are all in the repo, and a scheduled GitHub job refreshes the data every patch, so **nobody has to run Python**. The same steps work on a phone and on a PC (also in the README):

1. In Obsidian create a **new empty vault** (any name).
2. Settings → Community plugins → turn off Restricted Mode → Browse → install and enable **Obsidian Git**.
3. Command palette → **Obsidian Git: Clone an existing remote repo** → `https://github.com/zelvet-velvet/Morellonomicon.git` → clone into the vault itself. About 5 MB.
4. Close and reopen the vault; Settings → Community plugins → enable **Morellonomicon**. Tap the book icon (or run **Open Morellonomicon**).
5. Updates: **Obsidian Git: Pull**, then reopen the vault. Use Pull only: a push gives `HTTP 403` (no write access), which is harmless.

The other community plugins in the list (Dataview, Templater, Style Settings…) are only for editing on the PC and are not installed by a clone; Obsidian ignores the missing ones.

## 2. Work on it (only the owner, on the PC)

1. Clone the repo and open **the repo folder itself** as a vault (`plugin/` and `tools/` are hidden through Excluded files); `python3 tools/install_plugins.py` downloads the editing plugins.
2. Generated data: `python3 -I tools/update_patch.py --commit` (also runs by itself on GitHub, Wednesday to Friday).
3. Plugin changes: `cd plugin && npm install && npm run build && npm run install-vault`, then commit the rebuilt files in `.obsidian/plugins/morellonomicon/`.

## 3. The daily loop

1. Read [[Dev Status]]: what is today's work and what is ongoing.
2. Work: write or generate notes (Traditional Chinese; see [[LLM Guide]] for the content rules).
3. With Claude Code, say `CMD_SYNC` to update Dev Status, and `CMD_JOURNAL` to write the day note. At the end of the day, `CMD_ROLLOVER`.
4. Commit and push to `main`: `type(scope): summary`, for example `feat(champions): add the first ten champions`.

## 4. Where things are

See [[Home]] for the folder map. Content: `新手入門/`, `英雄/`, `強化/`, `模式/`. Progress: [[Dev Status]] and [[Dev Log]].
