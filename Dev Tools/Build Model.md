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
> - **Play styles.** A play style wants some kinds at 2 (its own) or 1 (it can use them). Read from the champion note's `stack` first (攻擊力 + 暴擊 → CRIT; 攻擊力 + 生命 → BRU; 法術強度 + 攻速 → OHAP …), then its archetypes; an enchanter (heals or shields allies, not a tank) wants ENCH. Champions with two augment builds (`STYLES` in `augment_tiers.py`) get the same two; `STYLES` in `build_tiers.py` adds the builds the games show (Varus 穿甲 Q / 攻速特效 W / 法術 W; Udyr 法術 R / 坦克; Malphite 坦克 / 法術; Katarina 攻速特效).
> - **Conditions** read the kit and only lower the fit: the 魔力之流 items need mana, hydras and 雄心之鋼 need melee, 芮蘭颶風箭 and C44 need range, the enchanter items need heals or shields on allies, 帝王命令 and 班德爾笛子 need crowd control, the ultimate items (惡意, 獵魔弩箭, 實驗型海克斯板甲, 公理弧刃) and the 魔法彎刀 items (三相之力, 巫妖之禍 …) want an ultimate that matters / short cooldowns. 破船戰斧 (made for towers) stays at +1.
> - **Games.** resg.top's Mayhem games for the patch: the item's win rate on the champion against the champion's own, pulled toward its result on every champion when the games are few (`PRIOR_GAMES` = 3000), plus how often the champion builds it (`POP`).
> - **Score** = that gap + 3 points per fit point + up to 4 points for how often it is built.

---
## 🛒 The build

> [!info]+ What the page shows (出裝, Mayhem mode)
> - **主出裝**: the five best items with a fit of +1 or more, one of each unique passive (命脈, 魔法彎刀, 魔力之流, 劈砍, 獻祭, 重創, 法術護盾), in the order players buy them (resg.top's most common first items); then the boots: the style's own boots (狂戰士護脛 for attackers, 法師之靴 for mages, 愛歐尼亞之靴 for casters and enchanters, 水星之靴 / 鍍板鋼蓋 for fighters and tanks) first, the plain ones only when none fits.
> - **替代**: the next three items, and one situational item with when to buy it (`WHEN`: 重創 敵方回血多時, 中婭沙漏 被切入時, 女妖面紗 敵方有關鍵控場時 …). Situational items never go in the main build.
> - A switch between play styles when there are two or more. The champion note's hand-written `builds` show under it.
> - No resg number is shown: only items and reasons.

---
## ❓ Questions

> [!info]+ [[Build Questions]]
> - **Built often, no reason**: items a champion builds in a quarter of its games that none of its styles has a reason for: usually a play style the script does not know yet (Rell's tank items before tank supports were tanks, Locke's AP).
> - **Strong in games, no reason**: items doing 4 points better on the champion than everywhere, with no reason.
> - **In the main build, the games say no**.
> - Explain the champion's build and it becomes a style in `STYLES`, an item kind or a condition.

---
## 📦 Data

> [!example]+ Files
> - `tools/build_tiers.py` reads the item notes (finished items: no `into`, 2200 gold or more, not an augment reward), the champion notes (through `augment_tiers.Champ`) and resg.top's cache from `tools/fetch_resg.py`; ARAM's own copies (126697 傲慢) count as the item note of that name.
> - Writes `_data/item-builds.json` (read by the plugin), [[Build Review]] (the test champions with fit, games, pick rate and gap, for review) and [[Build Questions]].
> - Runs in `tools/update_patch.py` after the augment tiers. By hand: `python3 -I tools/fetch_resg.py && python3 -I tools/build_tiers.py`.
> - Source: [resg.top](https://www.resg.top/), patch 16.21, collected 2026-11-02.
