---
title: Dev Status
tags:
  - morellonomicon
  - status
sticker: lucide//activity
---
> [!important] For AI assistants
> Kept by `/cmd-sync` / `/cmd-rollover` / `/cmd-notes-sync` (skills, table in `AGENTS.md`); the day notes in `Review/Log/` by `/cmd-journal`. Run `python3 -I tools/vault_status.py show` before reading this note; read only the section you change.

## 🚀 Today's Progress (2026-11-02)
> [!abstract]+ Today
> - **Project management like agent-worklog-vault**: `AGENTS.md` is the entry point; the commands and the long task rules are `mn-*` skills in `.claude/skills/`; [[LLM Guide]] keeps the shared rules (26 → 11 KB); `tools/vault_status.py` does the mechanical steps; finished work moved to [[Progress Archive]].
> - **Next**: review the augment recommendations on the 強化 tab and `Review/Augment Tiers.md` (see Ongoing → Data).

## 📅 Yesterday's Progress (2026-11-01)
> [!abstract]- Yesterday (2026-10-31 and 2026-11-01: [[2026-10-31]], [[2026-11-01]])
> - **Augment model**: every Mayhem augment ranked per champion play style from the champion's own numbers (fight at levels 3 / 7 / 11 / 15 / 18, per rarity, the Pentakill set apart), 204 modelled and 44 unrated with a reason; design in [[Augment Model]], tiers for test champions in [[Augment Tiers]] (to review).
> - **Champion page reworked**: 概覽 with stats, chart and tags on one axis and the name sliding with it; 技能 with the text on top, the clip (drawn on a canvas, faded edges) and the ability bar below; 出裝 builds centred with Live stats links; 強化 a one-screen glance of S augments, 全部強化 every tier; 全部概覽 with the detailed chart; small sub page headers; Back returns to the page left.
> - **Champion page family rule**: no panels, word switches, accent links, tier order, glance pages fit one screen, a press fades instead of a grey disc ([[Design Rules]]).
> - **速查 end**: the liked champions wait behind the last card and sharpen in place; choosing one plays a heart burst, a double heartbeat and the champion's name on a pink screen, then opens its page.
> - **Items**: only what the shop sells (the old 77NNNN ARAM copies dropped, 216 items, current recipes with repeated parts), the shop's class tabs with its own icons and the wiki's class lists, a flip button for the tiers, icons and the stat rail ready before a tap; the item page shows its whole route (parts, upgrades, the legendaries they lead to).
> - **Balance**: short pages centred (Home, 最近對戰, the augment and item pages, 全部概覽), empty states centred, zh_TW search boxes.
> - **Smoother**: Home fetches the Riot profile once (no cold-open glitch), the champion pages follow the finger (no stuck swipe), clips load ahead in an on-screen holder.

## ⏳ Ongoing

