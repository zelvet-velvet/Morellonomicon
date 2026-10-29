---
title: Dev Status
tags:
  - morellonomicon
  - status
sticker: lucide//activity
---
> [!important] For AI assistants
> Read [[LLM Guide]] before any `CMD_` or status update. This note is kept by `CMD_SYNC` / `CMD_ROLLOVER` / `CMD_NOTES_SYNC`; the day notes in `Review/Log/` by `CMD_JOURNAL`.

## 🚀 Today's Progress (2026-10-29)
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
- **Picks lanes**: bigger lane icons, one lane at a time (to check on the phone).
- **Tidy-up**: about 80 unused style rules and a few unused bits of code removed.

## 📅 Yesterday's Progress (2026-10-28)
- **速查 swipe**: picked champions as the Handbook card pile, right = like, left = pass, then the liked ones two across (to check on the phone).
- **速查 overview cards**: one-line overview, big 魔攻 / 物攻 and role tiles, a 靈魂 box, folded 技能白話 and 詳細; text for 8 champions drafted (to check on the phone and to proofread).
- **Item page**: recipe as the shop's tree above 版本調整; the Build tab links to the item page (to check on the phone).
- **Icons in one place**: [[Icons]] records which icon means what (from the filter panel) and the code maps they live in; skill cards now use the same damage icons; the 被 badge is readable (to check on the phone).
- **Scaling colours and %生命傷害 icon**: magic and physical scaling are separate pills in their own colours; the %生命傷害 tag no longer shows % twice (to check on the phone).
- **No press highlight on icons**: no grey blob or shadow around any tapped icon or button (to check on the phone).
- **Malphite ult by level**: a `levels` card shows each ult level's damage alone and with 300 魔法攻擊; the misleading big-number card is gone (to check on the phone).
- **Fixed text rows**: kicker, 1-line title, 2-line body and a 小技巧 line (short orange line, label, tip), the same height on every card; long text is cut with … (to check on the phone).
- **Clip height and 小技巧**: clips end at the top of the words so the whole height shows; the card tip label is 小技巧 (to check on the phone).
- **Frame F2 in the app**: the picture fills the card behind the words, the words fit their content, the dock and the clip fade follow the text height (to check on the phone).
- **Card layout rules**: one frame for every Handbook card (F2, whole-card stage, words fit their content, dock on top of the words), text limits and stage templates in the Handbook card section of [[Layouts]]; `tools/check_cards.py` finds 35 of 68 cards over the limits.
- **Clip crop and fade**: every clip card fills the picture, cut to where the champion stands (about three quarters from the left), with an eased fade (no edge line) and the tags / steps just above the words (to check on the phone).
- **Combo card**: Jayce's cannon page is the demo clip with the ability pictures, an arrow and three result chips instead of text columns; a new `combo` visual; its clip fills the card (cut to the middle) and plays E then Q (to check on the phone).
- **Clip cards and centring**: clips sit as a rounded 16:9 picture on the card's own background (no black strip, no blur); skill cards are centred vertically; the number card says which rank its bars use (to check on the phone).
- **Loading screen tips in the Handbook**: the trivia card shows the game's own loading screen tips in zh_TW, only the ones Zaviel picked from the wiki (2017 Miscellaneous and 2025 Did You Know, all 152 found), over one of ARAM's three loading screen backgrounds (Howling Abyss, Butcher's Bridge, the Ionian bridge); random each visit, no repeats.
- **Patch job push**: the job puts its commit on top of a newer main before pushing (a push made while it ran used to make it fail).
- **Handbook home**: opens with the loading tip on an ARAM map, then two blocks, 初來乍到 (basics) and 高手必備 (advanced), each with its own progress, the next topic as a large picture and the rest two across; the glossary is a row at the end.
- **Roles and lanes**: 英雄定位 explains how roles map to lanes (下路 pair, 中路 roaming, 打野) and why counters change with lane and time; the last-card next-topic panel is now fixed under the card, and a tilted card passes over the progress bars.
- **Your mastery**: `tools/fetch_mastery.py` writes a git-ignored `_data/mastery.json`; the Champions grid and a champion's page show your mastery level and points on devices that have it (the phone does not until it is published) (to check).
- **%生命傷害 tag**: 75 champions that deal a share of the target's health (max / current / missing) can be filtered in the 傷害 group (to check on the phone); a sort by the size of the percent is not built.
- **Passive numbers**: 44 champions' passives show damage / heal / shield by champion level with scaling (from the passive's own tooltip); percent-of-health amounts are left out (to check on the phone).
- **Folder names in one place**: `tools/vault_paths.py` and the plugin defaults name the note folders; the rename to English (when calm) is then a `git mv` plus a map of the saved read paths.
- **No blocking veil, scroll reset**: detail pages show at once (no page-wide veil that blocks taps), the champion banner loads as a block, and a page always starts at the top (to check on the phone).
- **Handbook blocks**: the tip stack and each group of topic tiles load as blocks; the keyword row keeps its height; the band of light is only inside blocks (to check on the phone).
- **Blocks that load on their own**: the lane row, champion grid, augment list and Patch grids each show blurred with the light band until their own pictures are in (to check on the phone).
- **Icons without blink, lighter Pyke**: small icons load at once and are warmed in the background; a WebM-only clip plays only when on top (to check on the phone).
- **Complete pages, calm start-up**: pages wait a quarter second for their pictures and appear complete (blur only if slower); the start-up veil waits until the data stops changing; Handbook opens at home after a restart (to check on the phone).
- **Start-up without the glitch**: one blur layer from the first frame, kept across the rebuild, fading out once the first page's icons are in (to check on the phone).
- **Clips, blink, start-up icons**: clips are released when a page is left and the blur backdrop is a still (no stuck black clips on a second visit); the loading look waits 0.25 s before showing and stays 0.5 s; the first page after start-up waits for its icons (to check on the phone).
- **Start-up loading look**: the first page shows the blur and light band until the data files are read (to check on the phone).
- **Glass-sheen loading**: loading shows a soft band of light sliding from the bottom right to the left over a screen-sized blur veil (the blank Champions page came from blurring the whole page) (to check on the phone).
- **Page start and loading look**: champion and pushed pages start at the top; tab pages show blurred with the ripple until their icons are in (to check on the phone).
- **Rippling load and warm clips**: the loading look is rippling light; `clip` cards show their video again; the next topic's first clips are downloaded while on the Handbook home (to check on the phone).
- **Loading and tabs**: topic cards breathe blurred while loading (waits for the first three cards' media); switching tabs resets the tab you left to its main page.
- **Topic loading and Jayce**: a topic shows once all its clips and pictures have loaded; 杰西 has a form-set card with both forms' ability pictures (no cannon clip: Riot's clips Q2 / E2 are the hammer).
- **Card layout templates**: `ability`, `clip`, `number`, `forms` cards place shared components in grid areas (`cardkit.ts`); used by 跳脫定位框架; other topics can switch their skill cards over (to check on the phone).
- **跳脫定位框架 in detail**: 杰西 (R and the cannon Q, E clips), 派克 (R clip and R card), 墨菲特 (R clip and R numbers with AP scaling); new card options `skill … grid` and `video … Q2`.
- **Collectible cards**: Handbook topic cards use mock D (white border carrying a rainbow sheen that follows the drag, dark full-art face; no badge) (to check on the phone).
- **Tip swipe and tab bar fixes**: the tip stack is easier to swipe (no hint text); the tab highlight is a plain pill and dragging it no longer opens the sidebar (to check on the phone).
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

---

## ⏳ Ongoing

### 📦 Data
- [ ] **洛克's lane**: newer than Meraki's lane data (16.3); add `positions` to his note by hand. Current lane data needs the ranked count with a Riot key.
- [>] **Nicknames**: the `aliases` key works in 速查 (text and sound); 布里茨 (機器人) and 犽宿 (亞索) are in, fill the rest by hand (to check on the phone).
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
- [ ] **速查 text for every champion**: `punch` / `soul` / `plain` written for 8 (待驗證); the other 165 to draft in batches for review.
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
