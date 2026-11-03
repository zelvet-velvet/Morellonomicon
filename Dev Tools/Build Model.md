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
> - **Kinds.** Every finished item has the kinds of champion it is made for (`KINDS` in `tools/build_tiers.py`) and one line saying what it does (`依目標目前生命加傷害，打坦克`): CRIT (暴擊射手), OHAD / OHAP (攻速特效, physical / magic), LETH (穿甲, ability burst), BRU (戰士), TANK, SUP (support auras), MAGE (爆發法師), MHP (法師 who fight long: 生命, 燒傷), ENCH (治療、護盾隊友).
> - **Play styles come from the games.** An item's family is its first kind (法術, 攻速特效, 暴擊, 穿甲, 戰士, 坦克, 輔助; a ranged champion's 戰士 items count as 穿甲). A champion's play styles are the families players start with (the first item, 3% of its games or more; an item of two kinds counts for the family of the sets it starts), the families of its strong first-three sets, and the family its note reads as (`stack` first, then archetypes) — up to four, most played first. A style whose every set does 5 points worse than the champion is left out. Each style wants its own kinds (2) and some others (1) (`FAMILY_WANTS`); `STYLE_NAMES` renames one when the kit says it better (Varus 穿甲 Q / 攻速特效 W / 法術 W). Katarina so gets 攻速特效, 法術 and 坦克 (雄心之鋼 first).
> - **Conditions** read the kit and only lower the fit: the 魔力之流 items need mana, hydras and 雄心之鋼 need melee, 芮蘭颶風箭 and C44 need range, the enchanter items need heals or shields on allies, 帝王命令 and 班德爾笛子 need crowd control, the ultimate items (惡意, 獵魔弩箭, 實驗型海克斯板甲, 公理弧刃) and the 魔法彎刀 items (三相之力, 巫妖之禍 …) want an ultimate that matters / short cooldowns. 破船戰斧 (made for towers) stays at +1.
> - **Games.** resg.top's Mayhem games for the patch: the item's win rate on the champion against the champion's own, pulled toward its result on every champion when the games are few (`PRIOR_GAMES` = 3000), plus how often the champion builds it (`POP`).
> - **Score** = that gap + 3 points per fit point + up to 4 points for how often it is built.

---
## 🛒 The build

> [!info]+ What the page shows (出裝, Mayhem mode): one screen, no scrolling
> - **前三件**: up to five sets of the first three items as tiles in two columns, each labelled with its play style; every style gets its best set, then the strongest of the rest. Sets come from resg.top's most built first-three orders (one per set of three, its most built order), kept when the style has a reason for all three; strength is the set's win rate against the champion's own, pulled toward it when the games are few (`CORE_PRIOR`), plus how often it is built (`POP_CORE`). A style the games have no set for gets one from its most built first item and the reasoning. Tapping a tile picks it.
> - **第四到六件**: five icons for the picked tile's style, its own items left out, each with one word for what it adds (`NEEDS`: 輸出, 生存, 穿透, 功能, 機動, 重創; 看情況 for a situational one, `WHEN`): damage from the style's own items, the rest from any it can use.
> - **鞋子** and **命定武器** side by side: the boots with their use (攻速, 法穿, 技能急速 …); the item to take when 命定武器 comes (the style's first item) in the game's rainbow border (`strawberry_weapon_evolve_border`, the item modifier 命定武器 uses in CommunityDragon's item data, shown by address), with the stats it grows on takedowns.
> - **The line**: tapping any icon says what it does there (its name and reason; tapping the line opens the item). No item names elsewhere.
> - **特殊出裝**: hand builds the games cannot show (`SPECIAL`: Malphite's 鎖子甲 ×6), one row; its note goes on the line.
> - The champion note's hand-written `builds` show under them. No resg number is shown.

---
## ❓ Questions

> [!info]+ [[Build Questions]]
> - **Built often, no reason**: items a champion builds in a quarter of its games that none of its styles has a reason for: usually a play style the script does not know yet (Rell's tank items before tank supports were tanks, Locke's AP).
> - **Strong in games, no reason**: items doing 4 points better on the champion than everywhere, with no reason.
> - Explain the champion's build and it becomes a style in `STYLES`, an item kind or a condition.

---
## 📦 Data

> [!example]+ Files
> - `tools/build_tiers.py` reads the item notes (finished items: no `into`, 2200 gold or more, not an augment reward), the champion notes (through `augment_tiers.Champ`) and resg.top's cache from `tools/fetch_resg.py`; ARAM's own copies (126697 傲慢) count as the item note of that name.
> - Writes `_data/item-builds.json` (read by the plugin), [[Build Review]] (the test champions' sets, and every item with fit, games, pick rate and gap, for review) and [[Build Questions]].
> - Runs in `tools/update_patch.py` after the augment tiers. By hand: `python3 -I tools/fetch_resg.py && python3 -I tools/build_tiers.py`.
> - Source: [resg.top](https://www.resg.top/), patch 16.21, collected 2026-11-02.