> [!question]+ 📦 Data
> - [ ] **洛克's lane**: newer than Meraki's lane data (16.3); add `positions` to his note by hand. Current lane data needs the ranked count with a Riot key.
> - [>] **Nicknames**: the `aliases` key works in 速查 (text and sound); 布里茨 (機器人) and 犽宿 (亞索) are in, fill the rest by hand.
> - [>] **On-hit list**: `onhit` is set for 卡特蓮娜, 伊澤瑞爾, 菲歐拉, 易大師, 犽宿, 犽凝; draft it for the other champions for review.
> - [x] **Item notes check**: the `77NNNN` copies were old leftovers with old recipes and art; item notes are now what the shop sells (CommunityDragon's shop list), 216 items, plus the Mayhem augment rewards.
> - [ ] **Offline images**: optional `tools/cache_images.py` into a gitignored folder.
> - [>] **Augment numbers**: 247 augments have `effect` lines from the League wiki (待驗證: check a few in game, then mark 已驗證); `fetch_wiki_augments.py` lists the augments whose wiki text changed each patch, whose line then needs updating. 專精輔助 has no source. Arena's numbers (`augment-data.json`) are only used where no `effect` exists.
> - [>] **Augment model**: tiers per champion play style from the champions' own numbers ([[Augment Model]], `tools/augment_model.py`); the 強化 tab and the augment page use it. Next: Zaviel reviews the recommendations (強化 tab, [[Augment Tiers]]) and names wrong ones; fixes go into the model (hand data in `tools/data/`), never the tier. `pinned` / `avoid` still win.
> - [-] **Augment fit by archetype tags**: replaced by the augment model (numbers instead of hand tags); `combos` may come back later.
> - [?] **Statistics**: win / pick rates for Mayhem augments need either Match-V5 (developer key, queue for ARAM Mayhem, many matches) or a cited community source. Decide in phase 2.

> [!todo]+ 🔢 Skill numbers
> - [ ] **Unresolved damage (34 skills)**: level-based or conditional formulas (Kha'Zix Q, Jhin, Jayce… ); check a few against the in-game tooltip and extend `tools/spells.py` where it is cheap.
> - [ ] **Stat codes**: only 0 (AP) and 2 (AD, formula 2 = bonus) are named; other stats show as "+其他加成" (66 rows) until their codes are confirmed.

> [!warning]+ ✍️ Our own strategy
> - [>] **速查 text for every champion**: `punch` / `soul` / `plain` in all 173 notes: 8 by Zaviel, 165 drafted by Claude on 2026-10-29 in the same style from each ability's game text (待驗證: proofread in `Inbox/速查卡片.md`, which counts the 已驗證 ones). `stack` (172, not 洛克) and `focus` (14) copied from `Inbox/速查卡片草稿.md` too.
> - [!] **Builds by play style (decided 2026-10-28, from Zaviel)**: not a hand-written build per champion. Zaviel lists the first three items (in buying order) for each play style, per mode (Mayhem and Rift apart), in `Inbox/玩法出裝收件匣.md`, from OP.GG and similar (their numbers are never copied, only items and a one-line reason with the source). The champion page's Build tab then shows the set of the champion's play style, labelled as recommended for that play style. The play style is read automatically from the champion's skill scaling (AP / AD / on-hit / tank, with the roles) and can be set by hand; wrong ones are fixed by changing a rule or a hand override, not the champion. Mayhem sets are about items only; augment pairings come later (augment `fits`, the Augments tab). Test champions: Katarina, Akali, Talon, Lux, Ahri (the five Zaviel plays best).
> - [>] **Inbox**: Zaviel is tidying the first tricks into `Inbox/技巧.md`; then "process the inbox".
> - [ ] **Easy way to record it**: tips, builds and combos are frontmatter lists today; add a command / form ("Add tip", "Add build") so they can be written on the phone in a few taps.
> - [?] **Review**: the Handbook search is the quick way back to a detail; consider a short quiz / saved list if forgetting remains a problem.
> - [ ] **First batch of content**: five champions you play often in Mayhem, with one alternative build and one trick each.

> [!todo]+ 🔁 Patch changes
> - [ ] **Damage diffs**: compare per-rank damage using CommunityDragon's old game data (`raw.communitydragon.org/<patch>/game/data/characters/...`, about 11 MB per patch); most balance patches change damage, so the badge undercounts until this is in.
> - [>] **Mayhem-specific balance**: the official notes list Mayhem champion adjustments under the Mayhem heading (none in 26.21); `mayhem_champions` is read but not shown yet.
> - [ ] **Item and augment changes**: the same diff for items (price, stats, text).
> - [ ] **Actions versions**: GitHub warns that `checkout@v4`, `setup-python@v5` and `cache@v4` run on a deprecated Node; bump them when newer majors are confirmed.
> - [ ] **Augment effects before 26.19**: only augments introduced in the last 3 patches have Riot's effect text; run `fetch_patch_notes.py --patches 12` to reach further back, or write `effect` by hand.

> [!warning]+ 🧮 Match data
> - [!] ~~First real run~~ (Rift only): needs a Riot key in `.env` (`RIOT_API_KEY=RGAPI-...`) and a seed Riot ID; `python3 tools/fetch_builds.py --seed "Name#TW2" --matches 300`. A development key expires every 24 hours; a personal key does not. Check that the augment ids in the matches match the notes' ids. (waiting for a Riot key)
> - [ ] **Hand-written builds and tips**: `builds` (kind meta / alt / synergy, mode, name, items, note, with) and `tips` (title, text, video) in a champion note's frontmatter; none written yet.
> - [ ] **Augments sub-tab**: use the counted augment picks (and `fits`) once there is data.

> [!warning]+ 🖼️ Handbook pictures
> - [ ] **Cards to the layout**: shorten the 37 cards over the Handbook card limits in [[Layouts]] (`python3 -I tools/check_cards.py`); the ability card's tags still sit in the stage, not the dock.
> - [!] **In-game screenshots** (Zaviel): save them in the vault (e.g. `Assets/`) and put `visual: img Assets/name.png` under a card. Wanted: where the skill damage and cooldown show in the HUD; the augment pick screen (silver / gold / prismatic); the item shop with the recipe tree; the scoreboard; the minimap and ward icons.
> - [>] **More decks**: 視野控制 (Rift wards) is in; still to write: Rift basics (lanes, objectives), ping etiquette, one card each for the trick-of-the-week.
> - [ ] **Ward spots**: the 視野控制 cards place wards by eye on the minimap; check them against real games and adjust `WARDS` in `plugin/src/pages/deck.ts`.

> [!warning]+ 🎬 Videos
> - [!] **Pyke R fast-forward**: clip cards can skip a part (`clip Pyke R a-b+c-d`); needs the seconds where the fast-forward starts and ends (Zaviel), or the clip host `d28xe8vt774jo5.cloudfront.net` allowed in the cloud environment so the clip can be measured.
> - [ ] **Other forms**: champions that swap forms or upgrade through a mechanic Riot's text does not word as 進化 / 升級 (Viktor, Jayce, Elise, Nidalee, Gnar, Aphelios…) show their base skill only; list them and add hand-written upgrade text.
> - [ ] **Skill combo videos**: optional `video:` (YouTube id) per champion note. OP.GG's channel could not be listed without the YouTube Data API (the page is JavaScript and the RSS feed gave 404); needs a free API key in `.env` (`YOUTUBE_API_KEY`), or hand-picked ids. The plugin shows a `youtube-nocookie` embed when the field exists, else a "search on YouTube" button.

> [!warning]+ 🧩 Plugin (TypeScript, from the ZeLedger skeleton)
> - [x] **Items list**: the Items page (from Home) lists every item of the mode like the shop: role tabs, stat rail, tiers or price.
> - [!] **速查 swipe on the phone**: check the pile height with the ✕ / ♥ buttons, the big ♥ / ✕ while dragging, no scrollbar; liked champions are not kept after leaving the page. (waiting for Zaviel's check on the phone)
> - [?] **True damage icon**: `gem` for 真實 was chosen by Claude (see [[Icons]]); `crosshair` and `sword` each mean two things there. (Zaviel to confirm)
> - [x] **Champion page v3**: built from its mocks after the adjustment (the content down to the tab bar, the chips floating over it).
> - [ ] **Rift slot**: `plugin/src/modes.ts` has Rift (disabled); to open it set `enabled`, give `home.ts` and the champion card's "Build" block real content, and fill the `rift` item flag.
> - [x] **Mayhem advisor**: the champion page's 強化 tab shows the augment model's S augments, 全部強化 every tier.
> - [!] **Phone checks**: 技能's clip canvas after a dozen switches (no rectangle, smooth, not warm); the Items rail on a cold start; an unrated augment's page (潘朵拉的寶盒, 質變：稜鏡). (waiting for Zaviel)
> - [ ] **Sheets and settings panel** when a flow needs them (the skeleton has a bottom sheet to copy).

> [!todo]+ 📖 Content
> - [>] **ARAM Mayhem**: augment tiers per champion now come from the augment model; still to write: overpowered combos and a few hand notes on popular champions.
> - [ ] **Modes**: item-pick differences for Normal, Ranked and ARAM.

> [!warning]+ 🎨 Vault look
> - [!] **Opening animation (pending)**: a full-screen opening when Obsidian starts (a strong intro, then calm looping motion, tap for Home). Drawing it in code looked poor; make the art first (an AI image and image-to-video tool, or an artist), then the app plays the clips.
> - [!] **README screenshots**: phone screenshots into `Assets/readme/` (Home, 速查 card, a champion, Items, a Handbook card, Patch), then a gallery in the README. (waiting for Zaviel)
> - [>] **Theme and snippets**: copied from clawd-room (Minimal + 4 snippets); `baseFontSize` is 30 there, check it on phone and PC and tune.
> - [?] **Plugins**: `tools/install_plugins.py` downloads the 13 listed plugins; decide which to keep (Dataview, Templater, Style Settings, Minimal Settings, Breadcrumbs are the useful ones here).

> [!warning]+ 📱 Phone
> - [!] **Haptic**: check Settings → Test haptic on the phone; remove the haptic code if nothing works in Obsidian. (waiting for Zaviel's check on the phone)

## 💡 Ideas
> [!example]+ Not planned yet
> - A static website export of the vault for people without Obsidian.
> - A "what do I build?" note per champion that changes with the enemy team (armor vs magic resist).

## 🏁 Last Progress
> [!abstract]- Moved
> Finished work is in [[Progress Archive]] (`/cmd-notes-sync` moves `[x]` Ongoing items there).
