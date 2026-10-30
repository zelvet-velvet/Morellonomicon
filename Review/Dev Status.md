---
title: Dev Status
tags:
  - morellonomicon
  - status
sticker: lucide//activity
---
> [!important] For AI assistants
> Read [[LLM Guide]] before any `CMD_` or status update. This note is kept by `CMD_SYNC` / `CMD_ROLLOVER` / `CMD_NOTES_SYNC`; the day notes in `Review/Log/` by `CMD_JOURNAL`.

## 🚀 Today's Progress (2026-10-30)
- **Project logo**: a clean flat tome after the Morellonomicon item (purple cover, gold corner caps, three green claws, green flames sweeping up to the right), no background, a transparent PNG at the top of the README.
- **README like a public tool**: logo, title with badges, feature table, install, FAQ, data sources; screenshots still to add.

- **Augment page options**: three mocks in [[Layouts]] (A card, B numbers first, C like an ability), to pick.

## 📅 Yesterday's Progress (2026-10-29)
- **Search capsule on the keyboard**: on Picks and Champions it rises with the keyboard from the tap and goes down the moment it closes, with no jumps (to check on the phone).
- **Loading look for every block**: each Layouts block with pictures blurs with the band of light until they are in; a page's blocks load together (Home, Picks, Champions, Items) (to check on the phone).
- **Design Rules note**: [[Design Rules]] holds how every page looks and behaves; the LLM Guide points to it.
- **Layouts editor**: pages grouped under big titles (Home: not linked, linked…), phones with the notch status bar and tab icons, an orange frame on changed pages; the Card Layout rules live in [[Layouts]].
- **Handbook topics full screen**: the Picks card's size, Back and the glossary's i floating on the card, no title or progress bars (to check on the phone).
- **Items like the Layouts note**: role tabs and stat rail on the left edge, bigger role, sort and stat icons (to check on the phone).
- **Picks card skins ahead**: the top card's and the next card's tab 2 to 4 skins download while you read, so switching tabs shows them at once (to check on the phone).
- **Picks card 玩法 / 技能**: 玩法 in the middle with bigger lines on a dark panel; 技能 rows show the game's ability pictures, spread evenly (to check on the phone).
- **Liked champions page**: portraits two across, the actions pinned at the bottom (to check on the phone).
- **Mock layouts**: proposals are light blue pages in [[Layouts]]; new and changed layouts are shown and picked there (rule in the LLM Guide).
- **Items blocks load on their own**: role tabs, stat rail and list each with their loading look; the rail's sprite retried and kept (to check on the phone).
- **Sharp shop icons**: the game's stat icons sharpened on the device and painted in the Icons note's colours (to check on the phone).
- **速查 text for every champion**: one-line overview, 玩法 line and each ability in plain words drafted for the other 165 champions, in the style of the 8 Zaviel wrote (to proofread).
- **Loading blocks stay put**: the blur stays over the visible part while scrolling, blocks taps and scrolling, and does not come back on a redraw (to check on the phone).
- **No more blinking pictures**: cached pictures show at once on redraws, slow small ones show a placeholder, clips fade in instead of a black box (to check on the phone).
- **New glossary and item pages**: 名詞表 as a grouped list with icons and search (B); the item page as a banner, stat chips and effect cards (A) (to check on the phone).
- **Picks lanes**: bigger lane icons, one lane at a time, and Champions' lanes too (to check on the phone).
- **Tidy-up**: about 80 unused style rules and a few unused bits of code removed.

---

## ⏳ Ongoing

### 📦 Data
- [ ] **洛克's lane**: newer than Meraki's lane data (16.3); add `positions` to his note by hand. Current lane data needs the ranked count with a Riot key.
- [>] **Nicknames**: the `aliases` key works in 速查 (text and sound); 布里茨 (機器人) and 犽宿 (亞索) are in, fill the rest by hand (to check on the phone).
- [ ] **On-hit list**: `onhit` is only set for 卡特蓮娜; draft it for other champions for review.
- [ ] **Item notes check**: 142 ARAM-only items (`77NNNN`) are linked to their base item; look at a few notes in Obsidian and confirm the ARAM copies are what the Mayhem shop sells.
- [ ] **Offline images**: optional `tools/cache_images.py` into a gitignored folder.
- [ ] **Augment numbers**: Arena's `map30.bin.json` (CommunityDragon) has numbers, levels (Lv1 / max) and scaling for 102 of 248 Mayhem augments, and `ChampionAugmentTags` (build and excluded tags per champion, also in map12); a fetch script into `_data/` is next. The 146 Mayhem-only ones have no numbers there.
- [ ] **Augment fit**: `fits` (archetypes the augment suits), `tier`, `combos` on the augment notes; then the champion card's "Best augments" block matches them to a champion's archetypes.
- [ ] **Statistics**: win / pick rates for Mayhem augments need either Match-V5 (developer key, queue for ARAM Mayhem, many matches) or a cited community source. Decide in phase 2.

