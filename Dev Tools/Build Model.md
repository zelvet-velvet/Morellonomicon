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
> - **Play styles: Zaviel's first.** `Inbox/玩法出裝.md` (an editor) lists shared play styles: 玩法, 核心 1–2 items, 怎麼玩 and 適合的英雄; every champion listed gets that build (and only the builds that list it). Claude drafted 26 from resg.top's first-two and first-three picks (a pair at least 1% of a champion's games, not clearly losing), 待驗證 for Zaviel to review and add champions to. A style wants its core items' kinds and their families' (法術: MAGE and MHP) and keeps to their damage: items of the other damage (物攻 in an AP build) are out. resg.top's first-two sets go to the style whose core items they hold (the first item counts most): the pair holding most of them, then the strongest, is the style's 核心 (two items: the first-two list keeps more of a champion's styles than the first three, which spread thin); the others give 可換; 第三 lists what players most often add to that pair (resg.top's first-three sets that start with it, situational items left out).
> - **Champions with none: from the games.** An item's family is its first kind (法術, 攻速特效, 暴擊, 穿甲, 戰士, 坦克, 輔助; a ranged champion's 戰士 items count as 穿甲); the styles are the families players start with (3% of games or more), build a strong set of, or the note reads as; a style whose every set does 5 points worse than the champion is left out.
> - **Conditions** read the kit and only lower the fit: the 魔力之流 items need mana, hydras and 雄心之鋼 need melee, 芮蘭颶風箭 and C44 need range, the enchanter items need heals or shields on allies, 帝王命令 and 班德爾笛子 need crowd control, the ultimate items (惡意, 獵魔弩箭, 實驗型海克斯板甲, 公理弧刃) and the 魔法彎刀 items (三相之力, 巫妖之禍 …) want an ultimate that matters / short cooldowns. 破船戰斧 (made for towers) stays at +1.
> - **Games.** resg.top's Mayhem games for the patch: the item's win rate on the champion against the champion's own, pulled toward its result on every champion when the games are few (`PRIOR_GAMES` = 3000), plus how often the champion builds it (`POP`).
> - **Score** = that gap + 3 points per fit point + up to 4 points for how often it is built.

---
## 🛒 The build

> [!info]+ What the page shows (出裝, Mayhem mode), laid out like 技能
> - **Top**: the play styles as words, how the chosen one plays (怎麼玩), then the tapped item: its name (a tap opens the item), a word for its place (第 1 件, 可換, 生存 …) and why it works for this champion.
> - **Bottom bar** (at the thumb): 核心 (the first two, › between), 第三 (choices for the third item), 可換 (items other pairs of the style put in place of one), 後續 (items four to six, a word under each: 輸出, 生存, 穿透, 功能, 機動, 重創, 看情況), 鞋子 with its use and 命定 (the item for 命定武器 in the game's rainbow border, `strawberry_weapon_evolve_border`, with the stats it grows on takedowns), 特殊 (hand builds the games cannot show: Malphite's 鎖子甲 ×6).
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
> - `tools/build_tiers.py` reads the item notes (finished items: no `into`, 2200 gold or more, not an augment reward), the champion notes (through `augment_tiers.Champ`) and resg.top's cache from `tools/fetch_resg.py`; ARAM's own copies (126697 傲慢) count as the item note of that name.
> - Writes `_data/item-builds.json` (read by the plugin), [[Build Review]] (the test champions' sets, and every item with fit, games, pick rate and gap, for review) and [[Build Questions]].
> - Runs in `tools/update_patch.py` after the augment tiers. By hand: `python3 -I tools/fetch_resg.py && python3 -I tools/build_tiers.py`.
> - Source: [resg.top](https://www.resg.top/), patch 16.21, collected 2026-11-02.
