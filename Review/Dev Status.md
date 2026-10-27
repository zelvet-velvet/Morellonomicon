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
- **Plugin shell**: `plugin/` (TypeScript, from the ZeLedger skeleton) with tabs Mayhem · Champions · Items · Guide, a page stack, a mode switch (Mayhem on, Rift planned), a tap-to-pick champion grid, a one-screen champion card (icon, role and damage chips, rating bars, damage-coloured skill icons) and an item list; built into the vault. Not yet seen in Obsidian.
- **Less text**: generated champion notes keep a 5-row skill table and fold the descriptions, tips and base stats into collapsed callouts; no lore.
- **Vault at the repo root**: moved `Morellonomicon Note/` up so Obsidian Git on a phone can clone the repo straight into a vault; `plugin/` and `tools/` are hidden through Excluded files; Obsidian Git is in the plugin list; the Start Guide has the phone steps.
- **Radar and look**: the champion card uses a 5-axis radar (物理 魔法 防禦 射程 難度) and a splash-art banner; softer cards, pill search, glassy bars. Seen on the phone and liked.
- **Mayhem augments**: `tools/fetch_augments.py` writes 249 augment notes (`強化/`: 銀 71, 金 104, 稜鏡 74) from CommunityDragon's KIWI pool with zh_TW names, rarity and icons; the plugin has an Augments list (Mayhem home → Augments).
- **Skill panel**: tap a skill icon on the champion card to open its details under the strip: damage types, cooldown, cost, range (hidden when meaningless), description, an 進化 / 升級 block for skills that evolve (Kha'Zix, Kai'Sa, Heimerdinger… found by wording in Riot's text) and Riot's ability demo clip; the "Full note" row is gone.
- **Skill numbers by rank**: `tools/spells.py` reads CommunityDragon's game data and gives every skill a rank grid (damage / heal / shield with its scaling, cooldown, cost); 94% of the damaging skills (531 of 565) have numbers, anything unresolved is left out, never guessed; costs that are not plain resource points (% health, per second) use Riot's own wording or are left out.
- **App restructure**: tabs are now Champions · Augments · Handbook (Items tab dropped; typing in the Champions search also finds augments and items). A champion card has sub-tabs Skills · Build · Augments (Runes in Rift) · Tips. Mayhem / Rift stays a mode switch (top right). Handbook is six short beginner cards from `新手入門/`.
- **Builds**: Build sub-tab shows counted builds (games, win rate, top core sets, most common items, tap an item for its effect) plus hand-written alternative / synergy builds; Tips shows hand-written cards. `tools/fetch_builds.py` counts real Mayhem matches from Riot's Match-V5 (queue 2400); its counting is tested on made-up matches only, the Riot calls are not tested yet.
- **Reframe**: Morellonomicon is a newbie guide with its own sorting, plus the strategy that stat sites do not have. Champions can be narrowed by role, damage type, abilities (must have / must not have 控場, 治療, 護盾, 位移), reach (近戰 / 中程 / 遠程) and sorted (name, easiest, longest range). The tab is now **Handbook**: the beginner cards plus one search box over the guide cards, champion tips and our builds, with the match highlighted. Build shows OP.GG and Mobalytics links (their terms forbid copying their numbers; OP.GG's also forbids scraping and framing).
- **Patch tab and freshness**: a Patch tab shows the patch the data is from, the official patch notes link, our own patch notes (`版本更新/`) and a "Check these tricks" list. Every tip and build shows its patch (green current, yellow one behind, red older or none), date, status and source link. `Inbox/技巧收件匣.md` is the place to jot tricks (format inside) for me to process.
- **Changes since the last patch**: `tools/fetch_changes.py` compares the last 4 patches from Data Dragon (base stats, skill cooldown / cost / range, skill text) into `_data/changes.json` (28 champions changed, 9 in 16.21). A champion with changes this patch gets a ▲▼ badge by its roles; changed cooldown / cost / range values are coloured green or red with the old value struck through; a collapsed "Recent changes" block in Skills lists the last patches (rewritten skill text shows old and new wording, uncoloured); the Patch tab lists "Changed in 16.21". Damage numbers and Mayhem-specific adjustments are not compared yet.
- **Official patch notes in the Patch tab**: `tools/fetch_patch_notes.py` reads Riot's zh-TW patch notes (robots.txt allows it; read once per patch, cached) into `_data/patches.json`: Riot's one-line blurb, the headline image (shown from Riot's site, not copied into the repo), a link to the full notes, what changed in short (champions and items with the numbers before and after) and, for Mayhem, the new augments with Riot's own effect text and the removed ones. The Patch tab shows the latest patch as a card, then Mayhem, Champions and Items sections with "Show all", earlier patches as links, our own notes and the tricks to recheck. The augment list now shows Riot's effect text for the augments introduced in the last 3 patches (26.21 added 35).
- **One command per patch**: `python3 -I tools/update_patch.py` runs fetch_data, fetch_augments, fetch_changes and fetch_patch_notes; add `--commit` to commit and push the result.
- **Patch numbers**: Riot's official number is 26.21 and Data Dragon's is 16.21 (same patch); the app shows Riot's.
- **Automatic updates**: `.github/workflows/update-patch.yml` runs `tools/update_patch.py` every Wednesday, Thursday and Friday (03:00 UTC) and commits what changed as the GitHub bot; start it by hand from the Actions tab. First run (2026-10-27) passed and changed nothing, as expected. Pull on the phone to get the new files.
- **Everything opens inside the app** (2026-10-27, from phone screenshots): augments, items, Handbook cards, our patch notes and champions now open as app pages on top of the current tab with Back; none opens an Obsidian note any more (a note page draws the note itself and has an "Edit in Obsidian" row). New pages: augment (icon, rarity, Riot's effect text, 新增於 patch), item (price, tags, recipe: built from / builds into, tappable), a full "See all" page per patch list (champions, items, new augments) with one card each and the numbers laid out in full. The Patch tab keeps five short one-line rows and a "See all N" row.
- **Look fixes**: a CSS specificity bug removed the padding from every button (clipped chips, a short sub-tab bar); fixed. Selected chips are now an outlined tint instead of a solid block; the sub-tab bar is 42 px tall with a solid accent for the selected tab; the filter panel is three clear sections (abilities, reach and sort as segmented choices).
- **Handbook redesigned** (2026-10-27): a start page instead of a list: a purple "start here" hero (the first card you have not opened, with read time and a progress bar), two-column colourful topic tiles (icon, title, one line, minutes, a tick when read), a "今日小知識" glossary card that changes daily, and glossary keyword chips under the search box. Opening a guide card marks it read and ends with a "next card" button. The glossary is one term per line.
- **Workflow**: Copied the LLM Guide, Dev Status / Dev Log / Day note from clawd-room, simplified for a solo project (commit to `main`, no PRs) and added a Start Guide.

## 📅 Yesterday's Progress (—)

---

## ⏳ Ongoing

### 📦 Data
- [x] **Fetch script**: `tools/fetch_data.py` (champions + items, zh_TW, patch in every note).
- [ ] **Item notes check**: 142 ARAM-only items (`77NNNN`) are linked to their base item; look at a few notes in Obsidian and confirm the ARAM copies are what the Mayhem shop sells.
- [ ] **Offline images**: optional `tools/cache_images.py` into a gitignored folder.
- [x] **Augment data**: names, rarity, icons (no effect text exists in CommunityDragon).
- [ ] **Augment effects**: hand-write a one-line `effect` per augment (strongest first) or pull from the League wiki with a named source; never invent them.
- [ ] **Augment fit**: `fits` (archetypes the augment suits), `tier`, `combos` on the augment notes; then the champion card's "Best augments" block matches them to a champion's archetypes.
- [ ] **Statistics**: win / pick rates for Mayhem augments need either Match-V5 (developer key, queue for ARAM Mayhem, many matches) or a cited community source. Decide in phase 2.

### 🔢 Skill numbers
- [ ] **Unresolved damage (34 skills)**: level-based or conditional formulas (Kha'Zix Q, Jhin, Jayce… ); check a few against the in-game tooltip and extend `tools/spells.py` where it is cheap.
- [ ] **Stat codes**: only 0 (AP) and 2 (AD, formula 2 = bonus) are named; other stats show as "+其他加成" (66 rows) until their codes are confirmed.

### ✍️ Our own strategy
- [>] **Inbox**: Zaviel is tidying the first tricks into `Inbox/技巧收件匣.md`; then "process the inbox".
- [ ] **Easy way to record it**: tips, builds and combos are frontmatter lists today; add a command / form ("Add tip", "Add build") so they can be written on the phone in a few taps.
- [ ] **Review**: the Handbook search is the quick way back to a detail; consider a short quiz / saved list if forgetting remains a problem.
- [ ] **First batch of content**: five champions you play often in Mayhem, with one alternative build and one trick each.

### 🔁 Patch changes
- [ ] **Damage diffs**: compare per-rank damage using CommunityDragon's old game data (`raw.communitydragon.org/<patch>/game/data/characters/...`, about 11 MB per patch); most balance patches change damage, so the badge undercounts until this is in.
- [>] **Mayhem-specific balance**: the official notes list Mayhem champion adjustments under the Mayhem heading (none in 26.21); `mayhem_champions` is read but not shown yet.
- [ ] **Item and augment changes**: the same diff for items (price, stats, text).
- [x] **Run it each patch**: automatic (GitHub Actions), or by hand with `python3 -I tools/update_patch.py --commit`.
- [ ] **Actions versions**: GitHub warns that `checkout@v4`, `setup-python@v5` and `cache@v4` run on a deprecated Node; bump them when newer majors are confirmed.
- [ ] **Augment effects before 26.19**: only augments introduced in the last 3 patches have Riot's effect text; run `fetch_patch_notes.py --patches 12` to reach further back, or write `effect` by hand.

### 🧮 Match data
- [x] **Mayhem match data is not available**: Riot's Match-V5 lists none of the seed account's Mayhem games (checked 2026-10-27; OP.GG shows the same gap). `tools/fetch_builds.py` stays for Summoner's Rift.
- [ ] ~~First real run~~ (Rift only): needs a Riot key in `.env` (`RIOT_API_KEY=RGAPI-...`) and a seed Riot ID; `python3 tools/fetch_builds.py --seed "Name#TW2" --matches 300`. A development key expires every 24 hours; a personal key does not. Check that the augment ids in the matches match the notes' ids and that final items include the ARAM `77NNNN` ids.
- [ ] **Hand-written builds and tips**: `builds` (kind meta / alt / synergy, mode, name, items, note, with) and `tips` (title, text, video) in a champion note's frontmatter; none written yet.
- [ ] **Augments sub-tab**: use the counted augment picks (and `fits`) once there is data.

### 🎬 Videos
- [>] **Skill demo clips**: played from Riot's ability CDN (`champion-abilities/<key>/ability_<key>_Q1.mp4`); unofficial path, so check on the phone (iOS plays the mp4) and that a missing clip just disappears.
- [ ] **Other forms**: champions that swap forms or upgrade through a mechanic Riot's text does not word as 進化 / 升級 (Viktor, Jayce, Elise, Nidalee, Gnar, Aphelios…) show their base skill only; list them and add hand-written upgrade text.
- [ ] **Skill combo videos**: optional `video:` (YouTube id) per champion note. OP.GG's channel could not be listed without the YouTube Data API (the page is JavaScript and the RSS feed gave 404); needs a free API key in `.env` (`YOUTUBE_API_KEY`), or hand-picked ids. The plugin shows a `youtube-nocookie` embed when the field exists, else a "search on YouTube" button.

### 🧩 Plugin (TypeScript, from the ZeLedger skeleton)
- [>] **Shell**: built and type-checked; needs a look in Obsidian on PC and phone (grid size, tab bar, the mode menu, remote icons loading).
- [ ] **Rift slot**: `plugin/src/modes.ts` has Rift (disabled); to open it set `enabled`, give `home.ts` and the champion card's "Build" block real content, and fill the `rift` item flag.
- [ ] **Mayhem advisor**: augment data first, then the card's "Best augments" block (augments declare which archetypes they suit; champions pin / avoid).
- [ ] **Sheets and settings panel** when a flow needs them (the skeleton has a bottom sheet to copy).

### 📖 Content
- [ ] **Beginner guide**: roles, damage types (AD / AP / true), tank / bruiser / carry / support, item logic (when to build armor or magic resist).
- [ ] **ARAM Mayhem**: augment tiers (silver / gold / prismatic), which champion archetypes fit which augment types, overpowered combos. First version: a few popular champions as examples, then fill in.
- [ ] **Modes**: item-pick differences for Normal, Ranked and ARAM.

### 🎨 Vault look
- [>] **Theme and snippets**: copied from clawd-room (Minimal + 4 snippets); `baseFontSize` is 30 there, check it on phone and PC and tune.
- [ ] **Plugins**: `tools/install_plugins.py` downloads the 13 listed plugins; decide which to keep (Dataview, Templater, Style Settings, Minimal Settings, Breadcrumbs are the useful ones here).

### 📱 Phone
- [>] **Git clone on the phone**: steps are in the Start Guide; to check on a real phone: the clone finishes, the theme and the Morellonomicon plugin load, icons show.

## 💡 Ideas
- A static website export of the vault for people without Obsidian.
- A "what do I build?" note per champion that changes with the enemy team (armor vs magic resist).

## 🏁 Last Progress
- **Project**: repo created on GitHub (public).
