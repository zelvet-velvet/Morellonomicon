---
title: Morellonomicon - Augment Model
date: 2026-11-03
tags:
  - dev-tools
  - augments
  - morellonomicon
sticker: lucide//calculator
---
How the app tiers ARAM Mayhem augments for each champion: **why the champion's kit makes an augment work**, checked against real games. Rebuilt on 2026-11-03 from scratch (the earlier fight simulation is gone; it is in git before that date).

---
## 🧭 The idea

> [!abstract]+ Reasoning first, games as the check
> - **Reasoning.** Every augment has a rule (`RULES` in `tools/reason/augment_tiers.py`) that reads the champion's kit and gives a **fit** from −2 (does nothing for this champion: 一轉就贏 without a spinning ability) to +2 (the kit is what the augment rewards: 衝鋒 on a champion with two dashes), with the reason the page shows (`2 個位移技能，位移冷卻大減`).
> - **Games.** The patch's Mayhem games (our crawl, else resg.top; see Source): the augment's win rate on the champion against the champion's own. Few games are pulled toward the augment's result on every champion, nudged by the fit (`PRIOR_GAMES` = 1500), so a small sample cannot make an S.
> - **Score** = that gap + a small share of the fit (`FIT_SCORE`), so the reasoning still counts when the games are many.
> - **A list per play style** (from our crawl, decided with Zaviel 2026-11-22). The play styles are the champion's builds ([[Build Model]]: the games pick them). `tools/reason/build_tiers.py` runs first and splits our crawl by style: a player is in the style whose first-two sets hold their first two finished items (`.cache/lcu/cache/<patch>/styles.json`, git-ignored; about 73% of players match one). Each style's list takes the augment's win rate within the style against the style's own, pulled toward the champion's gap above by `STYLE_PRIOR` = 600 games; the reasons stay the champion's (its `STYLES` build of the style's damage). The app ranks a play style's cards by the list of that name. From resg.top's totals (no split) the champion keeps one list per `STYLES` build.
> - **Questions.** Where the two disagree on a well-sampled pair, it is listed in [[Augment Questions]] for Zaviel to explain; the answer becomes a rule or a hand list entry.

---
## 🧩 What a rule reads

> [!info]+ From the champion note
> `archetypes` (近戰 / 遠程, 射手, 法師, 戰士, 坦克, 刺客, 輔助), `damage_type`, `resource` (魔力), `stack` (the stats it builds: 攻速 → on-hit, 暴擊 → crit, 生命 → health), `onhit`, and each ability's tags (位移, 控場, 緩速, 強化普攻, 治療, 護盾, 隊友增益) and cooldown.

> [!info]+ Hand lists (top of `tools/reason/augment_tiers.py`), for what the notes do not tag
> - Mechanics: `SPIN` (一轉就贏), `CHANNEL` (別轉台), `TERRAIN` (劃地為王), `SUMMON` (士兵術師), `PERMA` (堆層暴龍), `KNOCKBACK` (連鎖反應), `ATTACK_BUFF` (abilities that buff attacks for a while), `ONHIT_PASSIVE` (passives that stack per hit: 蜜蜂來襲, 幻影武器), `ULT_STANCE` (ultimates that are a long buff: 大絕覺醒), `ULT_SPAM`, `DOT`, `BIG_MODEL` (巨人殺手), `ULT_KEY` (champions picked for their ultimate), `SPAMMER` (basic abilities are the damage), `AP_ATTACKER`.
> - How a champion is built in Mayhem when the note's archetypes say otherwise: `BRUISER_PLAY` (Hecarim, Xin Zhao), `TANK_PLAY` (Poppy), `MAGE_PLAY` (Seraphine), `NO_ATTACK` (Singed), `NO_CC` (Tahm Kench: his stun needs three stacks, W is hard to land).
> - **Two builds** (`STYLES`): Kai'Sa (物攻射手 / 法術 W), Kog'Maw (物攻射手 / 法術 E、R), Udyr (物攻 Q / 法術 R), Shaco (物攻刺客 / 法術 W、R), Twisted Fate (物攻暴擊 / 法術 Q、W), Ashe (物攻射手 / 法術 R), Bard (攻速特效 / 法師). They give the reasoning of a play style by its damage (法術 styles read the 法術 build); an augment only the other build has a reason for stops at B and is not asked about.
> - `PAIR`: one champion and augment from Zaviel's answers (Malphite W + 裝甲衝擊, Qiyana WQWQ + 輸出超負荷, Hecarim 祕術拳擊 + 幻影武器, the fixed abilities of 共鳴施放 / 法術逬裂 / 三連射 …). `DMG_BUFF` / `SURVIVE`: assassins want damage or survival even without a kit reason. `MELEE_RANGE`: melee attackers whose abilities buff attacks (Irelia, Tryndamere, Trundle) take range augments.
> - `GENERIC`: augments that give everyone the same (gold, stat anvils, random rewards, snowball, summoner spells); no champion needs a reason, so they are never asked about.
> - Item upgrades (`ITEM_UPGRADE`) get at most +1: they only help if that item is built.

---
## 🏷️ Tiers

> [!info]+ From score to tier
> - **Per rarity** (every screen's three offers share one), the Pentakill band's set (重金屬 … 末日金屬) apart.
> - **By rank within the champion's augments of that rarity**: S the top 8%, A to 20%, B to 45%, C the rest; S and A must also beat the champion's own win rate, B must be within 1 point of it.
> - A fit of −2 is always C.
> - The reason shown is the rule's reason when the fit is positive; when the games clearly contradict it (the augment does 4 points worse on this champion than everywhere), or the fit is 0 or less, the augment's own line (`GEN`) is shown instead.
> - `pinned` / `avoid` in the champion note still win.

---
## 📦 Data

> [!example]+ Files
> - `tools/crawl/fetch_resg.py` caches resg.top's numbers for the newest patch (games and wins per champion and per augment on each champion) in the git-ignored `.cache/resg/<patch>/`. resg.top publishes no licence, so **no resg number is committed or shown**: the app shows tiers and reasons only.
> - `tools/reason/augment_tiers.py` writes `_data/augment-tiers.json` (read by the plugin and oblivion-orb; compact since 2026-11-22, format 2: each reason once in `reasons`, each augment's group once in `groups`, a row as `[id, tier, value, score, reason index, when?]`, one per line; `tools/datalib.py` `tier_rows()` and the plugin's `decodeAugTiers` read it back; 2.9 MB instead of 10.5), [[Augment Tiers]] (the test champions with fit, games, gap and score, for review) and [[Augment Questions]].
> - Both run in `tools/update_patch.py`. By hand: `python3 -I tools/crawl/fetch_resg.py && python3 -I tools/reason/augment_tiers.py`.
> - Source: **our own crawl** first (`tools/crawl/fetch_lcu.py` through the League client on Zaviel's PC, `tools/crawl/lcu_cache.py` into `.cache/lcu/cache/<patch>/`): every player's champion, win, items and augments in pick order; 16.23 from 172,432 games. It wins a patch once it holds `ready_games` (tools/data/lifecycle.json); before that, or on the GitHub patch job that has no crawl, [resg.top](https://www.resg.top/) totals (decided with Zaviel 2026-11-22). The job never replaces a patch built from our crawl.

---
## ✅ Checks (known answers)

> [!todo]+ Zaviel's checks from 2026-10-31, against the 2026-11-03 tiers
> - [x] 祕術拳擊 high for Master Yi, Yasuo, Yone, Fiora (all S); low for Jinx (C) and Katarina (C).
> - [x] 祕術拳擊 for Ezreal: Zaviel (2026-11-03): late game his Q cooldown is already low, he needs damage and on-hit instead; now neutral (C in the games).
> - [x] Malphite: built as a tank with 鎖子甲 ×6 early; W resets his attack, so 裝甲衝擊 and the W augments are S; 巨像之勇氣 and 殘忍 stay low in the games.
> - [x] Katarina: haste augments (循環利用, 靈光一閃) and 衝鋒 low (C).
> - [x] Jinx: attack speed high (手腳麻利 A); 基本功夫 low (C).
> - [x] 大地覺醒 weak for everyone (C, B at best).