### 🔢 Skill numbers
- [ ] **Unresolved damage (34 skills)**: level-based or conditional formulas (Kha'Zix Q, Jhin, Jayce… ); check a few against the in-game tooltip and extend `tools/spells.py` where it is cheap.
- [ ] **Stat codes**: only 0 (AP) and 2 (AD, formula 2 = bonus) are named; other stats show as "+其他加成" (66 rows) until their codes are confirmed.

### ✍️ Our own strategy
- [>] **速查 text for every champion**: `punch` / `soul` / `plain` in all 173 notes: 8 by Zaviel, 165 drafted by Claude on 2026-10-29 in the same style from each ability's game text (待驗證: proofread on the phone, fix in the note). `stack` (172, not 洛克) and `focus` (14) copied from `Inbox/速查卡片草稿.md` too.
- [ ] **Builds by play style (decided 2026-10-28, from Zaviel)**: not a hand-written build per champion. Zaviel lists the first three items (in buying order) for each play style, per mode (Mayhem and Rift apart), in `Inbox/玩法出裝收件匣.md`, from OP.GG and similar (their numbers are never copied, only items and a one-line reason with the source). The champion page's Build tab then shows the set of the champion's play style, labelled as recommended for that play style. The play style is read automatically from the champion's skill scaling (AP / AD / on-hit / tank, with the roles) and can be set by hand; wrong ones are fixed by changing a rule or a hand override, not the champion. Mayhem sets are about items only; augment pairings come later (augment `fits`, the Augments tab). Test champions: Katarina, Akali, Talon, Lux, Ahri (the five Zaviel plays best).
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
- [ ] **Cards to the layout**: shorten the 37 cards over the Handbook card limits in [[Layouts]] (`python3 -I tools/check_cards.py`); the ability card's tags still sit in the stage, not the dock.
- [ ] **In-game screenshots** (Zaviel): save them in the vault (e.g. `Assets/`) and put `visual: img Assets/name.png` under a card. Wanted: where the skill damage and cooldown show in the HUD; the augment pick screen (silver / gold / prismatic); the item shop with the recipe tree; the scoreboard; the minimap and ward icons.
- [>] **More decks**: 視野控制 (Rift wards) is in; still to write: Rift basics (lanes, objectives), ping etiquette, one card each for the trick-of-the-week.
- [ ] **Ward spots**: the 視野控制 cards place wards by eye on the minimap; check them against real games and adjust `WARDS` in `plugin/src/pages/deck.ts`.

### 🎬 Videos
- [ ] **Pyke R fast-forward**: clip cards can skip a part (`clip Pyke R a-b+c-d`); needs the seconds where the fast-forward starts and ends (Zaviel), or the clip host `d28xe8vt774jo5.cloudfront.net` allowed in the cloud environment so the clip can be measured.
- [ ] **Other forms**: champions that swap forms or upgrade through a mechanic Riot's text does not word as 進化 / 升級 (Viktor, Jayce, Elise, Nidalee, Gnar, Aphelios…) show their base skill only; list them and add hand-written upgrade text.
- [ ] **Skill combo videos**: optional `video:` (YouTube id) per champion note. OP.GG's channel could not be listed without the YouTube Data API (the page is JavaScript and the RSS feed gave 404); needs a free API key in `.env` (`YOUTUBE_API_KEY`), or hand-picked ids. The plugin shows a `youtube-nocookie` embed when the field exists, else a "search on YouTube" button.

### 🧩 Plugin (TypeScript, from the ZeLedger skeleton)
- [x] **Items list**: the Items page (from Home) lists every item of the mode like the shop: role tabs, stat rail, tiers or price.
- [ ] **速查 swipe on the phone**: check the pile height with the ✕ / ♥ buttons, the big ♥ / ✕ while dragging, no scrollbar; liked champions are not kept after leaving the page.
- [ ] **True damage icon**: `gem` for 真實 was chosen by Claude (see [[Icons]]); `crosshair` and `sword` each mean two things there.
- [ ] **Rift slot**: `plugin/src/modes.ts` has Rift (disabled); to open it set `enabled`, give `home.ts` and the champion card's "Build" block real content, and fill the `rift` item flag.
- [ ] **Mayhem advisor**: augment data first, then the card's "Best augments" block (augments declare which archetypes they suit; champions pin / avoid).
- [ ] **Sheets and settings panel** when a flow needs them (the skeleton has a bottom sheet to copy).

### 📖 Content
- [ ] **ARAM Mayhem**: augment tiers (silver / gold / prismatic), which champion archetypes fit which augment types, overpowered combos. First version: a few popular champions as examples, then fill in.
- [ ] **Modes**: item-pick differences for Normal, Ranked and ARAM.

### 🎨 Vault look
- [ ] **Opening animation (pending)**: a full-screen opening when Obsidian starts (a strong intro, then calm looping motion, tap for Home). Drawing it in code looked poor; make the art first (an AI image and image-to-video tool, or an artist), then the app plays the clips.
- [ ] **README screenshots**: phone screenshots into `Assets/readme/` (Home, 速查 card, a champion, Items, a Handbook card, Patch), then a gallery in the README.
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
