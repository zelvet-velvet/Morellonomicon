---
title: Morellonomicon - Build Model
date: 2026-11-03
tags:
  - dev-tools
  - items
  - morellonomicon
sticker: lucide//shopping-bag
---
How the app builds each champion's ARAM Mayhem items (出裝): **why the champion's kit makes an item work**, checked against real games. Made the same way as the [[Augment Model]].

---
## 🧭 The idea

> [!abstract]+ Reasoning first, games as the check
> - **Kinds.** Every finished item has the kinds of champion it is made for (`KINDS` in `tools/reason/build_tiers.py`) and one line saying what it does (`依目標目前生命加傷害，打坦克`): CRIT (暴擊射手), OHAD / OHAP (攻速特效, physical / magic), LETH (穿甲, ability burst), BRU (戰士), TANK, SUP (support auras), MAGE (爆發法師), MHP (法師 who fight long: 生命, 燒傷), ENCH (治療、護盾隊友).
> - **Play styles: the games pick, the catalogue names** (decided with Zaviel 2026-11-22; until then a champion got only the styles listing it). `Inbox/玩法出裝.md` (an editor) is the catalogue: 玩法, 核心 1–2 items, 怎麼玩 and 適合的英雄. Every catalogue style is a candidate for every champion, beside one style per item family (法術, 攻速特效, 暴擊, 穿甲, 戰士, 坦克, 輔助; an item's family is its first kind, a ranged champion's 戰士 items count as 穿甲). Each first-two set of the champion's games goes to the candidate holding its items (a catalogue style needs one of its core items, the first counts most; a family style takes what is left), but only when the champion's kit fits every item. A pair the kit turns down for every style (mostly hybrids: 雄心之鋼 + 時光之杖, 盧登 + 衝擊火炮) goes to a style of its two families, named noun last (法術坦克, 暴擊戰士, 特效法師, 坦克輔助; decided with Zaviel 2026-11-22), when those pairs reach 3%. A style is **kept** when all its pairs together reach 50 games (a pair counts from 20): every style the games have shows (decided with Zaviel 2026-11-23), most played first, the first is the app's default. One under 300 games is marked `few` (少見), one that does 5 points worse than the champion over all its games (pulled toward the champion's own by 100 games) `weak` (偏弱); the app says so in words, never a number. A catalogue style that lists the champion but has too few games stays after those, made from its core items and the reasoning. At most twenty; the app shows four as tiles and the rest under 更多玩法. A family style named like a catalogue style (坦克) hands its pairs to the catalogue one. A family style the catalogue has no name for keeps the family's word (法術 …) and is listed in [[Build Questions]] to be named; so is a listed style the games drop.
> - **Inside a style.** A style wants its core items' kinds and their families' (法術: MAGE and MHP) and keeps to their damage: items of the other damage (物攻 in an AP build) are out. The set holding most of its core items, then the strongest, is its 核心 (two items: the first-two list keeps more of a champion's styles than the first three); the next one is shown as the other pair; 第三 lists what players most often add to that pair (first-three sets that start with it, situational items left out).
> - **Conditions** read the kit and only lower the fit: the 魔力之流 items need mana, hydras and 雄心之鋼 need melee, 芮蘭颶風箭 and C44 need range, the enchanter items need heals or shields on allies, 帝王命令 and 班德爾笛子 need crowd control, the ultimate items (惡意, 獵魔弩箭, 實驗型海克斯板甲, 公理弧刃) and the 魔法彎刀 items (三相之力, 巫妖之禍 …) want an ultimate that matters / short cooldowns. 破船戰斧 (made for towers) stays at +1.
> - **Games.** resg.top's Mayhem games for the patch: the item's win rate on the champion against the champion's own, pulled toward its result on every champion when the games are few (`PRIOR_GAMES` = 3000), plus how often the champion builds it (`POP`).
> - **Score** = that gap + 3 points per fit point + up to 4 points for how often it is built.

---
## 🛒 The build

> [!info]+ What the page shows (出裝, Mayhem mode): buying order on a fixed five-column grid (Zaviel 2026-11-03)
> - **Top**: the play styles as words (a tap on the page's left or right side switches too), how the chosen one plays (怎麼玩), the tapped item: its name (a tap opens it), what it is for and why. Every box has a fixed height, so switching moves nothing.
> - **Item cells**, all alike (icon, name, what it is for: 輸出, 生存, 穿透, 功能, 機動, 重創, or the condition of a 看情況 item):
>   - 前兩件 (the core pair), 或, 或這兩件 (`alts`: the style's next first-two pair);
>   - 第三件 (up to three choices), 鞋子 and 命定 (the item for 命定武器 in the game's rainbow border, `strawberry_weapon_evolve_border`);
>   - 4–6 件 (five, like with like), then 特殊 (hand builds the games cannot show: Malphite's 鎖子甲 ×6).
> - A style no set of the games has is made from its core items and the reasoning (怎麼玩 says 依技能組推算 when it has no line). No resg number is shown.

---
## ❓ Questions

> [!info]+ [[Build Questions]]
> - **Built often, no reason**: items a champion builds in a quarter of its games that none of its styles has a reason for: usually a play style the script does not know yet (Rell's tank items before tank supports were tanks, Locke's AP).
> - **Strong in games, no reason**: items doing 4 points better on the champion than everywhere, with no reason.
> - Explain the champion's build and it becomes a style in `STYLES`, an item kind or a condition.

---
## 📦 Data

> [!example]+ Files
> - `tools/reason/build_tiers.py` reads the item notes (finished items: no `into`, 2200 gold or more, not an augment reward), the champion notes (through `augment_tiers.Champ`) and resg.top's cache from `tools/crawl/fetch_resg.py`; ARAM's own copies (126697 傲慢) count as the item note of that name.
> - Writes `_data/item-builds.json` (read by the plugin), [[Build Review]] (the test champions' sets, and every item with fit, games, pick rate and gap, for review) and [[Build Questions]].
> - Runs in `tools/update_patch.py` after the augment tiers. By hand: `python3 -I tools/crawl/fetch_resg.py && python3 -I tools/reason/build_tiers.py`.
> - Source: **our own crawl** first (`tools/crawl/fetch_lcu.py` through the League client on Zaviel's PC, `tools/crawl/lcu_cache.py` into `.cache/lcu/cache/<patch>/`): every player's champion, win, items and augments in pick order; 16.23 from 172,432 games. It wins a patch once it holds `ready_games` (tools/data/lifecycle.json); before that, or on the GitHub patch job that has no crawl, [resg.top](https://www.resg.top/) totals (decided with Zaviel 2026-11-22). The job never replaces a patch built from our crawl.
