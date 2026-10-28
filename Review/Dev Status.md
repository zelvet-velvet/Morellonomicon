---
title: Dev Status
tags:
  - morellonomicon
  - status
sticker: lucide//activity
---
> [!important] For AI assistants
> Read [[LLM Guide]] before any `CMD_` or status update. This note is kept by `CMD_SYNC` / `CMD_ROLLOVER` / `CMD_NOTES_SYNC`; the day notes in `Review/Log/` by `CMD_JOURNAL`.

## 🚀 Today's Progress (2026-10-28)
- **Loading screen tips in the Handbook**: the trivia card shows the game's own loading screen tips in zh_TW, only the ones Zaviel picked from the wiki (2017 Miscellaneous and 2025 Did You Know, all 152 found), over one of ARAM's three loading screen backgrounds (Howling Abyss, Butcher's Bridge, the Ionian bridge); random each visit, no repeats.
- **Patch job push**: the job puts its commit on top of a newer main before pushing (a push made while it ran used to make it fail).
- **Handbook home**: opens with the loading tip on an ARAM map, then two blocks, 初來乍到 (basics) and 高手必備 (advanced), each with its own progress, the next topic as a large picture and the rest two across; the glossary is a row at the end.
- **Roles and lanes**: 英雄定位 explains how roles map to lanes (下路 pair, 中路 roaming, 打野) and why counters change with lane and time; the last-card next-topic panel is now fixed under the card, and a tilted card passes over the progress bars.
- **Cards and glass**: clearer card frames and a visible pile; the tip block is a swipeable card stack (no refresh button); the Handbook home shows only when all its pictures are loaded; the tab bar highlight is a liquid-glass pill (to check on the phone).
- **Patch order and pictures**: the Patch tab lists champions (buffs first), items, new Mayhem augments, removed augments; pages and the first Handbook card wait briefly for their pictures instead of showing empty frames (to check on the phone).
- **Handbook tidy**: 高手必備 as a 2x2 grid; topics renamed 走位技巧, 視野控制, 跳脫定位框架; the glossary is an i button beside each topic title instead of a row on the home (to check on the phone).
- **Glass tab highlight**: the bottom bar shows one glass pill behind the chosen tab instead of the orange tint (to check on the phone).
- **Card pile**: Handbook cards lie in a pile like the last page; swipe left to turn a card away (tilting), swipe right to bring the previous one back (to check on the phone).
- **Tinder-style swiping**: cards tilt while swiped; pulling the last card tilts it and the next topic fills the gap on the right as a growing panel (to check on the phone).
- **Handbook cards**: picture on top, a line, then a text panel (where you are, title, line, and a 大混戰裡 tip box); text breaks only between phrases; clips shown whole over a blurred copy; pulling the last card left (shiver, haptic) opens the next topic.
- **New and rewritten topics**: role counters as a graph of role icons with coloured arrows; item recipes drawn like the shop; 高手必備: 跳脫定位框架 (7 champions, each with the ability that breaks the role), 走位技巧, 限制走位 and 視野控制 (Rift wards on the minimap).
- **Scope**: the project is described as a guide for both Summoner's Rift and ARAM Mayhem.
- **Tidy-up**: unused code, styles, the art finder and a placeholder augment removed (248 augments); ARAM item copies show the normal item's current art.

## 📅 Yesterday's Progress (2026-10-27)
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
- **Colour themes** (2026-10-27): the app screen has selectable colour themes taken from ZeLedgerOS: Popping and Locking (default), Ocean, plus Sakura and Forest, each with dark and light sets that follow Obsidian's light / dark, and "Obsidian" to use the vault theme. Pick from the palette button in the top bar or in the plugin settings. Add a theme by copying a block in `plugin/src/themes.ts`.
- **Patch tab decision**: no list pages. Icon grids (new Mayhem augments with a rarity ring, changed champions and items with a +n badge) open the augment / champion / item page in one tap; those pages carry Riot's old → new lines ("Recent changes" on a champion, "版本調整" on an item).
- **Augment page**: effect text (96 of 249 augments now have Riot's, from the last 12 patches), effect keywords, champions that suit it (hand-written `fits` first, else a plain keyword guess, labelled as a guess), and its add / remove history.
- **Fixes**: the skill rank grid lost its layout (a CSS edit landed inside the wrong rule); the Handbook grid no longer scrolls sideways on a phone.
- **Handbook as picture cards** (2026-10-27): each guide topic is a swipeable deck (dots, ‹ ›, swipe left / right); every `## ` section is one card with a big picture and one or two lines. Pictures come from the data: Riot's ability clips, a live radar chart, skill icons with their damage frames, champions of a role, items of a kind, augments of a rarity, or your own screenshot. A lore trivia card ("你知道嗎?": one line of a champion's lore on its splash art, tap for the next) sits between the topic cards. Topic cards use muted colours; the glossary is a plain list (`layout: list`).
- **Filter panel**: 清除 moved into the panel as "全部清除"; the 篩選 button is outlined (accent border when open or in use) instead of a cream block.
- **Augment effect text for 234 of 249** (2026-10-27): Riot's own zh_TW game text (`lol.stringtable.json` on CommunityDragon) holds the description of 180 augments; with the patch notes' text that is 234 augments. `tools/fetch_augment_text.py` writes `_data/augment-text.json`; the game text has numbers as placeholders, shown as X ("X = 遊戲內才看得到的數值"), and the page says which source it came from. Priority: hand-written `effect`, then patch notes (full numbers), then game text. The numbers' own file (augment DataValues) was not found: `map12.bin.json` has only 4 augment entries.
- **Augment icons from the game's own files** (2026-10-27): the colours are no longer guessed. The game's `augmentcard_frame_silver / gold / prismatic.png` (CommunityDragon, `game/assets/ux/cherry/augments/augmentselection/`) were sampled down the frame: silver is light grey to dark grey, gold is cream to dark bronze, prismatic is pink-white to teal to violet (pastel). The glyph tint is already inside the game's `*_large.png` icons (`game/assets/ux/cherry|kiwi/augments/icons/`), which the app now uses; 15 generic augments have no large file and fall back to the small one. Gradient stops are in `plugin/styles.css` (`.aug-silver / .aug-gold / .aug-prism`).
- **Tier**: the augment tier chip is gone (not meaningful to newcomers). A champion note can carry an optional hand-written `tier`, shown as "評價 X" on its card; no data source yet.
- **Augment icon tint audit** (2026-10-27): measured the tint of all 249 icons against their rarity (`large` icons: silver = low saturation, gold = warm, prismatic = wide hue spread). Findings: 208 augments have the game's tinted `*_large.png`; 26 had a generic placeholder icon, now the generic icon of their own rarity (活力流轉 is silver but pointed at the gold one); 15 (mostly 26.21's new augments, the large files are not published yet) only have the small grey icon, which the app now tints with colours averaged from the game's own tinted icons (silver `#b1c6ca→#7a9599`, gold `#e4c7a2→#9a7d5c`, prismatic pastel hues). `fetch_augments.py` picks the best file and re-checks each run, so those 15 switch to the real icon when Riot's files appear.
- **Left as the data says** (icon art and rarity disagree, probably how the game ships them): 恐懼 and 當頭棒喝！ (gold, silver-looking art), 阿福英雄 (prismatic, gold-looking art).
- **Project size** (2026-10-27): the folder was 150 MB but only ~5 MB reaches a phone (a clone is the tracked notes and data, 3.9 MB, plus a packed history of 1.3 MB). The rest is local and git-ignored: `.cache` (downloaded game files, 61 MB), `plugin/node_modules` (42 MB), downloaded community plugins in `.obsidian/plugins` (19 MB). `update_patch.py` now deletes the previous days' `.cache/cdragon-*` folders (45 MB a day) so the cache stops growing, here and on GitHub. Growth to watch: the history gains a few hundred KB per patch (regenerated notes and the built `main.js`).
- **Tiers left to other sites** (2026-10-27): no usable data for a Mayhem tier (Riot does not publish Mayhem matches; OP.GG forbids copying), so tier lists stay as links (OP.GG, U.GG). The optional hand-written `tier` on a champion note still shows as a chip.
- **Augment sort and 新 tag**: the Augments list sorts by 稀有度 (prismatic first, default), 名稱 or 最新 (newest patch first); augments added in the latest patch say 新. All 249 are listed (no 100 cap).
- **Buff / nerf marker**: champions and items in the latest patch notes carry ▲ / ▼ / ◆ / ● (champion icons in the Champions grid, the Patch tab grids, the champion card chip). Riot's notes do not say which way a change goes, so it is inferred from the numbers: lower cooldown / cost is a buff; more damage, shield, heal, health, armor, speed, range is a buff; anything else is ● (just adjusted). The legend says so.
- **Polish**: the lore trivia card shows a shimmer and spinner until its picture has loaded, then picture and text together (8 s limit); the name no longer appears twice on champion, augment, item and guide pages; the keyword chips are a 4-column grid so both edges line up; the scroll area can no longer be panned sideways.
- **Quick Look (大混戰速查)** (2026-10-27): a 速查 button beside the Champions search (moved from the Handbook) opens a page where you tap the champions the game gave you (up to 15, kept between sessions) and see for each: roles, damage kind, melee / ranged, difficulty, and lit / dim pills for 控場 緩速 位移 治療 護盾 吸血, plus a 本版調整 mark. Search is forgiving (name, part of a name, title, English id, most of the characters) and takes several names at once ("亞索 慎 阿璃"), so the keyboard's microphone key works as the voice input; no speech engine of our own. Next to try: recognising champions from a screenshot (icon matching), then an optional vision API.
- **Quick Look and misspellings**: the search hint says 輸入英雄名字,或按鍵盤上的 🎤 說出來. A name one character off (阿里 for 阿璃, 亞鎖 for 亞索; two for longer words) shows "你是不是在找:" with the nearest names. Not covered: a homophone that is several characters away, or a word that sounds right but is spelled completely differently; that would need a pronunciation (pinyin / zhuyin) table, a possible next step.
- **Champion card redesign**: taller banner; a profile block with style chips (reach, damage kind, difficulty dots), a six-axis hexagon chart (輸出 坦度 控場 位移 輔助 射程; the last four are counted from the champion's own skill texts) with a gradient fill, and the ability pills. The generator now tags every skill (控場 緩速 位移 治療 護盾 吸血): hard crowd control is separate from slows, 治療 ignores mana restores.
- **Quick Look tags** (2026-10-27): damage shows every kind a champion deals (主 輸出 + 兼X); wider 位移 words; new 強化普攻 ability (from skill text, not a curated on-hit list). `tools/retag_features.py` re-reads the tags from the text stored in each note when Data Dragon is out of reach. Next: a hand-curated on-hit list if 強化普攻 is too wide.
- **Header and icon tags** (2026-10-27): on a tab's first page the colour / mode buttons sit in the big title row and the mode chip is gone; ability pills are icons (lucide look-alikes, not Riot art) with a tap name and a ? legend. Next: check the icons on the phone; swap any that read badly.
- **Champion page redesign (D2)** (2026-10-27): facts strip (damage meters, reach, difficulty) and a 戰鬥風格 card (hexagon with coloured corner chips naming the skills, plus the other tags). 攻擊特效 (on-hit) split from 強化普攻 and set by hand (`features_extra`). Next: fill `features_extra` for on-hit champions; fix tag gaps the text misses (e.g. Leona E is a dash, W a shield).
- **Calm champion styling (4c)** (2026-10-27): theme colours instead of a League palette, serif titles and line tabs, flat tags with coloured icons. The serif depends on the device (Noto Serif TC / Songti TC / PMingLiU); a phone without one shows sans. Next: decide whether to ship a serif font file in the vault.
- **Passive numbers missing** (2026-10-27): passives have no rank grid in the champion notes, so 技能傷害 shows their damage type without a number. Next: have `tools/spells.py` read passive values from CommunityDragon (needs network).
- **速查 voice search by sound** (2026-10-27): speech to text in zh_TW writes the right sounds with the wrong characters, so names are also matched by Mandarin sound (`_data/sounds.json` from `tools/build_sounds.py`, Unicode Unihan; names use each character's usual reading, what was said may use any). Looser hearing for zh/z, ch/c, sh/s, -ing/-in, -eng/-en, l/n; one misheard, extra or missing character in a name of 3+. Several names said in one breath are split (阿狸卡特琳娜力星 → 阿璃, 卡特蓮娜, 李星). English names: `name_en` from Data Dragon en_US (2026-10-27). Next: nicknames or China names (機器人, 亞索) as a hand `aliases` key.
- **Lane data** (2026-10-27): the lane filter is built; `_data/positions.json` is empty until `tools/fetch_builds.py --mode ranked` runs with a Riot key and network. Now filled by `tools/fetch_positions.py` from Meraki Analytics in the patch job (2026-10-27); the ranked count stays as an option.
- **README** now teaches the Obsidian Git route first (no Python for users); the developer commands are a separate section.
- **Workflow**: Copied the LLM Guide, Dev Status / Dev Log / Day note from clawd-room, simplified for a solo project (commit to `main`, no PRs) and added a Start Guide.
- **Header and navigation** (later on 2026-10-27): tab pages pin their big title row (title and its two buttons) while scrolling; sub pages put Back on the title's line, on the text edge; no blink of the bar line when switching pages.
- **Role, lane and ability filters**: the game's class icons for roles (look-alike until loaded), a lane row (上路 打野 中路 下路 輔助), every other filter in a folding 篩選 panel (技能 by group, 傷害類型 icons, 攻擊距離, 排序 with ↑↓); a hold shows a name bubble; picked filters get a short line, nothing is dimmed.
- **14 ability tags in five groups**: 傷害 (強化普攻 攻擊特效 斬殺), 控制 (控場 緩速 減益), 移動 (位移 加速 隱身), 生存 (治療 護盾 吸血 免傷), 團隊 (隊友增益); skill cards name the kind (控場 · 擊飛、暈眩).
- **Ability tags checked against the game text**: `Review/Tag Audit.md` lists the words behind every tag each patch; false hits removed (immunities, enemy dashes, ability haste, 汲取靈感…); 強化普攻 now means next / Nth / 強化 attacks only (on-hit passives are not).
- **速查 rebuilt for finding fast**: search first; tabs 挑選 (lane icons and every face, tap to add) and 已選 N (the cards); finds names by sound for zh_TW speech to text (雅菲力毆 → 亞菲利歐, several names in one breath) and English by ear (afelios, wukong; `name_en` in every champion note).
- **Lanes**: from Meraki Analytics in the patch job, 172 of 173 champions (data is from patch 16.3; 洛克 has none).
- **Augments tab**: sort bar with ↑↓ under the search, rarity filter on the right.
- **Smoother app**: pages show at once with pictures fading in (no spinner blink); every button bar and the bottom tab bar has a sliding highlight you can drag (haptic tick where the phone allows; Settings → Test haptic).
- **Handbook redesigned**: full-screen cards with story bars, one card per swipe, the last card opens the next topic by itself; all six topics rewritten for the current app and Riot's official terms (增幅裝置, 銀級 / 金級 / 稜鏡級); glossary 13 → 26 terms.
- **Item pictures**: the 91 ARAM item copies show their base item's current art.

---

## ⏳ Ongoing

### 📦 Data
- [ ] **洛克's lane**: newer than Meraki's lane data (16.3); add `positions` to his note by hand. Current lane data needs the ranked count with a Riot key.
- [ ] **Nicknames**: an `aliases` key per champion for names people say that do not sound like the zh_TW name (機器人, 亞索).
- [ ] **On-hit list**: `onhit` is only set for 卡特蓮娜; draft it for other champions for review.
- [ ] **Item notes check**: 142 ARAM-only items (`77NNNN`) are linked to their base item; look at a few notes in Obsidian and confirm the ARAM copies are what the Mayhem shop sells.
- [ ] **Offline images**: optional `tools/cache_images.py` into a gitignored folder.
- [ ] **Augment numbers**: find the game file with the augments' DataValues so the X placeholders can be filled.
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
- [ ] **Actions versions**: GitHub warns that `checkout@v4`, `setup-python@v5` and `cache@v4` run on a deprecated Node; bump them when newer majors are confirmed.
- [ ] **Augment effects before 26.19**: only augments introduced in the last 3 patches have Riot's effect text; run `fetch_patch_notes.py --patches 12` to reach further back, or write `effect` by hand.

### 🧮 Match data
- [ ] ~~First real run~~ (Rift only): needs a Riot key in `.env` (`RIOT_API_KEY=RGAPI-...`) and a seed Riot ID; `python3 tools/fetch_builds.py --seed "Name#TW2" --matches 300`. A development key expires every 24 hours; a personal key does not. Check that the augment ids in the matches match the notes' ids and that final items include the ARAM `77NNNN` ids.
- [ ] **Hand-written builds and tips**: `builds` (kind meta / alt / synergy, mode, name, items, note, with) and `tips` (title, text, video) in a champion note's frontmatter; none written yet.
- [ ] **Augments sub-tab**: use the counted augment picks (and `fits`) once there is data.

### 🖼️ Handbook pictures
- [ ] **In-game screenshots** (Zaviel): save them in the vault (e.g. `Assets/`) and put `visual: img Assets/name.png` under a card. Wanted: where the skill damage and cooldown show in the HUD; the augment pick screen (silver / gold / prismatic); the item shop with the recipe tree; the scoreboard; the minimap and ward icons.
- [>] **More decks**: 視野控制 (Rift wards) is in; still to write: Rift basics (lanes, objectives), ping etiquette, one card each for the trick-of-the-week.
- [ ] **Ward spots**: the 視野控制 cards place wards by eye on the minimap; check them against real games and adjust `WARDS` in `plugin/src/pages/deck.ts`.

### 🎬 Videos
- [ ] **Other forms**: champions that swap forms or upgrade through a mechanic Riot's text does not word as 進化 / 升級 (Viktor, Jayce, Elise, Nidalee, Gnar, Aphelios…) show their base skill only; list them and add hand-written upgrade text.
- [ ] **Skill combo videos**: optional `video:` (YouTube id) per champion note. OP.GG's channel could not be listed without the YouTube Data API (the page is JavaScript and the RSS feed gave 404); needs a free API key in `.env` (`YOUTUBE_API_KEY`), or hand-picked ids. The plugin shows a `youtube-nocookie` embed when the field exists, else a "search on YouTube" button.

### 🧩 Plugin (TypeScript, from the ZeLedger skeleton)
- [ ] **Rift slot**: `plugin/src/modes.ts` has Rift (disabled); to open it set `enabled`, give `home.ts` and the champion card's "Build" block real content, and fill the `rift` item flag.
- [ ] **Mayhem advisor**: augment data first, then the card's "Best augments" block (augments declare which archetypes they suit; champions pin / avoid).
- [ ] **Sheets and settings panel** when a flow needs them (the skeleton has a bottom sheet to copy).

### 📖 Content
- [ ] **ARAM Mayhem**: augment tiers (silver / gold / prismatic), which champion archetypes fit which augment types, overpowered combos. First version: a few popular champions as examples, then fill in.
- [ ] **Modes**: item-pick differences for Normal, Ranked and ARAM.

### 🎨 Vault look
- [>] **Theme and snippets**: copied from clawd-room (Minimal + 4 snippets); `baseFontSize` is 30 there, check it on phone and PC and tune.
- [ ] **Plugins**: `tools/install_plugins.py` downloads the 13 listed plugins; decide which to keep (Dataview, Templater, Style Settings, Minimal Settings, Breadcrumbs are the useful ones here).

### 📱 Phone
- [ ] **Haptic**: check Settings → Test haptic on the phone; remove the haptic code if nothing works in Obsidian.

## 💡 Ideas
- A static website export of the vault for people without Obsidian.
- A "what do I build?" note per champion that changes with the enemy team (armor vs magic resist).

## 🏁 Last Progress
- **Content / beginner guide**: 初來乍到 (5 topics) and 高手必備 (4 topics) in the Handbook.
- **Data / fetch script**: champions and items in zh_TW, the patch in every note.
- **Data / augments**: names, rarity and icons for all 249.
- **Data / augment effects**: Riot's own text for 234 of 249.
- **Patch / automatic update**: the GitHub job regenerates everything Wed-Fri.
- **Match data / Mayhem**: Riot publishes no Mayhem matches; builds counting stays for Summoner's Rift.
- **Videos / skill clips**: play on the phone, looping without controls.
- **Plugin / app**: in daily use on the phone.
- **Phone / Git clone**: works; every change is tested on the phone.
- **Project**: repo created on GitHub (public).
