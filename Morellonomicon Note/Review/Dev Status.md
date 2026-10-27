---
title: Dev Status
tags:
  - morellonomicon
  - status
sticker: lucide//activity
---
> [!important] For AI assistants
> Read [[LLM Guide]] before any `CMD_` or status update. This note is kept by `CMD_SYNC` / `CMD_ROLLOVER` / `CMD_NOTES_SYNC`; the day notes in `Review/Log/` by `CMD_JOURNAL`.

## 🚀 Today's Progress (2026-10-27)
- **Project start**: Chose an Obsidian vault over a C desktop app (opens on a phone); named it Morellonomicon (黑魔禁書).
- **Vault setup**: Copied the Minimal theme, 4 CSS snippets and the plugin list from clawd-room; folders for beginner guide, champions, augments and modes.
- **Fetch script**: `tools/fetch_data.py` writes 173 champion notes (`英雄/`) and 372 item notes (`道具/`) in zh_TW from Data Dragon 16.21.1, with auto archetypes, skill damage types and features; your own notes and `video` / `pinned` / `avoid` / `archetypes_extra` survive a rerun.
- **Decisions**: images stay remote Data Dragon URLs; tab names in English, champion / item / augment content in zh_TW; archetypes are derived automatically with hand overrides.
- **Workflow**: Copied the LLM Guide, Dev Status / Dev Log / Day note from clawd-room, simplified for a solo project (commit to `main`, no PRs) and added a Start Guide.

## 📅 Yesterday's Progress (—)

---

## ⏳ Ongoing

### 📦 Data
- [x] **Fetch script**: `tools/fetch_data.py` (champions + items, zh_TW, patch in every note).
- [ ] **Item notes check**: 142 ARAM-only items (`77NNNN`) are linked to their base item; look at a few notes in Obsidian and confirm the ARAM copies are what the Mayhem shop sells.
- [ ] **Offline images**: optional `tools/cache_images.py` into a gitignored folder.
- [ ] **Augment data**: CommunityDragon has `cdragon/arena/zh_tw.json` (Arena augments); the ARAM Mayhem augment file is not found yet. Find the right source before building.
- [ ] **Statistics**: win / pick rates for Mayhem augments need either Match-V5 (developer key, queue for ARAM Mayhem, many matches) or a cited community source. Decide in phase 2.

### 🎬 Videos
- [ ] **Skill combo videos**: optional `video:` (YouTube id) per champion note. OP.GG's channel could not be listed without the YouTube Data API (the page is JavaScript and the RSS feed gave 404); needs a free API key in `.env` (`YOUTUBE_API_KEY`), or hand-picked ids. The plugin shows a `youtube-nocookie` embed when the field exists, else a "search on YouTube" button.

### 🧩 Plugin (TypeScript, from the ZeLedger skeleton)
- [ ] **Shell**: `plugin/` with tabs `Mayhem`, `Champions`, `Items`, `Guide`, page stack, sheets; built `main.js` committed to `.obsidian/plugins/morellonomicon/`.
- [ ] **Champion finder** first (filters on roles, damage type, archetypes), then augment data and the Mayhem advisor (augments declare which archetypes they suit; champions pin / avoid).

### 📖 Content
- [ ] **Beginner guide**: roles, damage types (AD / AP / true), tank / bruiser / carry / support, item logic (when to build armor or magic resist).
- [ ] **ARAM Mayhem**: augment tiers (silver / gold / prismatic), which champion archetypes fit which augment types, overpowered combos. First version: a few popular champions as examples, then fill in.
- [ ] **Modes**: item-pick differences for Normal, Ranked and ARAM.

### 🎨 Vault look
- [>] **Theme and snippets**: copied from clawd-room (Minimal + 4 snippets); `baseFontSize` is 30 there, check it on phone and PC and tune.
- [ ] **Plugins**: `tools/install_plugins.py` downloads the 13 listed plugins; decide which to keep (Dataview, Templater, Style Settings, Minimal Settings, Breadcrumbs are the useful ones here).

### 📱 Phone
- [ ] **Sync**: pick how the vault reaches the phone (Obsidian Sync, iCloud, Syncthing or Git) and check the Obsidian mobile app opens it with the theme.

## 💡 Ideas
- A static website export of the vault for people without Obsidian.
- A "what do I build?" note per champion that changes with the enemy team (armor vs magic resist).

## 🏁 Last Progress
- **Project**: repo created on GitHub (public).
