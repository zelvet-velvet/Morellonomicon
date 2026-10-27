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
- **Workflow**: Copied the LLM Guide, Dev Status / Dev Log / Day note, PR template and contributing rules from clawd-room, adapted to this project.

## 📅 Yesterday's Progress (—)

---

## ⏳ Ongoing

### 📦 Data
- [ ] **Fetch script**: `tools/fetch_data.py` pulls champions, skills and items from Riot Data Dragon (`zh_TW`) and writes the generated block of each note, with the patch version. Data Dragon 16.21.1 has 173 champions in zh_TW (checked 2026-10-27).
- [ ] **Augment data**: CommunityDragon has `cdragon/arena/zh_tw.json` (Arena augments); the ARAM Mayhem augment file is not found yet. Find the right source before building.
- [ ] **Statistics**: win / pick rates for Mayhem augments need either Match-V5 (developer key, queue for ARAM Mayhem, many matches) or a cited community source. Decide in phase 2.

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
